import 'server-only'
import { getServiceRoleClient } from '@/lib/supabase/server'

/**
 * 重复购买检测 — PRD §11.2 三分支处理
 *
 * 对每个识别 item，找同 household 里是否有"已存在且未删除"的同名商品：
 *   1. 严格匹配（canonical_name + brand 完全等）→ "合并到现有库存"
 *   2. 名称相似（编辑距离 + 品牌相同）        → "可能是同一个，建议合并"
 *   3. 完全无关联                           → "新商品"
 *
 * 返回每个候选 item 的匹配状态 + 候选 existing item
 */

export type DuplicateStatus = 'strict_match' | 'fuzzy_match' | 'new_item'

export interface ExistingMatch {
  item_id: string
  canonical_name: string
  brand: string | null
  quantity: number
  unit: string | null
}

export interface DuplicateCheck {
  status: DuplicateStatus
  matched: ExistingMatch | null
  score: number // 相似度 0-1
}

/** 规范化字符串：去空格、去品牌差异、lowercase */
function norm(s: string): string {
  return s.toLowerCase().replace(/\s+/g, '').trim()
}

/** 简单的字符级 Jaccard 相似度（与 trigram 等价但轻量） */
function jaccard(a: string, b: string): number {
  const sa = new Set(norm(a))
  const sb = new Set(norm(b))
  if (sa.size === 0 && sb.size === 0) return 1
  let inter = 0
  sa.forEach((c) => {
    if (sb.has(c)) inter++
  })
  const union = sa.size + sb.size - inter
  return union === 0 ? 0 : inter / union
}

/** 规范化（去 SKU 后缀、包装量） */
function softNorm(s: string): string {
  return norm(s)
    .replace(/[0-9]+(ml|g|kg|l|片|抽|卷|支|包|瓶|罐|盒|颗|粒|枚|x|×|×|提|箱)/g, '')
    .replace(/[^a-z0-9\u4e00-\u9fa5]/g, '')
}

export async function checkDuplicate(opts: {
  householdId: string
  candidateName: string
  candidateBrand?: string | null
}): Promise<DuplicateCheck> {
  const supabase = getServiceRoleClient() as any

  // 取同 household 所有未删除 items
  const { data: items, error } = await supabase
    .from('items')
    .select('item_id, canonical_name, brand, quantity, unit')
    .eq('household_id', opts.householdId)
    .is('deleted_at', null)
    .limit(500)

  if (error) {
    return { status: 'new_item', matched: null, score: 0 }
  }

  const candidateName = opts.candidateName
  const candidateBrand = opts.candidateBrand ?? null

  let best: DuplicateCheck | null = null

  for (const it of items ?? []) {
    // 严格匹配
    if (
      norm(it.canonical_name) === norm(candidateName) &&
      (it.brand ?? null) === candidateBrand
    ) {
      return {
        status: 'strict_match',
        matched: {
          item_id: it.item_id,
          canonical_name: it.canonical_name,
          brand: it.brand,
          quantity: it.quantity,
          unit: it.unit,
        },
        score: 1,
      }
    }
  }

  // 模糊匹配 — 优先看 brand + 名称相似
  for (const it of items ?? []) {
    const brandSame =
      (it.brand ?? null) === candidateBrand && candidateBrand !== null
    const nameScore = jaccard(softNorm(it.canonical_name), softNorm(candidateName))
    if (!brandSame && nameScore < 0.6) continue
    const score = brandSame ? nameScore * 1.0 : nameScore * 0.8
    if (score >= 0.55 && (!best || score > best.score)) {
      best = {
        status: brandSame && nameScore >= 0.6 ? 'fuzzy_match' : 'new_item',
        matched: {
          item_id: it.item_id,
          canonical_name: it.canonical_name,
          brand: it.brand,
          quantity: it.quantity,
          unit: it.unit,
        },
        score,
      }
      if (best.status === 'fuzzy_match') break
    }
  }

  if (best && best.status !== 'new_item') return best

  return { status: 'new_item', matched: null, score: 0 }
}
