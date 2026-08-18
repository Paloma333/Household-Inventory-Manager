/**
 * /api/r/share/[token]
 *   GET - 公开读（不需登录）一份启用了分享的 active 清单
 *
 * 安全策略：
 *   - 用 service_role 跳过 RLS（不暴露 anon policy）
 *   - 由代码校验 status='active' AND share_enabled=true
 *   - 撤销分享：owner PATCH share_enabled=false → 这里直接返回 404
 *   - 限速：MVP 先不接（V2 加 IP-based rate limit）
 */
import { NextResponse, type NextRequest } from 'next/server'
import { resolveShareToken } from '@/lib/restock/share'

type Ctx = { params: { token: string } }

export async function GET(_req: NextRequest, ctx: Ctx) {
  const token = ctx.params.token
  if (!token || token.length < 6) {
    return NextResponse.json({ error: 'invalid_token' }, { status: 400 })
  }

  try {
    const snapshot = await resolveShareToken(token)
    if (!snapshot) {
      return NextResponse.json({ error: 'not_found_or_disabled' }, { status: 404 })
    }
    return NextResponse.json({ ok: true, list: snapshot })
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 }
    )
  }
}
