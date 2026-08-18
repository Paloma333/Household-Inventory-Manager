/**
 * /api/restock/[listId]/checkout
 *   POST - 把勾选的 items 写回库存（items.quantity += needed_qty），
 *          并写 inventory_events（event_type='purchase', source='restock'）。
 *          custom_name 条目会自动新建到 items。
 *          完成后 list.status='completed'。
 */
import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { checkout } from '@/lib/restock/service'

type Ctx = { params: { listId: string } }

export async function POST(_req: NextRequest, ctx: Ctx) {
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
    const result = await checkout(ctx.params.listId, hh.household_id, user.id)
    return NextResponse.json({ ok: true, ...result })
  } catch (e) {
    const msg = (e as Error).message
    const code =
      msg === 'list_not_found'
        ? 404
        : msg === 'forbidden'
        ? 403
        : msg === 'list_not_active'
        ? 409
        : 500
    return NextResponse.json({ error: msg }, { status: code })
  }
}
