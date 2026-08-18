/**
 * lib/restock/service.ts
 * 补货清单业务逻辑：CRUD + checkout（写回 inventory）。
 * Sprint 3 — PRD §3.7
 *
 * 写库约定：
 *   - 创建 / 修改走 service_role（要写 created_by / added_by / checked_by 等 user_id 字段）
 *   - 读：用 caller's household_id 做条件（隐式 RLS 也行，service_role 上层再过滤）
 */
import {
  createSupabaseServerClient,
  getServiceRoleClient,
} from '@/lib/supabase/server'
import type {
  AddItemInput,
  CreateListInput,
  RestockItem,
  RestockList,
  RestockListRow,
  RestockItemRow,
  UpdateItemInput,
  UpdateListInput,
} from './types'

// ───────── 创建清单 ─────────
export async function createList(
  householdId: string,
  userId: string,
  input: CreateListInput
): Promise<RestockListRow> {
  const service = getServiceRoleClient() as any
  const { data, error } = await service
    .from('restock_lists')
    .insert({
      household_id: householdId,
      created_by: userId,
      name: input.name?.trim() || defaultListName(),
      status: 'active',
    })
    .select('*')
    .single()

  if (error || !data) {
    throw new Error(`createList failed: ${error?.message ?? 'no data'}`)
  }
  return data as RestockListRow
}

function defaultListName(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `购物清单 ${y}-${m}-${day}`
}

// ───────── 列清单（active 在前 + 最近 10 个 completed） ─────────
export async function listLists(
  householdId: string
): Promise<RestockList[]> {
  const supabase = (await createSupabaseServerClient()) as any
  return listListsWith(supabase, householdId)
}

export async function listListsWith(
  client: any,
  householdId: string
): Promise<RestockList[]> {
  const { data: lists, error } = await client
    .from('restock_lists')
    .select('*')
    .eq('household_id', householdId)
    .in('status', ['active', 'completed'])
    .order('updated_at', { ascending: false })
    .limit(50)

  if (error || !lists) return []
  if (lists.length === 0) return []

  const ids = (lists as RestockListRow[]).map((l) => l.list_id)
  const { data: items } = await client
    .from('restock_items')
    .select('*')
    .in('list_id', ids)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  const itemByList = new Map<string, RestockItemRow[]>()
  for (const it of (items ?? []) as RestockItemRow[]) {
    if (!itemByList.has(it.list_id)) itemByList.set(it.list_id, [])
    itemByList.get(it.list_id)!.push(it)
  }

  return (lists as RestockListRow[]).map((l) => {
    const li = itemByList.get(l.list_id) ?? []
    return {
      ...l,
      items: li,
      item_count: li.length,
      bought_count: li.filter((x) => x.bought).length,
    } satisfies RestockList
  })
}

// ───────── 取一个清单（含 items） ─────────
export async function getList(
  listId: string,
  householdId: string
): Promise<RestockList | null> {
  const supabase = (await createSupabaseServerClient()) as any
  return getListWith(supabase, listId, householdId)
}

export async function getListWith(
  client: any,
  listId: string,
  householdId: string
): Promise<RestockList | null> {
  const { data: list, error } = await client
    .from('restock_lists')
    .select('*')
    .eq('list_id', listId)
    .eq('household_id', householdId)
    .maybeSingle()

  if (error || !list) return null

  const { data: items } = await client
    .from('restock_items')
    .select('*')
    .eq('list_id', listId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  const itemArr = (items ?? []) as RestockItemRow[]
  return {
    ...(list as RestockListRow),
    items: itemArr,
    item_count: itemArr.length,
    bought_count: itemArr.filter((x) => x.bought).length,
  }
}

// ───────── 修改清单（改名 / 切分享） ─────────
export async function updateList(
  listId: string,
  householdId: string,
  input: UpdateListInput
): Promise<RestockListRow | null> {
  const service = getServiceRoleClient() as any
  const patch: Record<string, unknown> = {}
  if (input.name !== undefined) patch.name = input.name.trim().slice(0, 50)
  if (input.share_enabled !== undefined) {
    patch.share_enabled = input.share_enabled
    if (input.share_enabled && !patch.share_token) {
      // 第一次开启分享时生成 token
      const { generateShareToken } = await import('./share')
      patch.share_token = generateShareToken()
    }
  }

  const { data, error } = await service
    .from('restock_lists')
    .update(patch)
    .eq('list_id', listId)
    .eq('household_id', householdId)
    .select('*')
    .maybeSingle()

  if (error) throw new Error(`updateList failed: ${error.message}`)
  return (data as RestockListRow) ?? null
}

// ───────── 归档清单（不硬删） ─────────
export async function archiveList(
  listId: string,
  householdId: string
): Promise<void> {
  const supabase = (await createSupabaseServerClient()) as any
  const { error } = await supabase
    .from('restock_lists')
    .update({ status: 'archived' })
    .eq('list_id', listId)
    .eq('household_id', householdId)
  if (error) throw new Error(`archiveList failed: ${error.message}`)
}

// ───────── 加一条 ─────────
export async function addItem(
  listId: string,
  householdId: string,
  userId: string,
  input: AddItemInput
): Promise<RestockItemRow> {
  const supabase = (await createSupabaseServerClient()) as any

  // 校验 list 属于这个 household（隐式 RLS 已过滤，但显式确认更清楚）
  const { data: list } = await supabase
    .from('restock_lists')
    .select('list_id, status')
    .eq('list_id', listId)
    .eq('household_id', householdId)
    .maybeSingle()

  if (!list) throw new Error('list_not_found')
  if (list.status !== 'active') {
    throw new Error('list_not_active')
  }

  // 如果带了 item_id，拉快照字段（确保 snapshot_* 有值，未来 item 改名/删除后清单显示不变）
  let snap = {
    snapshot_name: input.custom_name ?? '',
    snapshot_brand: input.brand ?? null,
    snapshot_unit: input.unit ?? null,
  }

  if (input.item_id) {
    const { data: it } = await supabase
      .from('items')
      .select('canonical_name, brand, unit, deleted_at')
      .eq('item_id', input.item_id)
      .eq('household_id', householdId)
      .maybeSingle()
    if (it) {
      snap = {
        snapshot_name: it.canonical_name,
        snapshot_brand: input.brand ?? it.brand ?? null,
        snapshot_unit: input.unit ?? it.unit ?? null,
      }
    }
  }

  // 拿当前最大 sort_order
  const { data: maxRow } = await supabase
    .from('restock_items')
    .select('sort_order')
    .eq('list_id', listId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  const nextSort = (maxRow?.sort_order ?? -1) + 1

  const { data, error } = await supabase
    .from('restock_items')
    .insert({
      list_id: listId,
      item_id: input.item_id ?? null,
      custom_name: input.item_id ? null : input.custom_name ?? null,
      ...snap,
      needed_qty: input.needed_qty,
      bought: false,
      sort_order: nextSort,
      added_by: userId,
    })
    .select('*')
    .single()

  if (error || !data) {
    throw new Error(`addItem failed: ${error?.message ?? 'no data'}`)
  }
  return data as RestockItemRow
}

// ───────── 改一条（勾选 / 改 qty / 改名） ─────────
export async function updateItem(
  itemId: string,
  householdId: string,
  userId: string,
  input: UpdateItemInput
): Promise<RestockItemRow | null> {
  const supabase = (await createSupabaseServerClient()) as any

  // 隐式：先确认 item 属于当前 household 的 list
  const { data: existing } = await supabase
    .from('restock_items')
    .select(
      'id, list_id, restock_lists!inner(household_id, status)'
    )
    .eq('id', itemId)
    .maybeSingle()

  if (!existing) return null
  // 类型守卫：supabase join
  const ej: any = existing as any
  const hh = ej.restock_lists?.household_id
  if (hh !== householdId) return null
  if (ej.restock_lists?.status !== 'active') {
    throw new Error('list_not_active')
  }

  const patch: Record<string, unknown> = {}
  if (input.needed_qty !== undefined) patch.needed_qty = input.needed_qty
  if (input.custom_name !== undefined) {
    patch.custom_name = input.custom_name
    patch.snapshot_name = input.custom_name // 改 custom_name 同时改 snapshot
  }
  if (input.brand !== undefined) patch.snapshot_brand = input.brand
  if (input.unit !== undefined) patch.snapshot_unit = input.unit
  if (input.bought !== undefined) {
    patch.bought = input.bought
    patch.checked_at = input.bought ? new Date().toISOString() : null
    patch.checked_by = input.bought ? userId : null
  }

  const { data, error } = await supabase
    .from('restock_items')
    .update(patch)
    .eq('id', itemId)
    .select('*')
    .maybeSingle()

  if (error) throw new Error(`updateItem failed: ${error.message}`)
  return (data as RestockItemRow) ?? null
}

// ───────── 删一条 ─────────
export async function deleteItem(itemId: string): Promise<void> {
  const supabase = (await createSupabaseServerClient()) as any
  const { error } = await supabase
    .from('restock_items')
    .delete()
    .eq('id', itemId)
  if (error) throw new Error(`deleteItem failed: ${error.message}`)
}

// ───────── 重新生成 share token（轮换） ─────────
export async function regenerateShareToken(
  listId: string,
  householdId: string
): Promise<string | null> {
  const service = getServiceRoleClient() as any
  const { generateShareToken } = await import('./share')
  const newToken = generateShareToken()
  const { data, error } = await service
    .from('restock_lists')
    .update({ share_token: newToken, share_enabled: true })
    .eq('list_id', listId)
    .eq('household_id', householdId)
    .select('share_token')
    .maybeSingle()
  if (error || !data) return null
  return (data as { share_token: string }).share_token
}

// ───────── Checkout：把勾选的条目写回库存 ─────────
export interface CheckoutResult {
  list_id: string
  items_applied: number
  items_skipped: number
  events_written: number
  new_items_created: number
  total_qty_added: number
  completed_at: string
}

export async function checkout(
  listId: string,
  householdId: string,
  userId: string
): Promise<CheckoutResult> {
  const service = getServiceRoleClient() as any

  // 1. 取清单
  const { data: list, error: listErr } = await service
    .from('restock_lists')
    .select('list_id, status, household_id')
    .eq('list_id', listId)
    .maybeSingle()

  if (listErr || !list) throw new Error('list_not_found')
  if ((list as any).household_id !== householdId) throw new Error('forbidden')
  if ((list as any).status !== 'active') throw new Error('list_not_active')

  // 2. 取所有 bought=true 的 item
  const { data: boughtItems } = await service
    .from('restock_items')
    .select('*')
    .eq('list_id', listId)
    .eq('bought', true)

  const items = (boughtItems ?? []) as RestockItemRow[]

  let eventsWritten = 0
  let newItemsCreated = 0
  let totalQtyAdded = 0
  let appliedCount = 0
  let skippedCount = 0

  for (const ri of items) {
    try {
      if (ri.item_id) {
        // 已有库存：直接 +qty + 写事件
        const prev = await currentItemQty(service, ri.item_id)
        const next = prev + Number(ri.needed_qty)
        await service
          .from('items')
          .update({ quantity: next })
          .eq('item_id', ri.item_id)
        await service.from('inventory_events').insert({
          item_id: ri.item_id,
          user_id: userId,
          household_id: householdId,
          event_type: 'purchase',
          quantity_change: Number(ri.needed_qty),
          previous_quantity: prev,
          new_quantity: next,
          source: 'restock',
          metadata: {
            list_id: listId,
            restock_item_id: ri.id,
            snapshot_name: ri.snapshot_name,
          },
        })
        eventsWritten += 1
        totalQtyAdded += Number(ri.needed_qty)
        appliedCount += 1
      } else {
        // 自定义条目（无 item_id）：把它新建成 items
        const { data: created } = await service
          .from('items')
          .insert({
            household_id: householdId,
            canonical_name: ri.custom_name ?? ri.snapshot_name,
            raw_name: ri.snapshot_name,
            brand: ri.snapshot_brand,
            quantity: Number(ri.needed_qty),
            unit: ri.snapshot_unit,
          })
          .select('item_id, quantity')
          .single()

        if (created) {
          const newItemId = (created as any).item_id as string
          // 反向绑定到 restock_items（便于将来追溯）
          await service
            .from('restock_items')
            .update({ item_id: newItemId })
            .eq('id', ri.id)
          // 写事件
          await service.from('inventory_events').insert({
            item_id: newItemId,
            user_id: userId,
            household_id: householdId,
            event_type: 'purchase',
            quantity_change: Number(ri.needed_qty),
            previous_quantity: 0,
            new_quantity: Number(ri.needed_qty),
            source: 'restock',
            metadata: {
              list_id: listId,
              restock_item_id: ri.id,
              was_custom: true,
            },
          })
          eventsWritten += 1
          newItemsCreated += 1
          totalQtyAdded += Number(ri.needed_qty)
          appliedCount += 1
        } else {
          skippedCount += 1
        }
      }
    } catch (err) {
      // 单条失败不影响其它：跳过即可
      skippedCount += 1
    }
  }

  // 3. 把未勾选的 items 留作下次的参考（即不删） — MVP 默认保留
  //    如果一行 items 都没勾选，bought_count=0，也允许 checkout（取消）

  // 4. 标 list 为 completed
  const completedAt = new Date().toISOString()
  const { error: completeErr } = await service
    .from('restock_lists')
    .update({
      status: 'completed',
      completed_at: completedAt,
      completed_by: userId,
    })
    .eq('list_id', listId)
  if (completeErr) throw new Error(`checkout finalize failed: ${completeErr.message}`)

  return {
    list_id: listId,
    items_applied: appliedCount,
    items_skipped: skippedCount,
    events_written: eventsWritten,
    new_items_created: newItemsCreated,
    total_qty_added: totalQtyAdded,
    completed_at: completedAt,
  }
}

async function currentItemQty(service: any, itemId: string): Promise<number> {
  const { data } = await service
    .from('items')
    .select('quantity')
    .eq('item_id', itemId)
    .maybeSingle()
  return Number(data?.quantity ?? 0)
}
