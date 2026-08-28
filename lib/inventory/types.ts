/**
 * 业务层领域类型 — PRD v1.0 §10 + §11
 * 前后端共用；Sprint 1 起会让 zod schema 自动推导 .infer<>
 */

export type InventoryEventType =
  | 'purchase'   // 入手（+）
  | 'consume'    // 消耗（-）
  | 'adjust'     // 用户手动 +/-（可能是纠错）
  | 'merge'      // 重复购买合并：归零 + 加购
  | 'restock_confirm' // 补货清单完成

export type SourceType =
  | 'manual'
  | 'ai_receipt'
  | 'ai_screenshot'
  | 'ai_camera'
  | 'restock'

export type RecognitionSourceType = 'receipt' | 'screenshot' | 'camera'

export type RecognitionStatus =
  | 'pending'
  | 'processing'
  | 'succeeded'
  | 'failed'
  | 'timeout'

export interface Item {
  item_id: string
  household_id: string
  canonical_name: string
  raw_name?: string | null
  brand?: string | null
  category_id?: string | null
  quantity: number
  unit?: string | null
  package_quantity?: number | null
  expiry_date?: string | null
  storage_location?: string | null
  deleted_at?: string | null
  created_at: string
  updated_at: string
}

export interface InventoryEvent {
  event_id: string
  item_id: string
  user_id: string
  household_id: string
  event_type: InventoryEventType
  quantity_change: number
  previous_quantity: number
  new_quantity: number
  source: SourceType
  related_event_id?: string | null
  metadata?: Record<string, unknown>
  created_at: string
}

/**
 * AI 输出 schema 形态 — 对齐 PRD v1.0 §9.2 + §9.3
 * 三档置信度：>=0.85 高 / 0.6-0.85 中 / <0.6 低
 */
export const AI_CONFIDENCE_HIGH = 0.85
export const AI_CONFIDENCE_LOW = 0.6

export type ConfidenceLevel = 'high' | 'mid' | 'low'

export function classifyConfidence(score: number): ConfidenceLevel {
  if (score >= AI_CONFIDENCE_HIGH) return 'high'
  if (score >= AI_CONFIDENCE_LOW) return 'mid'
  return 'low'
}

export interface AIItem {
  name: string
  brand?: string
  category?: string
  subcategory?: string
  quantity: number
  unit: string
  package_quantity?: number
  expiry_date?: string | null
  confidence: Partial<Record<'name' | 'quantity' | 'category' | 'expiry', number>>
}

export interface AIResult {
  items: AIItem[]
}
