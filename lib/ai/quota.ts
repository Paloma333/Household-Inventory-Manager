import 'server-only'
import { getServiceRoleClient } from '@/lib/supabase/server'

/**
 * 配额闸门 — 在调用 AI 之前判定是否放行
 *
 * 规则（可调，见 .env.local）：
 *   - MAX_DAILY_PER_HHOLD    默认 30（按家按日 success 计数）
 *   - MAX_MONTHLY_TOKENS     默认 500_000（按家按月 success 的 token 之和）
 *
 * 注意：
 *   - MOCK 模式不消耗 token，只算 success 调用次数
 *   - blocked_quota 也写一行 usage_log（透明地告诉用户今天超了）
 */

const DEFAULT_DAILY_LIMIT = 30
const DEFAULT_MONTHLY_TOKENS = 500_000

function dailyLimit() {
  const v = Number(process.env.MAX_DAILY_PER_HHOLD)
  return Number.isFinite(v) && v > 0 ? v : DEFAULT_DAILY_LIMIT
}

function monthlyTokenLimit() {
  const v = Number(process.env.MAX_MONTHLY_TOKENS)
  return Number.isFinite(v) && v > 0 ? v : DEFAULT_MONTHLY_TOKENS
}

export interface QuotaDecision {
  allowed: boolean
  reason?: 'daily_cap' | 'monthly_tokens'
  daily_used: number
  daily_limit: number
  monthly_tokens_used: number
  monthly_tokens_limit: number
}

/** 取今日 (Asia/Shanghai) 0 点 */
function todayShanghai(): string {
  // 客户端拿到本地时区即可；这里用 SQL date_trunc('day', now() at time zone 'Asia/Shanghai')
  // 直接在 SQL 里做更可靠
  return 'now()'
}

/**
 * 判定某个 household 是否还能继续调用
 * 通过一次 SQL 拿到今日调用次数 + 本月 token 消耗
 */
export async function checkQuota(householdId: string): Promise<QuotaDecision> {
  const supabase = getServiceRoleClient()

  // 今日调用次数（success only）
  const { data: dailyRows } = await supabase
    .from('v_usage_daily')
    .select('success_count')
    .eq('household_id', householdId)
    .order('day', { ascending: false })
    .limit(1)

  const daily_used =
    (Array.isArray(dailyRows) && dailyRows.length > 0 && typeof dailyRows[0]?.success_count === 'number'
      ? dailyRows[0].success_count
      : 0) || 0

  // 本月 token 消耗
  const { data: monthlyRows } = await supabase
    .from('v_usage_monthly')
    .select('tokens_used, month')
    .eq('household_id', householdId)
    .order('month', { ascending: false })
    .limit(1)

  const monthly_tokens_used =
    (Array.isArray(monthlyRows) && monthlyRows.length > 0 && typeof monthlyRows[0]?.tokens_used === 'number'
      ? monthlyRows[0].tokens_used
      : 0) || 0

  const d_limit = dailyLimit()
  const m_limit = monthlyTokenLimit()

  if (daily_used >= d_limit) {
    return {
      allowed: false,
      reason: 'daily_cap',
      daily_used,
      daily_limit: d_limit,
      monthly_tokens_used,
      monthly_tokens_limit: m_limit,
    }
  }
  if (monthly_tokens_used >= m_limit) {
    return {
      allowed: false,
      reason: 'monthly_tokens',
      daily_used,
      daily_limit: d_limit,
      monthly_tokens_used,
      monthly_tokens_limit: m_limit,
    }
  }

  return {
    allowed: true,
    daily_used,
    daily_limit: d_limit,
    monthly_tokens_used,
    monthly_tokens_limit: m_limit,
  }
}

export async function logUsage(opts: {
  userId: string
  householdId: string
  kind: 'recognition'
  tokens_used: number
  status: 'success' | 'failed' | 'blocked_quota' | 'mock'
  metadata?: Record<string, unknown>
}) {
  const supabase = getServiceRoleClient()
  const { error } = await supabase.from('usage_log').insert({
    user_id: opts.userId,
    household_id: opts.householdId,
    kind: opts.kind,
    tokens_used: opts.tokens_used,
    status: opts.status,
    metadata: opts.metadata ?? {},
  })
  return { error: error?.message ?? null }
}
