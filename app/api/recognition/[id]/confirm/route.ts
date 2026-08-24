import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import {
  createSupabaseServerClient,
  getServiceRoleClient,
} from '@/lib/supabase/server'

/**
 * /api/recognition/[id]/confirm — 把识别 items 真正落到 inventory
 *
 * 三分支语义（PRD §11.2）：
 *   - skip                  → 丢弃
 *   - keep_separate         → 新建一个 item，写一条 purchase event
 *   - merge + matched_item_id → 在现有 item 上 +quantity，写一条 merge event
 *
 * Body:
 * {
 *   decisions: [{
 *     recognition_item_id,
 *     action: 'skip' | 'keep_separate' | 'merge',
 *     final_name, final_quantity, final_unit, final_brand,
 *     final_category_id, final_package_quantity, final_expiry_date,
 *     matched_item_id?,  // merge 必须
 *     corrected?,        // 用户编辑过字段，埋点用
 *   }]
 * }
 *
 * 响应：
 * {
 *   ok: true,
 *   summary: { new_items: int, merged: int, skipped: int },
 *   item_ids: [uuid...],  // 新建/合并的 item_id
 * }
 */

const DecisionSchema = z.object({
  recognition_item_id: z.string().uuid(),
  action: z.enum(['skip', 'keep_separate', 'merge']),
  final_name: z.string().trim().min(1).max(80),
  final_quantity: z.number().finite().min(0).max(9999),
  final_unit: z.string().trim().max(8).nullable().optional(),
  final_brand: z.string().trim().max(40).nullable().optional(),
  final_category_id: z.string().uuid().nullable().optional(),
  final_package_quantity: z.number().finite().positive().nullable().optional(),
  final_expiry_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  matched_item_id: z.string().uuid().nullable().optional(),
  corrected: z.boolean().optional(),
  // 「快用完时提醒我」开关：勾选 → 为该 item 建 low_stock_rule（threshold=1）
  restock_alert: z.boolean().optional(),
})

const BodySchema = z.object({
  decisions: z.array(DecisionSchema).min(1).max(100),
})

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const recognitionId = params.id

  const supabase = (await createSupabaseServerClient()) as any
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
  const parsed = BodySchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'decisions 字段不合法', issues: parsed.error.flatten() },
      { status: 400 }
    )
  }
  const { decisions } = parsed.data

  const service = getServiceRoleClient() as any

  // 取任务：求 source_type + 校验归属
  const { data: task, error: taskErr } = await service
    .from('recognition_tasks')
    .select('recognition_id, household_id, source_type, status')
    .eq('recognition_id', recognitionId)
    .maybeSingle()

  if (taskErr || !task) {
    return NextResponse.json({ error: 'task 不存在' }, { status: 404 })
  }

  const { data: hh } = await service
    .from('households')
    .select('household_id')
    .eq('owner_id', user.id)
    .limit(1)
    .maybeSingle()

  if (!hh || hh.household_id !== task.household_id) {
    return NextResponse.json({ error: '无权限' }, { status: 403 })
  }

  const householdId = hh.household_id

  // 已 confirm 过？防双重提交
  if (task.status === 'confirmed') {
    return NextResponse.json({ error: '该批次已确认过' }, { status: 409 })
  }

  // 取得所有相关 recognition_items 一次性备用
  const itemIds = decisions.map((d) => d.recognition_item_id)
  const { data: recogItems } = await service
    .from('recognition_items')
    .select('recognition_item_id')
    .in('recognition_item_id', itemIds)

  const validIds = new Set((recogItems ?? []).map((r: any) => r.recognition_item_id))

  // source 字段映射
  const source =
    task.source_type === 'receipt'
      ? 'ai_receipt'
      : task.source_type === 'screenshot'
      ? 'ai_screenshot'
      : task.source_type === 'camera'
      ? 'ai_camera'
      : 'ai_receipt'

  let newItems = 0
  let mergedItems = 0
  let skippedItems = 0
  const touchedItemIds: string[] = []

  // 「快用完时提醒我」→ 建 low_stock_rule（幂等 upsert，threshold 默认 1）
  async function ensureRestockRule(itemId: string, enabled?: boolean) {
    if (!enabled) return
    await service
      .from('low_stock_rules')
      .upsert({ item_id: itemId, threshold: 1, enabled: true }, { onConflict: 'item_id' })
  }

  for (const d of decisions) {
    if (!validIds.has(d.recognition_item_id)) {
      // 越界 id 跳过
      skippedItems++
      continue
    }

    // —— 1. skip ——
    if (d.action === 'skip') {
      skippedItems++
      continue
    }

    // —— 2. keep_separate ——
    if (d.action === 'keep_separate') {
      // insert item
      const { data: created, error: insErr } = await service
        .from('items')
        .insert({
          household_id: householdId,
          canonical_name: d.final_name,
          raw_name: d.final_name,
          brand: d.final_brand ?? null,
          quantity: d.final_quantity,
          unit: d.final_unit ?? null,
          package_quantity: d.final_package_quantity ?? null,
          category_id: d.final_category_id ?? null,
          expiry_date: d.final_expiry_date ?? null,
        })
        .select('item_id, quantity')
        .single()

      if (insErr || !created) {
        // 写一行 failed 埋点？先跳过
        continue
      }

      // 写 inventory_event
      await service.from('inventory_events').insert({
        item_id: created.item_id,
        user_id: user.id,
        household_id: householdId,
        event_type: 'purchase',
        quantity_change: d.final_quantity,
        previous_quantity: 0,
        new_quantity: d.final_quantity,
        source,
        metadata: {
          recognition_id: recognitionId,
          recognition_item_id: d.recognition_item_id,
          corrected: d.corrected ?? false,
        },
      })

      // 回填 recognition_items.final_*
      await service
        .from('recognition_items')
        .update({
          final_name: d.final_name,
          final_quantity: d.final_quantity,
          final_unit: d.final_unit ?? null,
          final_package_quantity: d.final_package_quantity ?? null,
          final_category_id: d.final_category_id ?? null,
          corrected: d.corrected ?? false,
        })
        .eq('recognition_item_id', d.recognition_item_id)

      // 快用完提醒（勾选了才建规则）
      await ensureRestockRule(created.item_id, d.restock_alert)

      newItems++
      touchedItemIds.push(created.item_id)
      continue
    }

    // —— 3. merge ——
    if (d.action === 'merge') {
      if (!d.matched_item_id) {
        // 没有 matched_item_id 就退化到 keep_separate
        // (用更简单的逻辑：写入一个新 item)
        const { data: created, error: insErr } = await service
          .from('items')
          .insert({
            household_id: householdId,
            canonical_name: d.final_name,
            raw_name: d.final_name,
            brand: d.final_brand ?? null,
            quantity: d.final_quantity,
            unit: d.final_unit ?? null,
            package_quantity: d.final_package_quantity ?? null,
            category_id: d.final_category_id ?? null,
            expiry_date: d.final_expiry_date ?? null,
          })
          .select('item_id, quantity')
          .single()
        if (!insErr && created) {
          await service.from('inventory_events').insert({
            item_id: created.item_id,
            user_id: user.id,
            household_id: householdId,
            event_type: 'purchase',
            quantity_change: d.final_quantity,
            previous_quantity: 0,
            new_quantity: d.final_quantity,
            source,
            metadata: {
              recognition_id: recognitionId,
              recognition_item_id: d.recognition_item_id,
              corrected: d.corrected ?? false,
              note: 'merge_no_target_fallback_new',
            },
          })
          await service
            .from('recognition_items')
            .update({
              final_name: d.final_name,
              final_quantity: d.final_quantity,
              final_unit: d.final_unit ?? null,
              final_package_quantity: d.final_package_quantity ?? null,
              final_category_id: d.final_category_id ?? null,
              corrected: d.corrected ?? false,
            })
            .eq('recognition_item_id', d.recognition_item_id)
          await ensureRestockRule(created.item_id, d.restock_alert)
          newItems++
          touchedItemIds.push(created.item_id)
        }
        continue
      }

      // 真实 merge：拿旧 quantity + 增加
      const { data: existing, error: exErr } = await service
        .from('items')
        .select('item_id, quantity')
        .eq('item_id', d.matched_item_id)
        .eq('household_id', householdId)
        .is('deleted_at', null)
        .maybeSingle()

      if (exErr || !existing) {
        skippedItems++
        continue
      }

      const previousQ = Number(existing.quantity) || 0
      const newQ = previousQ + d.final_quantity

      await service
        .from('items')
        .update({ quantity: newQ })
        .eq('item_id', existing.item_id)

      await service.from('inventory_events').insert({
        item_id: existing.item_id,
        user_id: user.id,
        household_id: householdId,
        event_type: 'merge',
        quantity_change: d.final_quantity,
        previous_quantity: previousQ,
        new_quantity: newQ,
        source,
        metadata: {
          recognition_id: recognitionId,
          recognition_item_id: d.recognition_item_id,
          corrected: d.corrected ?? false,
        },
      })

      await service
        .from('recognition_items')
        .update({
          final_name: d.final_name,
          final_quantity: d.final_quantity,
          final_unit: d.final_unit ?? null,
          final_package_quantity: d.final_package_quantity ?? null,
          final_category_id: d.final_category_id ?? null,
          corrected: d.corrected ?? false,
        })
        .eq('recognition_item_id', d.recognition_item_id)

      mergedItems++
      touchedItemIds.push(existing.item_id)

      // merge 也支持「快用完时提醒我」（对既有 item 建规则）
      await ensureRestockRule(existing.item_id, d.restock_alert)
    }
  }

  // 标记 task 为 confirmed
  await service
    .from('recognition_tasks')
    .update({ status: 'confirmed' })
    .eq('recognition_id', recognitionId)

  return NextResponse.json({
    ok: true,
    summary: { new_items: newItems, merged: mergedItems, skipped: skippedItems },
    item_ids: touchedItemIds,
  })
}
