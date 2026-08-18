import { NextResponse } from 'next/server'
import {
  createSupabaseServerClient,
  getServiceRoleClient,
} from '@/lib/supabase/server'

/**
 * /api/drafts — 我的草稿（PRD §3.10）
 *
 * GET — 列出 status='draft' 的识别任务（含商品数，按保存时间倒序）
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
    .select('household_id')
    .eq('owner_id', user.id)
    .limit(1)
    .maybeSingle()

  if (!household) {
    return NextResponse.json({ drafts: [] })
  }

  const service = getServiceRoleClient()

  // 草稿任务 + 每个任务的商品数（recognition_items 计数）
  const { data: tasks, error } = await service
    .from('recognition_tasks')
    .select(
      `
      recognition_id, source_type, model, status, saved_at, created_at,
      recognition_items ( recognition_item_id )
    `
    )
    .eq('household_id', household.household_id)
    .eq('status', 'draft')
    .order('saved_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const drafts = (tasks ?? []).map((t: any) => ({
    recognition_id: t.recognition_id,
    source_type: t.source_type,
    model: t.model,
    saved_at: t.saved_at,
    created_at: t.created_at,
    item_count: (t.recognition_items ?? []).length,
  }))

  return NextResponse.json({ drafts })
}
