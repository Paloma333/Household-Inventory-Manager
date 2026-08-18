import { NextResponse, type NextRequest } from 'next/server'
import {
  createSupabaseServerClient,
  getServiceRoleClient,
} from '@/lib/supabase/server'

/**
 * /api/trash/[itemId] — 永久删除（回收站内）
 *
 * DELETE — 真删 item（inventory_events / low_stock_rules 级联清理）。
 *          用 service_role 直删：普通用户 RLS 下的 cascade 对 events 表无 delete policy。
 */

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { itemId: string } }
) {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  // 校验归属：item 必须属于当前用户 household 且在回收站
  const { data: household } = await supabase
    .from('households')
    .select('household_id')
    .eq('owner_id', user.id)
    .limit(1)
    .maybeSingle()

  if (!household) {
    return NextResponse.json({ error: '家还没建好' }, { status: 404 })
  }

  const { data: item } = await supabase
    .from('items')
    .select('item_id')
    .eq('item_id', params.itemId)
    .eq('household_id', household.household_id)
    .not('deleted_at', 'is', null)
    .maybeSingle()

  if (!item) {
    return NextResponse.json(
      { error: '这件商品不在回收站里' },
      { status: 404 }
    )
  }

  const service = getServiceRoleClient()
  const { error } = await service
    .from('items')
    .delete()
    .eq('item_id', params.itemId)

  if (error) {
    return NextResponse.json(
      { error: error.message ?? '删除失败' },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true })
}
