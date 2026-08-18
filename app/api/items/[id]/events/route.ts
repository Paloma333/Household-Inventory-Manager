import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

/**
 * /api/items/[id]/events — 单个 item 的库存变化流水（PRD §3.5 时间轴）
 * GET：返回按 created_at desc 排序的全部 events
 */

export async function GET(
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

  const { data, error } = await supabase
    .from('inventory_events')
    .select('event_id, event_type, quantity_change, previous_quantity, new_quantity, source, metadata, created_at')
    .eq('item_id', params.id)
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ events: data ?? [] })
}
