/**
 * 手动写的 Row types — 等 Sprint X 接 supabase gen types 再替换
 *
 * 这么写是因为 @supabase/supabase-js 在没有 Database generic 时返回 unknown
 * 影响 typecheck。我们只为 Sprint 2 用到的表写一份，不动 Sprint 1。
 *
 * 用到的表：
 *   - recognition_tasks
 *   - recognition_items
 *   - v_usage_daily / v_usage_monthly（view，由 SQL 提供聚合）
 *   - items / inventory_events（复用 Sprint 1 的推断，暂时不强写）
 */

export interface RecognitionTaskRow {
  recognition_id: string
  user_id: string
  household_id: string
  source_type: 'receipt' | 'screenshot' | 'camera'
  image_url: string | null
  status: 'pending' | 'processing' | 'succeeded' | 'failed' | 'timeout' | 'confirmed'
  model: string | null
  processing_time_ms: number | null
  error_message: string | null
  created_at: string
}

export interface RecognitionItemRow {
  recognition_item_id: string
  recognition_id: string
  raw_name: string | null
  predicted_name: string | null
  predicted_quantity: number | null
  predicted_unit: string | null
  predicted_package_quantity: number | null
  confidence_json: {
    name: number
    quantity: number
    category: number
    unit: number
    package_quantity: number
    expiry_date: number
  }
  final_name: string | null
  final_quantity: number | null
  final_unit: string | null
  final_category_id: string | null
  final_package_quantity: number | null
  corrected: boolean
  created_at: string
}

export interface UsageLogRow {
  log_id: string
  user_id: string
  household_id: string
  kind: 'recognition' | 'chat' | 'correction'
  tokens_used: number
  status: 'success' | 'failed' | 'blocked_quota' | 'mock'
  metadata: Record<string, unknown>
  called_at: string
}

export interface UsageDailyRow {
  household_id: string
  day: string
  success_count: number
  blocked_count: number
  tokens_used: number
}

export interface UsageMonthlyRow {
  household_id: string
  month: string
  tokens_used: number
  success_count: number
}

export interface DuplicateMatchedItem {
  item_id: string
  canonical_name: string
  brand: string | null
  quantity: number
  unit: string | null
}
