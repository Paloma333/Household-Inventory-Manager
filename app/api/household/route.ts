import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createSupabaseServerClient } from '@/lib/supabase/server'

/**
 * /api/household — 小屋信息
 *
 * GET   — 当前 household（名称 / 创建时间 / item 数）
 * PATCH — 改小屋名（PRD §3.8：最多 12 字）
 */

export async function GET() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { data: household } = await supabase
    .from('households')
    .select('household_id, name, created_at')
    .eq('owner_id', user.id)
    .limit(1)
    .maybeSingle()

  if (!household) {
    return NextResponse.json({ error: '家还没建好' }, { status: 404 })
  }

  const { count } = await supabase
    .from('items')
    .select('*', { count: 'exact', head: true })
    .eq('household_id', household.household_id)
    .is('deleted_at', null)

  return NextResponse.json({
    household: {
      household_id: household.household_id,
      name: household.name,
      created_at: household.created_at,
      item_count: count ?? 0,
    },
  })
}

const RenameSchema = z.object({
  name: z.string().trim().min(1, '名字不能为空').max(12, '最多 12 个字'),
})

export async function PATCH(request: NextRequest) {
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

  const parsed = RenameSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? '名字不合法' },
      { status: 400 }
    )
  }

  const { data: household } = await supabase
    .from('households')
    .select('household_id')
    .eq('owner_id', user.id)
    .limit(1)
    .maybeSingle()

  if (!household) {
    return NextResponse.json({ error: '家还没建好' }, { status: 404 })
  }

  const { data: updated, error } = await supabase
    .from('households')
    .update({ name: parsed.data.name })
    .eq('household_id', household.household_id)
    .select('name')
    .single()

  if (error || !updated) {
    return NextResponse.json(
      { error: error?.message ?? '改名失败' },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true, name: updated.name })
}
