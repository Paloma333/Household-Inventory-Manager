/**
 * /api/restock/suggest
 *   GET - 拿当前家庭的三分组建议（已用完 / 快用完 / 快过期）
 */
import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { computeSuggest } from '@/lib/restock/suggest'

export async function GET(request: NextRequest) {
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

  const limit = Math.min(
    Math.max(
      parseInt(request.nextUrl.searchParams.get('limit') ?? '8', 10) || 8,
      1
    ),
    20
  )

  const result = await computeSuggest(hh.household_id, limit)
  return NextResponse.json({ ok: true, suggest: result })
}
