import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createSupabaseServerClient } from '@/lib/supabase/server'

/**
 * /api/items/[id]/meta — 编辑 item 的元数据
 *
 *   canonical_name, brand, unit, package_quantity, expiry_date, category_id
 *
 * 只更新上述字段，不动 quantity（quantity 走 /api/items/[id] 的 PATCH）。
 * 不写 inventory_event（元数据变更是 audit，不是库存事件）。
 */

const MetaPatchSchema = z.object({
  canonical_name: z.string().trim().min(1).max(80).optional(),
  brand: z.string().trim().max(40).nullable().optional(),
  unit: z.string().trim().max(8).nullable().optional(),
  package_quantity: z.number().finite().positive().max(999).nullable().optional(),
  expiry_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  category_id: z.string().uuid().nullable().optional(),
})

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

  const parsed = MetaPatchSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json(
      { error: '字段不合法', issues: parsed.error.flatten() },
      { status: 400 }
    )
  }

  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: '没有字段需要更新' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('items')
    .update(parsed.data)
    .eq('item_id', params.id)
    .is('deleted_at', null)
    .select('item_id')
    .maybeSingle()

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? '更新失败' },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true, item_id: data.item_id })
}
