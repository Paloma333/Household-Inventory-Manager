import 'server-only'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

/**
 * 服务端 Supabase 客户端 — 绑定当前请求的 cookie
 * 用在 Server Components、API Routes（带用户身份）
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(toSet) {
          try {
            toSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          } catch {
            // Server Components 里不能写 cookie；middleware 会处理
          }
        },
      },
    }
  )
}

/**
 * Service-role 客户端 — 跳过 RLS
 * 只在以下场景用：
 * 1. 注册时把 auth.users 镜像到 public.users
 * 2. AI 识别时跨用户查 product_aliases 等
 * 3. BI 看板跨家庭聚合
 *
 * 严禁前端 import 这个文件
 */
let _serviceClient: ReturnType<typeof createClient> | null = null

export function getServiceRoleClient() {
  if (_serviceClient) return _serviceClient

  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY 未配置 — Sprint 0 用户注册 / AI route 需要这个 key'
    )
  }

  _serviceClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    key,
    {
      auth: { autoRefreshToken: false, persistSession: false },
    }
  )
  return _serviceClient
}
