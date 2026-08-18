/**
 * lib/restock/share.ts
 * 分享 token 生成 + 解析（用 service_role 跳过 RLS）
 *
 * 设计：share_token 不通过 RLS 暴露给 anon。/api/r/share/[token] 用
 *       service_role 取数据，然后由代码校验 status='active' + share_enabled=true。
 *       这样撤销分享 = share_enabled=false（不需要换 token）。
 */
import { customAlphabet } from 'nanoid'
import { getServiceRoleClient } from '@/lib/supabase/server'

// nanoid 默认 URL-safe，但 base58 更像 Notion/Linear 的 token 风格（无 0/O、1/l 歧义）
const alphabet = '23456789abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ'
const nanoid12 = customAlphabet(alphabet, 12)

export function generateShareToken(): string {
  return nanoid12()
}

/**
 * 按 token 解析一个 active 且 share_enabled 的清单。
 * 返回 null 当 token 不存在 / 状态不符。
 * 用 service_role：跳过 RLS，由代码把守门。
 */
export interface SharedListSnapshot {
  list_id: string
  name: string
  status: 'active' | 'completed' | 'archived'
  share_enabled: boolean
  created_at: string
  items: Array<{
    id: string
    snapshot_name: string
    snapshot_brand: string | null
    snapshot_unit: string | null
    needed_qty: number
    bought: boolean
  }>
}

export async function resolveShareToken(
  token: string
): Promise<SharedListSnapshot | null> {
  const service = getServiceRoleClient() as any

  const { data: list, error } = await service
    .from('restock_lists')
    .select(
      'list_id, name, status, share_enabled, created_at, share_token'
    )
    .eq('share_token', token)
    .maybeSingle()

  if (error || !list) return null
  if (!list.share_enabled || list.status !== 'active') return null

  const { data: items, error: itemsErr } = await service
    .from('restock_items')
    .select(
      'id, snapshot_name, snapshot_brand, snapshot_unit, needed_qty, bought, sort_order'
    )
    .eq('list_id', list.list_id)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (itemsErr) return null

  return {
    list_id: list.list_id,
    name: list.name,
    status: list.status,
    share_enabled: list.share_enabled,
    created_at: list.created_at,
    items: items ?? [],
  }
}
