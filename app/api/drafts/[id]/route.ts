import { NextResponse, type NextRequest } from 'next/server'
import {
  createSupabaseServerClient,
  getServiceRoleClient,
} from '@/lib/supabase/server'

/**
 * /api/drafts/[id] — 放弃草稿
 *
 * DELETE — 只有 status='draft' 的任务可删；从草稿列表消失（任务记录保留）。
 */

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const service = getServiceRoleClient()

  const { data: task } = await service
    .from('recognition_tasks')
    .select('recognition_id, household_id, status')
    .eq('recognition_id', params.id)
    .maybeSingle()

  if (!task) {
    return NextResponse.json({ error: '草稿不存在' }, { status: 404 })
  }

  const { data: household } = await supabase
    .from('households')
    .select('household_id')
    .eq('owner_id', user.id)
    .limit(1)
    .maybeSingle()

  if (!household || household.household_id !== task.household_id) {
    return NextResponse.json({ error: '无权限' }, { status: 403 })
  }

  if (task.status !== 'draft') {
    return NextResponse.json({ error: '只有草稿才能放弃' }, { status: 400 })
  }

  const { error } = await service
    .from('recognition_tasks')
    .update({ status: 'discarded', saved_at: null })
    .eq('recognition_id', params.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
