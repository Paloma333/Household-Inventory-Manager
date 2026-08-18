/**
 * /api/restock/[listId]/items
 *   POST - 加一条 item（item_id 或 custom_name 二选一）
 */
import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { AddItemSchema } from '@/lib/restock/types'
import { addItem } from '@/lib/restock/service'

type Ctx = { params: { listId: string } }

export async function POST(request: NextRequest, ctx: Ctx) {
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
  const parsed = AddItemSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_body', detail: parsed.error.flatten() },
      { status: 400 }
    )
  }

  try {
    const item = await addItem(
      ctx.params.listId,
      hh.household_id,
      user.id,
      parsed.data
    )
    return NextResponse.json({ ok: true, item }, { status: 201 })
  } catch (e) {
    const msg = (e as Error).message
    const code = msg === 'list_not_found' ? 404 : msg === 'list_not_active' ? 409 : 500
    return NextResponse.json({ error: msg }, { status: code })
  }
}
