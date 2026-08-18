/**
 * lib/restock/types.ts
 * 补货清单相关的类型 + zod schemas
 * Sprint 3 — PRD §3.7
 */
import { z } from 'zod'

// ───────── DB row 类型 ─────────
export type RestockListStatus = 'active' | 'completed' | 'archived'

export interface RestockListRow {
  list_id: string
  household_id: string
  created_by: string
  name: string
  status: RestockListStatus
  share_token: string | null
  share_enabled: boolean
  completed_at: string | null
  completed_by: string | null
  created_at: string
  updated_at: string
}

export interface RestockItemRow {
  id: string
  list_id: string
  item_id: string | null
  custom_name: string | null
  snapshot_name: string
  snapshot_brand: string | null
  snapshot_unit: string | null
  needed_qty: number
  bought: boolean
  checked_at: string | null
  checked_by: string | null
  sort_order: number
  added_by: string
  created_at: string
}

// 对外返回（含计算字段）
export interface RestockItem extends RestockItemRow {
  // 自关联，当前 item 的可读字段（供前端展示）
  current_item_quantity?: number | null
  current_item_expiry?: string | null
}

export interface RestockList extends RestockListRow {
  items: RestockItem[]
  item_count: number
  bought_count: number
}

// ───────── 建议（suggest）── ─────────
export type SuggestGroupKey = 'out_of_stock' | 'low_stock' | 'expiring_soon'

export interface SuggestItem {
  item_id: string
  canonical_name: string
  brand: string | null
  quantity: number
  unit: string | null
  threshold: number | null
  expiry_date: string | null
  category_id: string | null
  reason: string // 人类可读
}

export interface SuggestGroup {
  key: SuggestGroupKey
  title: string
  count: number
  items: SuggestItem[]
}

export interface SuggestResult {
  out_of_stock: SuggestGroup
  low_stock: SuggestGroup
  expiring_soon: SuggestGroup
  total: number
}

// ───────── API 请求/响应 schemas ─────────
export const CreateListSchema = z.object({
  name: z.string().min(1).max(50).optional(),
})

export const UpdateListSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  share_enabled: z.boolean().optional(),
})

export const AddItemSchema = z
  .object({
    item_id: z.string().uuid().optional(),
    custom_name: z.string().min(1).max(80).optional(),
    brand: z.string().max(40).optional(),
    unit: z.string().max(20).optional(),
    needed_qty: z.number().positive().max(9999).default(1),
  })
  .refine((data) => data.item_id || data.custom_name, {
    message: 'item_id 或 custom_name 必须有一个',
  })

export const UpdateItemSchema = z.object({
  needed_qty: z.number().positive().max(9999).optional(),
  custom_name: z.string().min(1).max(80).optional(),
  brand: z.string().max(40).optional(),
  unit: z.string().max(20).optional(),
  bought: z.boolean().optional(),
})

export type AddItemInput = z.infer<typeof AddItemSchema>
export type UpdateItemInput = z.infer<typeof UpdateItemSchema>
export type CreateListInput = z.infer<typeof CreateListSchema>
export type UpdateListInput = z.infer<typeof UpdateListSchema>
