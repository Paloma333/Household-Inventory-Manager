import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { checkQuota } from '@/lib/ai/quota'
import { getDashScopeKey } from '@/lib/ai/qwen'

/**
 * /api/admin/quota — 当前 household 的配额使用情况
 *
 * 响应：
 * {
 *   daily: { used, limit, remaining },
 *   monthly: { tokens_used, tokens_limit },
 *   mock_mode: bool
 * }
 */

export async function GET() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { data: hh } = await supabase
    .from('households')
    .select('household_id')
    .eq('owner_id', user.id)
    .limit(1)
    .maybeSingle()

  if (!hh) {
    return NextResponse.json({ error: 'household_not_ready' }, { status: 400 })
  }

  const quota = await checkQuota(hh.household_id)

  return NextResponse.json({
    daily: {
      used: quota.daily_used,
      limit: quota.daily_limit,
      remaining: Math.max(0, quota.daily_limit - quota.daily_used),
    },
    monthly: {
      tokens_used: quota.monthly_tokens_used,
      tokens_limit: quota.monthly_tokens_limit,
    },
    mock_mode: !getDashScopeKey() || process.env.MOCK_AI === '1',
  })
}
