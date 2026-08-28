'use client'

import * as React from 'react'
import Link from 'next/link'
import { Search, AlertTriangle, Clock, MapPin, SlidersHorizontal, Trash2, X, Check, FolderOpen } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Btn } from '@/components/ui/Btn'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { Sheet } from '@/components/ui/Sheet'
import { toast } from '@/components/ui/Toast'
import { Events, track } from '@/lib/analytics'
import { cn } from '@/lib/utils/cn'

/**
 * /inventory — PRD §3.4 库存列表
 *
 *   - 方块卡片网格（动森风格 tile），按品类分组展示
 *   - 搜索框（debounce 250ms；按 canonical_name 模糊匹配）
 *   - 分类 chips 行：全部 + 各分类（带计数）
 *   - 「少」徽章：只看用户勾了「快用完时提醒我」的（low_stock_rules.enabled），
 *     不再默认「数量=1 就提示少」
 */

interface Item {
  item_id: string
  canonical_name: string
  brand: string | null
  quantity: number
  unit: string | null
  expiry_date: string | null
  storage_location: string | null
  updated_at: string
  category_id: string | null
  categories: { name: string; parent_id: string | null } | null
  low_stock_rules: { threshold: number; enabled: boolean } | null
}

/** 8 个大类固定顺序（跟 0007 迁移后对齐；分组排序用） */
const CATEGORY_ORDER: string[] = [
  '食品饮料',
  '生鲜果蔬',
  '个护美妆',
  '家居清洁',
  '健康药品',
  '衣物配件',
  '数码电器',
  '其他',
]

export default function InventoryPage() {
  const [allItems, setAllItems] = React.useState<Item[] | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [search, setSearch] = React.useState('')
  const [debouncedSearch, setDebouncedSearch] = React.useState('')
  const [activeCategory, setActiveCategory] = React.useState<string>('all')

  // 管理模式
  const [managing, setManaging] = React.useState(false)
  const [selected, setSelected] = React.useState<Set<string>>(new Set())
  const [batchLoading, setBatchLoading] = React.useState(false)
  const [moveSheetOpen, setMoveSheetOpen] = React.useState(false)
  const [moveCats, setMoveCats] = React.useState<Array<{ id: string; name: string }>>([])
  const [moveCatsLoading, setMoveCatsLoading] = React.useState(false)

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

  // 打开移动分类面板时加载分类
  React.useEffect(() => {
    if (!moveSheetOpen) return
    let cancelled = false
    setMoveCatsLoading(true)
    ;(async () => {
      try {
        const res = await fetch('/api/categories')
        const data = await res.json()
        if (cancelled) return
        if (data.error) throw new Error(data.error)
        const flat: Array<{ id: string; name: string }> = []
        ;(data.categories ?? []).forEach((c: any) => {
          flat.push({ id: c.category_id, name: c.name })
          ;(c.children ?? []).forEach((sub: any) => {
            flat.push({ id: sub.category_id, name: `${c.name} / ${sub.name}` })
          })
        })
        setMoveCats(flat)
      } catch (e: any) {
        if (!cancelled) toast.error(e?.message ?? '分类加载失败')
      } finally {
        if (!cancelled) setMoveCatsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [moveSheetOpen])

  // 管理：切换选中
  const toggleSelect = React.useCallback((itemId: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(itemId)) next.delete(itemId)
      else next.add(itemId)
      return next
    })
  }, [])

  const exitManage = React.useCallback(() => {
    setManaging(false)
    setSelected(new Set())
    setMoveSheetOpen(false)
  }, [])

  // 批量删除
  const batchDelete = React.useCallback(async () => {
    if (selected.size === 0) return
    const names = (allItems ?? [])
      .filter((it) => selected.has(it.item_id))
      .slice(0, 3)
      .map((it) => `「${it.canonical_name}」`)
      .join('、')
    const ok = window.confirm(
      `把选中的 ${selected.size} 件物品放进回收站？\n${names}${selected.size > 3 ? ' 等' : ''}`
    )
    if (!ok) return
    setBatchLoading(true)
    try {
      const res = await fetch('/api/items/batch-delete', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ item_ids: Array.from(selected) }),
      })
      const json = await res.json()
      if (!res.ok || json.error) throw new Error(json.error || '删除失败')
      toast.info('已放进回收站', { durationMs: 1800 })
      exitManage()
      await reload()
    } catch (e: any) {
      toast.error(e?.message ?? '删除失败')
    } finally {
      setBatchLoading(false)
    }
  }, [selected, allItems, exitManage, reload])

  // 批量移动分类
  const batchMove = React.useCallback(
    async (categoryId: string | null) => {
      if (selected.size === 0) return
      setBatchLoading(true)
      try {
        const res = await fetch('/api/items/batch-update-category', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            item_ids: Array.from(selected),
            category_id: categoryId,
          }),
        })
        const json = await res.json()
        if (!res.ok || json.error) throw new Error(json.error || '移动失败')
        toast.info('分类已更新', { durationMs: 1800 })
        exitManage()
        await reload()
      } catch (e: any) {
        toast.error(e?.message ?? '移动失败')
      } finally {
        setBatchLoading(false)
      }
    },
    [selected, exitManage, reload]
  )

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

  // 按品类分组（固定大类顺序优先，未分类排最后）
  const grouped = React.useMemo(() => {
    const groups = new Map<string, { items: Item[] }>()
    filtered.forEach((it) => {
      const name = it.categories?.name ?? '未分类'
      if (!groups.has(name)) {
        groups.set(name, { items: [] })
      }
      groups.get(name)!.items.push(it)
    })
    const order = CATEGORY_ORDER
    return Array.from(groups.entries())
      .map(([name, g]) => ({ name, ...g }))
      .sort((a, b) => {
        const ai = order.indexOf(a.name)
        const bi = order.indexOf(b.name)
        if (ai === -1 && bi === -1) return b.items.length - a.items.length
        if (ai === -1) return 1
        if (bi === -1) return -1
        return ai - bi
      })
  }, [filtered])

  return (
    <div className="px-4 pt-6 pb-24 sm:px-6">
      <header className="px-2 flex items-start justify-between">
        <div>
          <h1 className="font-semibold text-h1 text-ink-primary">
            {managing ? '管理物品' : '库存'}
          </h1>
          <p className="mt-1 text-small text-ink-secondary">
            {allItems
              ? managing
                ? `已选 ${selected.size} / ${allItems.length} 件`
                : `${allItems.length} 件 · ${categoryChips.length} 个分类`
              : '加载中'}
          </p>
        </div>
        {allItems && allItems.length > 0 && (
          <button
            type="button"
            onClick={() => {
              if (managing) exitManage()
              else setManaging(true)
            }}
            className="mt-1 inline-flex items-center gap-1 px-3 h-8 rounded-pill text-small border transition-colors duration-tap shrink-0"
            style={{
              backgroundColor: managing ? 'var(--bg-surface)' : 'transparent',
              borderColor: 'var(--border-hairline)',
              color: managing ? 'var(--ink-primary)' : 'var(--ink-secondary)',
            }}
          >
            {managing ? <X className="h-3.5 w-3.5" /> : <SlidersHorizontal className="h-3.5 w-3.5" />}
            {managing ? '完成' : '管理'}
          </button>
        )}
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

      {/* 管理模式底部操作栏 */}
      {managing && allItems && allItems.length > 0 && (
        <div className="fixed bottom-[72px] left-0 right-0 z-20 px-4">
          <div className="max-w-md mx-auto flex items-center gap-2 p-2 rounded-lg bg-bg-elevated border border-border-hairline shadow-lift">
            <Btn
              variant="secondary"
              size="sm"
              className="flex-1"
              disabled={selected.size === 0 || batchLoading}
              onClick={() => setMoveSheetOpen(true)}
              iconLeading={<FolderOpen className="h-4 w-4" />}
            >
              移动到
            </Btn>
            <Btn
              variant="danger"
              size="sm"
              className="flex-1"
              disabled={selected.size === 0 || batchLoading}
              onClick={batchDelete}
              iconLeading={<Trash2 className="h-4 w-4" />}
            >
              删除
            </Btn>
          </div>
        </div>
      )}

      {/* 移动到分类面板 */}
      <Sheet
        open={moveSheetOpen}
        onOpenChange={(o) => !o && setMoveSheetOpen(false)}
        title="移动到分类"
      >
          <div className="flex flex-col gap-2">
            {moveCatsLoading ? (
              <Skeleton className="h-20 w-full" />
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => batchMove(null)}
                  disabled={batchLoading}
                  className={cn(
                    'w-full text-left px-3 py-3 rounded-md border text-body transition-colors duration-tap',
                    'bg-bg-surface border-border-hairline text-ink-primary hover:bg-bg-elevated'
                  )}
                >
                  未分类
                </button>
                {moveCats.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => batchMove(c.id)}
                    disabled={batchLoading}
                    className={cn(
                      'w-full text-left px-3 py-3 rounded-md border text-body transition-colors duration-tap',
                      'bg-bg-surface border-border-hairline text-ink-primary hover:bg-bg-elevated'
                    )}
                  >
                    {c.name}
                  </button>
                ))}
              </>
            )}
          </div>
      </Sheet>

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
            title="小屋还是空的"
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
          <div className="flex flex-col gap-6">
            {grouped.map((g) => (
              <section key={g.name}>
                <div className="flex items-center gap-2 px-1">
                  <h2 className="text-small font-semibold text-ink-primary">
                    {g.name}
                  </h2>
                  <span className="text-micro text-ink-tertiary">
                    {g.items.length}
                  </span>
                  <span className="flex-1 h-px bg-border-hairline ml-1" />
                </div>
                <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {g.items.map((it) => (
                    <ProductTile
                      key={it.item_id}
                      item={it}
                      managing={managing}
                      selected={selected.has(it.item_id)}
                      onToggle={() => toggleSelect(it.item_id)}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
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

function ProductTile({
  item,
  managing,
  selected,
  onToggle,
}: {
  item: Item
  managing: boolean
  selected: boolean
  onToggle: () => void
}) {
  // 「少」只看用户主动勾了「快用完时提醒我」的（enabled 规则），
  // 数量=1 不再自动提示
  const rule = item.low_stock_rules
  const lowStock =
    !!rule?.enabled && item.quantity > 0 && item.quantity <= Number(rule.threshold)
  const expiringSoon = (() => {
    if (!item.expiry_date) return false
    const exp = new Date(item.expiry_date).getTime()
    const sevenDaysLater = Date.now() + 7 * 24 * 60 * 60 * 1000
    return exp >= Date.now() && exp <= sevenDaysLater
  })()

  const cardBody = (
    <Card
      className={cn(
        'relative p-3 h-full flex flex-col transition-transform duration-tap overflow-hidden',
        managing
          ? 'cursor-pointer'
          : 'cursor-pointer active:scale-[0.98]',
        selected && 'ring-2 ring-accent-sage ring-offset-2 ring-offset-bg-canvas',
        lowStock && 'border-accent-clay/50'
      )}
      onClick={managing ? onToggle : undefined}
    >
      {/* 管理模式复选框 */}
      {managing && (
        <span
          className={cn(
            'absolute top-2 right-2 z-10 h-5 w-5 rounded-md border flex items-center justify-center transition-colors duration-tap',
            selected
              ? 'bg-accent-sage border-accent-sage text-bg-elevated'
              : 'bg-bg-elevated border-border-outline text-transparent'
          )}
          aria-hidden
        >
          <Check className="h-3.5 w-3.5" />
        </span>
      )}

      {/* 名称 + 徽章 */}
      <div className={managing ? 'pr-6' : undefined}>
        <p className="text-small font-semibold text-ink-primary break-words line-clamp-2">
          {item.canonical_name}
        </p>
      </div>
      <div className="mt-1.5 flex flex-wrap gap-1">
        {lowStock && (
          <span
            title={`快用完了：剩 ${item.quantity} ≤ ${rule!.threshold}${item.unit ?? '个'}`}
            className="inline-flex items-center gap-0.5 px-1.5 h-5 rounded-xs bg-accent-clay-soft text-accent-clay text-micro"
          >
            <AlertTriangle className="h-3 w-3" /> 需补货
          </span>
        )}
        {expiringSoon && (
          <span
            title={`${item.expiry_date} 到期`}
            className="inline-flex items-center gap-0.5 px-1.5 h-5 rounded-xs bg-honey-soft text-honey-ink text-micro"
          >
            <Clock className="h-3 w-3" /> 临期
          </span>
        )}
      </div>

      {/* 存放位置（最多 10 字） */}
      {item.storage_location && (
        <div className="mt-2 flex items-center gap-1 text-micro text-ink-tertiary">
          <MapPin className="h-3 w-3 shrink-0" />
          <span className="truncate max-w-[10ch]" title={item.storage_location}>
            {item.storage_location}
          </span>
        </div>
      )}

      {/* 数量：撑到底部 */}
      <div className="mt-auto pt-3 flex items-end justify-between">
        <p className="text-micro text-ink-tertiary truncate">
          {item.brand ?? ''}
        </p>
        <p className="text-h2 font-num font-semibold text-accent-sage leading-none">
          {Math.round(item.quantity * 100) / 100}
          <span className="text-micro text-ink-secondary font-normal ml-0.5">
            {item.unit ?? '个'}
          </span>
        </p>
      </div>
    </Card>
  )

  if (managing) return cardBody
  return (
    <Link href={`/inventory/${item.item_id}`} className="block">
      {cardBody}
    </Link>
  )
}
