import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createSupabaseServerClient } from '@/lib/supabase/server'

/**
 * /api/items/[id]/rule — 低库存阈值（PRD §3.5 阈值设置）
 *
 * PUT    { threshold, enabled } — upsert low_stock_rules（按 item_id 冲突更新）
 * DELETE — 删除规则，不再提醒
 *
 * 阈值和计数单位一致（item.unit）。threshold = 0 表示「用完才提醒」
 * （不进「快用完」组，数量归 0 时进「已用完」组）。
 *
 * low_stock_rules 的 RLS 是「通过 items 隔离」（0002），用户身份可直接 upsert。
 */

const RuleSchema = z.object({
  threshold: z
    .number()
    .finite()
    .min(0, '阈值不能是负数')
    .max(9999, '阈值太大了'),
  enabled: z.boolean().default(true),
})

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

  const parsed = RuleSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? '阈值不合法' },
      { status: 400 }
    )
  }

  // 校验归属：item 必须属于当前用户 household 且未删除
  const { data: item } = await supabase
    .from('items')
    .select('item_id, household_id, quantity, unit')
    .eq('item_id', params.id)
    .is('deleted_at', null)
    .maybeSingle()

  if (!item) {
    return NextResponse.json({ error: '这件商品不存在' }, { status: 404 })
  }

  const { data: household } = await supabase
    .from('households')
    .select('household_id')
    .eq('owner_id', user.id)
    .limit(1)
    .maybeSingle()

  if (!household || household.household_id !== item.household_id) {
    return NextResponse.json({ error: '无权限' }, { status: 403 })
  }

  const { error } = await supabase.from('low_stock_rules').upsert(
    {
      item_id: item.item_id,
      threshold: parsed.data.threshold,
      enabled: parsed.data.enabled,
    },
    { onConflict: 'item_id' }
  )

  if (error) {
    return NextResponse.json(
      { error: error.message ?? '保存失败' },
      { status: 500 }
    )
  }

  return NextResponse.json({
    ok: true,
    rule: { threshold: parsed.data.threshold, enabled: parsed.data.enabled },
  })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { data: item } = await supabase
    .from('items')
    .select('item_id, household_id')
    .eq('item_id', params.id)
    .is('deleted_at', null)
    .maybeSingle()

  if (!item) {
    return NextResponse.json({ error: '这件商品不存在' }, { status: 404 })
  }

  const { data: household } = await supabase
    .from('households')
    .select('household_id')
    .eq('owner_id', user.id)
    .limit(1)
    .maybeSingle()

  if (!household || household.household_id !== item.household_id) {
    return NextResponse.json({ error: '无权限' }, { status: 403 })
  }

  const { error } = await supabase
    .from('low_stock_rules')
    .delete()
    .eq('item_id', item.item_id)

  if (error) {
    return NextResponse.json(
      { error: error.message ?? '删除失败' },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true })
}
