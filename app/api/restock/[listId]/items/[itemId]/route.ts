/**
 * /api/restock/[listId]/items/[itemId]
 *   PATCH - 改一条 item（勾选 / 改 qty / 改名 / 改品牌单位）
 *   DELETE - 删除一条
 */
import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { UpdateItemSchema } from '@/lib/restock/types'
import { deleteItem, updateItem } from '@/lib/restock/service'

type Ctx = { params: { listId: string; itemId: string } }

export async function PATCH(request: NextRequest, ctx: Ctx) {
  const supabase = (await createSupabaseServerClient()) as any
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { data: hh } = await supabase
    .from('households')
    .select('household_id')
    .eq('owner_id', user.id)
    .limit(1)
    .maybeSingle()
  if (!hh) {
    return NextResponse.json({ error: 'household_not_ready' }, { status: 400 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }
  const parsed = UpdateItemSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_body', detail: parsed.error.flatten() },
      { status: 400 }
    )
  }

  try {
    const item = await updateItem(
      ctx.params.itemId,
      hh.household_id,
      user.id,
      parsed.data
    )
    if (!item) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 })
    }
    return NextResponse.json({ ok: true, item })
  } catch (e) {
    const msg = (e as Error).message
    const code =
      msg === 'list_not_active'
        ? 409
        : msg === 'forbidden'
        ? 403
        : 500
    return NextResponse.json({ error: msg }, { status: code })
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const supabase = (await createSupabaseServerClient()) as any
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { data: hh } = await supabase
    .from('households')
    .select('household_id')
    .eq('owner_id', user.id)
    .limit(1)
    .maybeSingle()
  if (!hh) {
    return NextResponse.json({ error: 'household_not_ready' }, { status: 400 })
  }

  try {
    await deleteItem(ctx.params.itemId)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 }
    )
  }
}
