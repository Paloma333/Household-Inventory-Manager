import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

/**
 * 全局中间件 — 每次请求刷新 Supabase session cookie
 * - 未登录用户访问受保护路由 → 重定向到 /login
 * - 已登录用户访问 /login /signup → 重定向到 /
 */
export async function middleware(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
     * 匹配除以下之外的全部路径：
     * - _next/static (静态文件)
     * - _next/image (图片优化)
     * - favicon.ico
     * - manifest.webmanifest
     * - public assets
     */
    '/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|icons|illustrations).*)',
  ],
}
