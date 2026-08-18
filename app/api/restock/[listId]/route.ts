/**
 * /api/restock/[listId]
 *   GET    - 取一个清单（含 items）
 *   PATCH  - 改名 / 切分享开关（首次开启 → 生成 share_token）
 *   DELETE - 归档（status='archived'）
 */
import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { UpdateListSchema } from '@/lib/restock/types'
import { archiveList, getList, updateList } from '@/lib/restock/service'

type Ctx = { params: { listId: string } }

async function getUserHousehold(): Promise<
  { userId: string; householdId: string } | { error: NextResponse }
> {
  const supabase = (await createSupabaseServerClient()) as any
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'unauthorized' }, { status: 401 }) }
  const { data: hh } = await supabase
    .from('households')
    .select('household_id')
    .eq('owner_id', user.id)
    .limit(1)
    .maybeSingle()
  if (!hh) {
    return { error: NextResponse.json({ error: 'household_not_ready' }, { status: 400 }) }
  }
  return { userId: user.id, householdId: hh.household_id }
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  const auth = await getUserHousehold()
  if ('error' in auth) return auth.error

  const list = await getList(ctx.params.listId, auth.householdId)
  if (!list) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }
  return NextResponse.json({ ok: true, list })
}

export async function PATCH(request: NextRequest, ctx: Ctx) {
  const auth = await getUserHousehold()
  if ('error' in auth) return auth.error

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }
  const parsed = UpdateListSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_body', detail: parsed.error.flatten() },
      { status: 400 }
    )
  }

  try {
    const list = await updateList(ctx.params.listId, auth.householdId, parsed.data)
    if (!list) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 })
    }
    return NextResponse.json({ ok: true, list })
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 }
    )
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const auth = await getUserHousehold()
  if ('error' in auth) return auth.error

  try {
    await archiveList(ctx.params.listId, auth.householdId)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 }
    )
  }
}
