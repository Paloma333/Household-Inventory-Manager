'use client'

import { createBrowserClient } from '@supabase/ssr'

let _client: ReturnType<typeof createBrowserClient> | null = null

/**
 * 浏览器 Supabase 客户端 — 单例
 * 用法：在 Client Component 里 `import { getBrowserSupabase } from '@/lib/supabase/client'; const supabase = getBrowserSupabase()`
 */
export function getBrowserSupabase() {
  if (typeof window === 'undefined') {
    throw new Error('getBrowserSupabase 只能在 Client Component 用')
  }
  if (_client) return _client

  _client = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  return _client
}
