/**
 * lib/restock/suggest.ts
 * 补货建议计算 — PRD §3.7 三分组
 *
 * 规则（按优先级排高到低，同一 item 只能出现在一组）：
 *   1. 已用完 (out_of_stock)：items.quantity = 0
 *   2. 快用完 (low_stock)：   quantity > 0 且 ≤ threshold（默认 1）或 < package_quantity/2
 *   3. 快过期 (expiring_soon)：expiry_date ∈ [今天, 今天+7]
 *
 * 与 inventory_events 无关，只看当前 items 快照 —— 用户操作之后状态会变。
 */
import { getServiceRoleClient } from '@/lib/supabase/server'
import type {
  SuggestGroup,
  SuggestItem,
  SuggestResult,
  SuggestGroupKey,
} from './types'

const DEFAULT_LOW_THRESHOLD = 1
const EXPIRING_WINDOW_DAYS = 7

interface ItemRow {
  item_id: string
  canonical_name: string
  brand: string | null
  quantity: number
  unit: string | null
  package_quantity: number | null
  expiry_date: string | null
  category_id: string | null
}

interface ThresholdRow {
  item_id: string
  threshold: number
  enabled: boolean
}

const TITLES: Record<SuggestGroupKey, string> = {
  out_of_stock: '已用完',
  low_stock: '快用完',
  expiring_soon: '快过期',
}

/**
 * 计算一个家庭当前的三分组建议。
 * @param householdId - 必传，家庭 ID
 * @param limit - 每组最多取多少条（默认 8，UI 显示前 5）
 */
export async function computeSuggest(
  householdId: string,
  limit = 8
): Promise<SuggestResult> {
  const service = getServiceRoleClient() as any

  // 一次拉全：items（非软删）+ 用户自定义阈值
  const [{ data: items, error: itemsErr }, { data: thresholds }] =
    await Promise.all([
      service
        .from('items')
        .select(
          'item_id, canonical_name, brand, quantity, unit, package_quantity, expiry_date, category_id'
        )
        .eq('household_id', householdId)
        .is('deleted_at', null),
      service
        .from('low_stock_rules')
        .select('item_id, threshold')
        .in(
          'item_id',
          // 先简单：阈值表通常不大；这里不用子查询以免 RLS 麻烦
          // 用一个同请求的 items.id 链取；如果 items 为空就略过
          [] // 稍后用单独 SELECT 兜底
        ),
    ])

  if (itemsErr || !items) {
    return emptyResult()
  }

  // 单独查 thresholds（避免上面那个 in 空数组）
  let thresholdMap = new Map<string, number>()
  if (items.length > 0) {
    const itemIds = items.map((i: ItemRow) => i.item_id)
    const { data: ths } = await service
      .from('low_stock_rules')
      .select('item_id, threshold, enabled')
      .in('item_id', itemIds)
    thresholdMap = new Map(
      ((ths ?? []) as ThresholdRow[])
        .filter((t) => t.enabled) // 关掉的规则不生效，回落默认值
        .map((t) => [t.item_id, Number(t.threshold)])
    )
  }

  const today = startOfDay(new Date())
  const expiringCutoff = addDays(today, EXPIRING_WINDOW_DAYS)

  const outOfStock: SuggestItem[] = []
  const lowStock: SuggestItem[] = []
  const expSoon: SuggestItem[] = []
  const placed = new Set<string>() // 已经归组的 item 不重复

  for (const it of items as ItemRow[]) {
    // 1. 已用完
    if (Number(it.quantity) === 0) {
      outOfStock.push(
        mkSuggest(it, 'quantity = 0')
      )
      placed.add(it.item_id)
      continue
    }
    // 2. 快用完
    const threshold =
      thresholdMap.get(it.item_id) ?? DEFAULT_LOW_THRESHOLD
    const halfPack =
      it.package_quantity && it.package_quantity > 0
        ? it.package_quantity / 2
        : null
    const isLow =
      Number(it.quantity) > 0 &&
      (Number(it.quantity) <= threshold ||
        (halfPack !== null && Number(it.quantity) < halfPack))
    if (isLow) {
      lowStock.push(
        mkSuggest(it, `剩 ${it.quantity}${it.unit ?? '个'} ≤ ${threshold}`)
      )
      placed.add(it.item_id)
      continue
    }
    // 3. 快过期
    if (it.expiry_date) {
      const exp = startOfDay(new Date(it.expiry_date))
      if (exp >= today && exp <= expiringCutoff) {
        expSoon.push(
          mkSuggest(it, `${it.expiry_date} 到期`)
        )
        placed.add(it.item_id)
        continue
      }
    }
  }

  // 按名称排序（中文按拼音可能不太准，但 MVP 够用）
  const byName = (a: SuggestItem, b: SuggestItem) =>
    a.canonical_name.localeCompare(b.canonical_name, 'zh-CN')

  return {
    out_of_stock: wrap('out_of_stock', outOfStock.sort(byName).slice(0, limit)),
    low_stock: wrap('low_stock', lowStock.sort(byName).slice(0, limit)),
    expiring_soon: wrap(
      'expiring_soon',
      expSoon.sort(byName).slice(0, limit)
    ),
    total: placed.size,
  }
}

// ───────── helpers ─────────
function mkSuggest(it: ItemRow, reason: string): SuggestItem {
  return {
    item_id: it.item_id,
    canonical_name: it.canonical_name,
    brand: it.brand,
    quantity: Number(it.quantity),
    unit: it.unit,
    threshold: null,
    expiry_date: it.expiry_date,
    category_id: it.category_id,
    reason,
  }
}

function wrap(
  key: SuggestGroupKey,
  items: SuggestItem[]
): SuggestGroup {
  return {
    key,
    title: TITLES[key],
    count: items.length,
    items,
  }
}

function emptyResult(): SuggestResult {
  return {
    out_of_stock: wrap('out_of_stock', []),
    low_stock: wrap('low_stock', []),
    expiring_soon: wrap('expiring_soon', []),
    total: 0,
  }
}

function startOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function addDays(d: Date, days: number): Date {
  const x = new Date(d)
  x.setDate(x.getDate() + days)
  return x
}
