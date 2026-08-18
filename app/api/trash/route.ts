import { NextResponse } from 'next/server'
import {
  createSupabaseServerClient,
  getServiceRoleClient,
} from '@/lib/supabase/server'

/**
 * /api/trash — 回收站（PRD §3.11）
 *
 * GET — 当前 household 软删 items 列表（30 天内可恢复）。
 *       先做 30 天懒清理：过期软删项直接级联真删（events / low_stock_rules
 *       on delete cascade），再返回剩余列表。无需 cron，打开即自愈。
 */

const TRASH_KEEP_DAYS = 30

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
    return NextResponse.json({ items: [] })
  }

  // ── 30 天懒清理：service_role 直删（用户 RLS 下 events 无 delete policy） ──
  const cutoff = new Date(Date.now() - TRASH_KEEP_DAYS * 86400000).toISOString()
  const service = getServiceRoleClient()
  await service
    .from('items')
    .delete()
    .eq('household_id', household.household_id)
    .not('deleted_at', 'is', null)
    .lt('deleted_at', cutoff)

  const { data, error } = await supabase
    .from('items')
    .select(
      `
      item_id, canonical_name, brand, quantity, unit, deleted_at,
      categories:category_id ( name )
    `
    )
    .eq('household_id', household.household_id)
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ items: data ?? [] })
}
