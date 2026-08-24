/**
 * AI 识别相关类型 & 公共 schema
 *
 * Qwen3.6-Flash 返回的 raw 数据 → 解析 → NormalizedItem → 三档置信度分类
 */

import { z } from 'zod'

/** 来源类型 */
export type SourceType = 'receipt' | 'screenshot' | 'camera'

/** 置信度档级 */
export type ConfidenceTier = 'high' | 'mid' | 'low'

/** 字段级置信度 */
export interface FieldConfidence {
  name: number
  quantity: number
  category: number
  unit: number
  package_quantity: number
  expiry_date: number
}

/** 标准化候选 item（一次识别的单个 SKU） */
export interface NormalizedItem {
  raw_name: string
  name: string
  brand: string | null
  quantity: number
  unit: string | null
  package_quantity: number | null
  expiry_date: string | null // YYYY-MM-DD 或 null
  category_hint: string | null // 固定枚举之一（8 大类），confirm 阶段映射到 categories 表
  restock_hint: boolean | null // AI 判断：是否易耗品（会用完需补货），用于预勾选「快用完时提醒我」
  confidence: FieldConfidence
}

/** AI 识别总结果 */
export interface RecognitionResult {
  items: NormalizedItem[]
  model: string
  tokens_used: number
  duration_ms: number
  raw_text?: string
}

/** Single zod schema — 实际解析用 */
export const normalizedItemSchema = z.object({
  raw_name: z.string().min(1).max(100),
  name: z.string().min(1).max(100),
  brand: z.string().max(50).nullable(),
  quantity: z.number().positive().max(999),
  unit: z.string().max(10).nullable(),
  package_quantity: z.number().positive().max(999).nullable(),
  expiry_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'expiry_date 须为 YYYY-MM-DD')
    .nullable(),
  category_hint: z.string().max(30).nullable(),
  restock_hint: z.boolean().nullable().optional(),
  confidence: z.object({
    name: z.number().min(0).max(1),
    quantity: z.number().min(0).max(1),
    category: z.number().min(0).max(1),
    unit: z.number().min(0).max(1),
    package_quantity: z.number().min(0).max(1),
    expiry_date: z.number().min(0).max(1),
  }),
})

export const recognitionResultSchema = z.object({
  items: z.array(normalizedItemSchema).min(0).max(50),
})

/** 把字段级置信度归并成整张卡片的档级（取最低一档） */
export function classifyTier(c: FieldConfidence): ConfidenceTier {
  const vals = [c.name, c.quantity, c.unit, c.category, c.package_quantity, c.expiry_date].filter(
    (v) => typeof v === 'number'
  )
  const min = Math.min(...vals)
  if (min >= 0.85) return 'high'
  if (min >= 0.6) return 'mid'
  return 'low'
}

/** 单字段档级（用来决定表单锁 / 灰态） */
export function fieldTier(value: number): ConfidenceTier {
  if (value >= 0.85) return 'high'
  if (value >= 0.6) return 'mid'
  return 'low'
}

/** 调用 AI 的对外接口 — 由 qwen.ts / qwen-mock.ts 实现 */
export interface AiAdapter {
  recognize(opts: {
    imageUrl: string
    sourceType: SourceType
    householdHint?: string // 提示词：家的常用品牌等，先留口
  }): Promise<RecognitionResult>
}
