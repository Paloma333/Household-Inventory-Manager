import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import {
  createSupabaseServerClient,
  getServiceRoleClient,
} from '@/lib/supabase/server'

/**
 * /api/items — Sprint 1 库存主接口
 *
 * GET  — 当前 household 全部未删除 items
 * POST — 创建 item（必写一条 inventory_event）
 *
 * 写策略：
 *   - 用 supabase-js 用户身份走 RLS（husband 隔离）
 *   - items 与 inventory_events 在事务/同步语义里两步写
 *   - 任何一步失败 → service_role 软删 item 防御性回滚
 */

export async function GET() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { data: households } = await supabase
    .from('households')
    .select('household_id')
    .eq('owner_id', user.id)
    .limit(1)
    .maybeSingle()

  if (!households) {
    return NextResponse.json({ items: [] })
  }

  // 关联 category 名 → 一次 join 把名字带回来，避免 N+1
  const { data, error } = await supabase
    .from('items')
    .select(
      `
      item_id, canonical_name, brand, quantity, unit, expiry_date, storage_location, created_at, updated_at,
      category_id,
      categories:category_id ( name, parent_id ),
      low_stock_rules ( threshold, enabled )
    `
    )
    .eq('household_id', households.household_id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ items: data ?? [] })
}

const CreateItemSchema = z.object({
  canonical_name: z.string().trim().min(1, '名字不能空').max(80),
  quantity: z.number().finite().min(0).default(1),
  unit: z.string().trim().max(8).optional().nullable(),
  brand: z.string().trim().max(40).optional().nullable(),
  storage_location: z.string().trim().max(80).optional().nullable(),
  category_id: z.string().uuid().optional().nullable(),
  expiry_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '日期格式应为 YYYY-MM-DD').optional().nullable(),
  package_quantity: z.number().finite().positive().optional().nullable(),
  // 「快用完时提醒我」：勾选 → 建 low_stock_rule（threshold=1）
  restock_alert: z.boolean().optional(),
  // 这次是"买入"还是"调整"？默认 purchase（首次入手）
  initial_event_type: z.enum(['purchase', 'adjust']).default('purchase'),
})

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  const parsed = CreateItemSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json(
      { error: '字段不合法', issues: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const body = parsed.data

  const { data: household } = await supabase
    .from('households')
    .select('household_id')
    .eq('owner_id', user.id)
    .limit(1)
    .maybeSingle()

  if (!household) {
    return NextResponse.json(
      { error: '家还没建好，请刷新页面' },
      { status: 400 }
    )
  }

  // 写 items
  const { data: item, error: insertError } = await supabase
    .from('items')
    .insert({
      household_id: household.household_id,
      canonical_name: body.canonical_name,
      quantity: body.quantity,
      unit: body.unit ?? null,
      brand: body.brand ?? null,
      storage_location: body.storage_location ?? null,
      category_id: body.category_id ?? null,
      expiry_date: body.expiry_date ?? null,
      package_quantity: body.package_quantity ?? null,
    })
    .select('item_id, canonical_name, quantity')
    .single()

  if (insertError || !item) {
    return NextResponse.json(
      { error: insertError?.message ?? '插入失败' },
      { status: 500 }
    )
  }

  // 写 inventory_events（quantity_change = quantity, previous_quantity = 0）
  const { error: eventError } = await supabase.from('inventory_events').insert({
    item_id: item.item_id,
    user_id: user.id,
    household_id: household.household_id,
    event_type: body.initial_event_type,
    quantity_change: body.quantity,
    previous_quantity: 0,
    new_quantity: body.quantity,
    source: 'manual',
    metadata: { created_via: 'sprint1_manual_form' },
  })

  if (eventError) {
    // 防御性回滚
    const service = getServiceRoleClient()
    await service
      .from('items')
      .update({ deleted_at: new Date().toISOString() })
      .eq('item_id', item.item_id)
    return NextResponse.json(
      { error: 'event 写入失败，已回滚' },
      { status: 500 }
    )
  }

  // 「快用完时提醒我」→ 建 low_stock_rule（勾选才建，不勾绝不提示「少」）
  if (body.restock_alert) {
    await supabase
      .from('low_stock_rules')
      .upsert(
        { item_id: item.item_id, threshold: 1, enabled: true },
        { onConflict: 'item_id' }
      )
  }

  return NextResponse.json({
    ok: true,
    item: {
      item_id: item.item_id,
      canonical_name: item.canonical_name,
      quantity: item.quantity,
    },
  })
}
