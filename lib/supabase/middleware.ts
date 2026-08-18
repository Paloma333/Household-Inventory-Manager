import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * 刷新 Supabase 会话 + 强制重定向规则
 *
 * 路径分流：
 *   - /api/*        → 透传。各 API route 自己处理 401。
 *   - 未登录访问 (app)/* 或 (auth)/* 之外的受保护路径 → 跳转 /login
 *   - 已登录访问 /login 或 /signup → 跳转 /
 */
const PUBLIC_PATHS = new Set(['/login', '/signup', '/auth/callback', '/about'])

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(toSet) {
          toSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          response = NextResponse.next({
            request,
          })
          toSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: 这会触发 SSR session 刷新，确保 RLS 用最新 session
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname

  // API routes 走自己的 401，不被 middleware 重定向
  if (pathname.startsWith('/api/')) {
    return response
  }

  const isPublic =
    PUBLIC_PATHS.has(pathname) ||
    pathname.startsWith('/auth/')

  // 已登录访问 login/signup → 跳首页
  if (user && (pathname === '/login' || pathname === '/signup')) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  // 未登录访问受保护路径 → 跳 login
  if (!user && !isPublic) {
    const redirectUrl = new URL('/login', request.url)
    redirectUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(redirectUrl)
  }

  return response
}
