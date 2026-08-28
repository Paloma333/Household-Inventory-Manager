import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createSupabaseServerClient } from '@/lib/supabase/server'

/**
 * /api/items/batch-update-category — 批量修改物品分类
 *
 * body: { item_ids: string[], category_id: string | null }
 */

const BatchUpdateCategorySchema = z.object({
  item_ids: z.array(z.string().uuid()).min(1),
  category_id: z.string().uuid().nullable(),
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

  const parsed = BatchUpdateCategorySchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json(
      { error: '字段不合法', issues: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { item_ids, category_id } = parsed.data

  const { data: household } = await supabase
    .from('households')
    .select('household_id')
    .eq('owner_id', user.id)
    .limit(1)
    .maybeSingle()

  if (!household) {
    return NextResponse.json({ error: '家还没建好' }, { status: 400 })
  }

  const { error } = await supabase
    .from('items')
    .update({ category_id })
    .in('item_id', item_ids)
    .eq('household_id', household.household_id)
    .is('deleted_at', null)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
