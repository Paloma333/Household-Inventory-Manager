import { NextResponse, type NextRequest } from 'next/server'
import { getServiceRoleClient } from '@/lib/supabase/server'

/**
 * 埋点写入端点 — PRD v1.0 §12
 *
 * POST /api/analytics/log
 * body: { event_name, properties?, session_id?, client_ts? }
 *
 * 客户端 SDK 通过 fetch + navigator.sendBeacon 写入。
 * 用 service_role 写入以跨过"events" RLS（用户没 household 时也能写）。
 */
export async function POST(request: NextRequest) {
  let body: {
    event_name?: string
    properties?: Record<string, unknown>
    session_id?: string
    client_ts?: string
    user_id?: string
    household_id?: string
  } = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  const eventName = body.event_name
  if (!eventName || typeof eventName !== 'string') {
    return NextResponse.json({ error: 'event_name required' }, { status: 400 })
  }

  const service = getServiceRoleClient()

  const { error } = await service.from('events').insert({
    user_id: body.user_id ?? null,
    household_id: body.household_id ?? null,
    session_id: body.session_id ?? null,
    event_name: eventName,
    properties: body.properties ?? {},
    client_ts: body.client_ts ?? new Date().toISOString(),
  })

  if (error) {
    return NextResponse.json(
      { error: 'insert failed', detail: error.message },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true })
}
