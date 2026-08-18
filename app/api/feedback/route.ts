import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createSupabaseServerClient } from '@/lib/supabase/server'

/**
 * /api/feedback — 反馈（PRD §3.8 · 关于与反馈）
 *
 * POST { content, contact? } — 写入 feedback 表
 */

const FeedbackSchema = z.object({
  content: z.string().trim().min(1, '说点什么吧').max(2000),
  contact: z.string().trim().max(100).optional().nullable(),
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

  const parsed = FeedbackSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? '内容不合法' },
      { status: 400 }
    )
  }

  const { data: household } = await supabase
    .from('households')
    .select('household_id')
    .eq('owner_id', user.id)
    .limit(1)
    .maybeSingle()

  const { error } = await supabase.from('feedback').insert({
    user_id: user.id,
    household_id: household?.household_id ?? null,
    content: parsed.data.content,
    contact: parsed.data.contact ?? null,
  })

  if (error) {
    return NextResponse.json(
      { error: error.message ?? '提交失败' },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true })
}
