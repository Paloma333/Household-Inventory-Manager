import { NextResponse } from 'next/server'
import {
  createSupabaseServerClient,
  getServiceRoleClient,
} from '@/lib/supabase/server'

/**
 * 首次登录（邮箱/OAuth 回调或注册成功）→ 把 auth.users 镜像到 public.users，
 * 并自动建第一个 household。
 * 用 service_role 写入以绕开 RLS（user 还没 household）。
 */
export async function POST() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const service = getServiceRoleClient()

  // 1) upsert public.users
  const accountId = user.email || user.id
  await service.from('users').upsert(
    {
      user_id: user.id,
      account_id: accountId,
      platform: 'web',
      display_name:
        (user.user_metadata?.display_name as string | undefined) ||
        accountId.split('@')[0],
      last_active_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  )

  // 2) 检查并创建 household
  const { data: existing } = await service
    .from('households')
    .select('household_id')
    .eq('owner_id', user.id)
    .maybeSingle()

  if (!existing) {
    await service.from('households').insert({
      owner_id: user.id,
      name: '我的小家',
      timezone: 'GMT+8',
    })
  }

  return NextResponse.json({ ok: true, user_id: user.id })
}
