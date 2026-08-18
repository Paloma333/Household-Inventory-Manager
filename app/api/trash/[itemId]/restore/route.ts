import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

/**
 * /api/trash/[itemId]/restore — 从回收站恢复
 *
 * POST — deleted_at 置空，商品回到库存
 */

export async function POST(
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

  const { data, error } = await supabase
    .from('items')
    .update({ deleted_at: null })
    .eq('item_id', params.itemId)
    .not('deleted_at', 'is', null)
    .select('item_id, canonical_name')
    .maybeSingle()

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? '恢复失败，或这件商品不在了' },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true, item_id: data.item_id })
}
