import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import {
  createSupabaseServerClient,
  getServiceRoleClient,
} from '@/lib/supabase/server'

/**
 * /api/items/[id] — 单个 item 的调整 / 软删
 *
 * GET    — 拉单条 item + 关联分类
 * PATCH  — 调整数量（+n / -n），写一条 inventory_event（event_type=adjust）
 *          body: { delta: number, absolute?: number }
 *          默认走 delta（步进模式）；绝对值写法给表单兜底
 * DELETE — 软删除（deleted_at = now()）
 */

const AdjustSchema = z
  .object({
    delta: z.number().finite().optional(),
    absolute: z.number().finite().min(0).optional(),
    event_type: z.enum(['adjust', 'consume', 'purchase']).default('adjust'),
  })
  .refine((d) => d.delta !== undefined || d.absolute !== undefined, {
    message: 'delta 或 absolute 二选一',
  })

export async function GET(
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

  const { data, error } = await supabase
    .from('items')
    .select(
      `
      item_id, household_id, canonical_name, brand, quantity, unit,
      package_quantity, expiry_date, created_at, updated_at, deleted_at,
      category_id,
      categories:category_id ( name, parent_id )
    `
    )
    .eq('item_id', params.id)
    .is('deleted_at', null)
    .maybeSingle()

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? 'not found' }, { status: 404 })
  }

  return NextResponse.json({ item: data })
}

export async function PATCH(
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

  const parsed = AdjustSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json(
      { error: '字段不合法', issues: parsed.error.flatten() },
      { status: 400 }
    )
  }
  const body = parsed.data

  // 拉当前 item（必须未删 + 同 household）
  const { data: current, error: getError } = await supabase
    .from('items')
    .select('item_id, household_id, quantity')
    .eq('item_id', params.id)
    .is('deleted_at', null)
    .maybeSingle()

  if (getError || !current) {
    return NextResponse.json({ error: 'item 不存在' }, { status: 404 })
  }

  const previous = current.quantity
  const next =
    body.absolute !== undefined
      ? body.absolute
      : Math.max(0, previous + (body.delta as number))

  // 写 inventory_events（事前记）
  const { error: eventError } = await supabase.from('inventory_events').insert({
    item_id: current.item_id,
    user_id: user.id,
    household_id: current.household_id,
    event_type: body.event_type,
    quantity_change: next - previous,
    previous_quantity: previous,
    new_quantity: next,
    source: 'manual',
    metadata: body.absolute !== undefined ? { mode: 'absolute' } : { mode: 'delta', delta: body.delta },
  })

  if (eventError) {
    return NextResponse.json(
      { error: '事件写入失败：' + eventError.message },
      { status: 500 }
    )
  }

  // 更新 items.quantity（updated_at 触发器自动更新）
  const { data: updated, error: updateError } = await supabase
    .from('items')
    .update({ quantity: next })
    .eq('item_id', current.item_id)
    .select('item_id, quantity')
    .single()

  if (updateError || !updated) {
    // 回滚事件
    const service = getServiceRoleClient()
    await service
      .from('inventory_events')
      .delete()
      .eq('item_id', current.item_id)
      .eq('previous_quantity', previous)
      .eq('new_quantity', next)
    return NextResponse.json(
      { error: '更新失败，已回滚事件' },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true, quantity: updated.quantity })
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

  const { data, error } = await supabase
    .from('items')
    .update({ deleted_at: new Date().toISOString() })
    .eq('item_id', params.id)
    .is('deleted_at', null)
    .select('item_id')
    .maybeSingle()

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? '删除失败' },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true, item_id: data.item_id })
}
