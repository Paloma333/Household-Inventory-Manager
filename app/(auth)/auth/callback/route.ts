import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

/**
 * Supabase Email Magic Link / OAuth 回调
 * URL: /auth/callback?next=/path
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const supabase = await createSupabaseServerClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // 首次登录 / 注册自动建户 + user 镜像
      await fetch(`${origin}/api/bootstrap/household`, { method: 'POST' })

      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // 出错回到登录
  return NextResponse.redirect(`${origin}/login?error=auth_failed`)
}
