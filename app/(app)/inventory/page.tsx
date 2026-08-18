'use client'

import * as React from 'react'
import Link from 'next/link'
import { Search, AlertTriangle, Clock } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Btn } from '@/components/ui/Btn'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { Events, track } from '@/lib/analytics'
import { cn } from '@/lib/utils/cn'

/**
 * /inventory — PRD §3.4 库存列表
 *
 * Sprint 1 实现：
 *   - 全部 items
 *   - 搜索框（debounce 250ms；按 canonical_name 模糊匹配）
 *   - 分类 chips 行：全部 + 各分类（带计数）
 *   - ProductCard 列表
 *   - 空 / 加载 / 错误三态
 *
 * 不做：
 *   - 字母索引（Sprint 2 视情况）
 *   - 排序 Sheet（默认按更新时间 desc；Sprint 3 接）
 */

interface Item {
  item_id: string
  canonical_name: string
  brand: string | null
  quantity: number
  unit: string | null
  expiry_date: string | null
  updated_at: string
  category_id: string | null
  categories: { name: string; parent_id: string | null } | null
}

export default function InventoryPage() {
  const [allItems, setAllItems] = React.useState<Item[] | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [search, setSearch] = React.useState('')
  const [debouncedSearch, setDebouncedSearch] = React.useState('')
  const [activeCategory, setActiveCategory] = React.useState<string>('all')

  // 初次加载
  const reload = React.useCallback(async () => {
    setError(null)
    try {
      const res = await fetch('/api/items', { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '加载失败')
      setAllItems(data.items ?? [])
    } catch (e: any) {
      setError(e?.message ?? '加载失败')
    }
  }, [])

  React.useEffect(() => {
    void reload()
    track(Events.InventoryViewed, { source: 'home' })
  }, [reload])

  // debounce search
  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim().toLowerCase()), 250)
    return () => clearTimeout(t)
  }, [search])

  // search_used 埋点（输入停止 0.5s 后）
  const firedSearchRef = React.useRef('')
  React.useEffect(() => {
    const q = debouncedSearch.trim()
    if (q.length === 0) return
    if (q === firedSearchRef.current) return
    firedSearchRef.current = q
    track(Events.SearchUsed, { query_length: q.length, surface: 'inventory' })
  }, [debouncedSearch])

  // 客户端过滤（搜索 + 分类）— Sprint 1 数据量小，client filter 够用
  const filtered = React.useMemo(() => {
    if (!allItems) return []
    return allItems
      .filter((it) =>
        activeCategory === 'all' ? true : it.category_id === activeCategory
      )
      .filter((it) =>
        debouncedSearch
          ? it.canonical_name.toLowerCase().includes(debouncedSearch) ||
            (it.brand?.toLowerCase().includes(debouncedSearch) ?? false)
          : true
      )
      .sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1))
  }, [allItems, activeCategory, debouncedSearch])

  // 分类 chip 聚合
  const categoryChips = React.useMemo(() => {
    const map = new Map<string, { id: string; name: string; count: number }>()
    ;(allItems ?? []).forEach((it) => {
      if (!it.category_id) return
      const id = it.category_id
      const name = it.categories?.name ?? '未分类'
      if (!map.has(id)) map.set(id, { id, name, count: 0 })
      map.get(id)!.count++
    })
    return Array.from(map.values()).sort((a, b) => b.count - a.count)
  }, [allItems])

  return (
    <div className="px-4 pt-6 pb-24 sm:px-6">
      <header className="px-2">
        <h1 className="font-semibold text-h1 text-ink-primary">库存</h1>
        <p className="mt-1 text-small text-ink-secondary">
          {allItems
            ? `${allItems.length} 件 · ${categoryChips.length} 个分类`
            : '加载中'}
        </p>
      </header>

      {/* 搜索框 */}
      <div className="mt-5 px-2">
        <div className="relative">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-secondary pointer-events-none"
            aria-hidden
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜名字或品牌"
            className="w-full h-11 pl-10 pr-3 rounded-sm bg-bg-surface text-body text-ink-primary placeholder:text-ink-tertiary border border-border-hairline outline-none transition-colors duration-tap focus:bg-bg-elevated focus:border-accent-sage"
          />
        </div>
      </div>

      {/* 分类 chips */}
      {allItems && allItems.length > 0 && (
        <div className="mt-4 px-2 flex gap-2 overflow-x-auto no-scrollbar">
          <CategoryChip
            label={`全部 · ${allItems.length}`}
            active={activeCategory === 'all'}
            onClick={() => setActiveCategory('all')}
          />
          {categoryChips.map((c) => (
            <CategoryChip
              key={c.id}
              label={`${c.name} · ${c.count}`}
              active={activeCategory === c.id}
              onClick={() => setActiveCategory(c.id)}
            />
          ))}
        </div>
      )}

      {/* 状态：loading / error / empty / list */}
      <div className="mt-5 px-2">
        {allItems === null && !error ? (
          <ul className="flex flex-col gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </ul>
        ) : error ? (
          <EmptyState
            title="加载出错了"
            description={error}
            primary={<Btn onClick={reload}>重试</Btn>}
          />
        ) : allItems && allItems.length === 0 ? (
          <EmptyState
            title="小家还是空的"
            description="手动加几样、或者等 Sprint 2 来用 AI 拍照入库"
            primary={
              <Link href="/add">
                <Btn>去添点东西</Btn>
              </Link>
            }
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            title="没匹配到"
            description={
              debouncedSearch
                ? `没有名字里包含 "${debouncedSearch}" 的东西`
                : '这个分类下还没有东西'
            }
            primary={
              <Btn variant="ghost" onClick={() => { setSearch(''); setActiveCategory('all') }}>
                清除筛选
              </Btn>
            }
          />
        ) : (
          <ul className="flex flex-col gap-3">
            {filtered.map((it) => (
              <li key={it.item_id}>
                <ProductCard item={it} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function CategoryChip({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'shrink-0 px-3 h-8 rounded-pill text-small border transition-colors duration-tap whitespace-nowrap',
        active
          ? 'bg-accent-sage text-bg-elevated border-accent-sage'
          : 'bg-bg-surface text-ink-secondary border-border-hairline hover:bg-bg-elevated'
      )}
    >
      {label}
    </button>
  )
}

function ProductCard({ item }: { item: Item }) {
  const lowStock = item.quantity > 0 && item.quantity <= 1
  const expiringSoon = (() => {
    if (!item.expiry_date) return false
    const exp = new Date(item.expiry_date).getTime()
    const sevenDaysLater = Date.now() + 7 * 24 * 60 * 60 * 1000
    return exp >= Date.now() && exp <= sevenDaysLater
  })()

  const categoryName = item.categories?.name ?? null

  return (
    <Link href={`/inventory/${item.item_id}`} className="block">
      <Card className="px-4 py-3 flex items-center gap-3 active:scale-[0.99] active:bg-bg-elevated cursor-pointer">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-body font-semibold text-ink-primary truncate">
              {item.canonical_name}
            </p>
            {lowStock && (
              <span
                title="快用完了"
                className="inline-flex items-center gap-0.5 px-1.5 h-5 rounded-xs bg-accent-clay-soft text-accent-clay text-micro"
              >
                <AlertTriangle className="h-3 w-3" /> 少
              </span>
            )}
            {expiringSoon && (
              <span
                title={`${item.expiry_date} 到期`}
                className="inline-flex items-center gap-0.5 px-1.5 h-5 rounded-xs bg-accent-honey/20 text-accent-honey text-micro"
              >
                <Clock className="h-3 w-3" /> 临期
              </span>
            )}
          </div>
          <p className="text-micro text-ink-secondary mt-1 truncate">
            {categoryName ?? '未分类'}
            {item.brand ? ` · ${item.brand}` : ''}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-h3 font-num font-semibold text-ink-primary">
            {Math.round(item.quantity * 100) / 100}
          </p>
          <p className="text-micro text-ink-secondary">
            {item.unit ?? '个'}
          </p>
        </div>
      </Card>
    </Link>
  )
}
