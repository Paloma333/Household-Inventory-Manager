'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Trash2,
  Calendar,
  Tag,
  Package,
  CheckCircle2,
  ShoppingCart,
  Bell,
  ChevronRight,
  RotateCcw,
  MapPin,
  Check,
  X,
} from 'lucide-react'
import { Btn } from '@/components/ui/Btn'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Stepper } from '@/components/ui/Stepper'
import { Sheet } from '@/components/ui/Sheet'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { toast } from '@/components/ui/Toast'
import { Events, track } from '@/lib/analytics'
import { cn } from '@/lib/utils/cn'

/**
 * /inventory/[itemId] — PRD §3.5 商品详情
 *
 * Sprint 1 实现：
 *   - 大数字 + Stepper +/- 调整（乐观更新 + 失败回滚）
 *   - 元数据：分类 / 品牌 / 单位 / 保质期
 *   - 历史时间轴：来自 inventory_events
 *   - 编辑元数据 sheet
 *   - 删除（带撤销 toast）
 */

interface Item {
  item_id: string
  household_id: string
  canonical_name: string
  brand: string | null
  quantity: number
  unit: string | null
  package_quantity: number | null
  expiry_date: string | null
  storage_location: string | null
  created_at: string
  updated_at: string
  category_id: string | null
  categories: { name: string; parent_id: string | null } | null
  low_stock_rules: { threshold: number; enabled: boolean } | null
}

/** 低库存提醒阈值输入框的默认展示值（保存时才真正建规则） */

interface Event {
  event_id: string
  event_type: 'purchase' | 'consume' | 'adjust' | 'merge' | 'restock_confirm'
  quantity_change: number
  previous_quantity: number
  new_quantity: number
  source: 'manual' | 'ai_receipt' | 'ai_screenshot' | 'ai_camera' | 'restock'
  created_at: string
  metadata: Record<string, unknown> | null
}

interface CategoryNode {
  category_id: string
  name: string
  parent_id: string | null
  is_system: boolean
  children: CategoryNode[]
}

export default function ItemDetailPage({
  params,
}: {
  params: { itemId: string }
}) {
  const router = useRouter()
  const [item, setItem] = React.useState<Item | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [events, setEvents] = React.useState<Event[] | null>(null)
  const [editOpen, setEditOpen] = React.useState(false)
  const [ruleOpen, setRuleOpen] = React.useState(false)
  const [categories, setCategories] = React.useState<CategoryNode[]>([])

  const reload = React.useCallback(async () => {
    setError(null)
    try {
      const [itemRes, evRes] = await Promise.all([
        fetch(`/api/items/${params.itemId}`, { cache: 'no-store' }),
        fetch(`/api/items/${params.itemId}/events`, { cache: 'no-store' }),
      ])
      const [itemJson, evJson] = await Promise.all([itemRes.json(), evRes.json()])
      if (!itemRes.ok || itemJson.error || !itemJson.item) {
        throw new Error(itemJson.error || '加载失败')
      }
      setItem(itemJson.item)
      setEvents(evJson.events ?? [])
    } catch (e: any) {
      setError(e?.message ?? '加载失败')
    }
  }, [params.itemId])

  React.useEffect(() => {
    void reload()
    track(Events.InventoryViewed, { source: 'item_detail', item_id: params.itemId })
  }, [reload, params.itemId])

  const adjust = React.useCallback(
    async (delta: number) => {
      if (!item) return
      const previous = item.quantity
      const optimistic = Math.max(0, previous + delta)
      setItem((it) => (it ? { ...it, quantity: optimistic } : it))
      try {
        const res = await fetch(`/api/items/${item.item_id}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ delta, event_type: delta < 0 ? 'consume' : 'adjust' }),
        })
        const json = await res.json()
        if (!res.ok || json.error) {
          throw new Error(json.error || '失败')
        }
        track(Events.ItemAdjusted, {
          item_id: item.item_id,
          delta,
          new_quantity: json.quantity,
          surface: 'detail',
        })
        // 后台拉一次事件列表，更新时间轴
        const evRes = await fetch(`/api/items/${item.item_id}/events`, {
          cache: 'no-store',
        })
        const evJson = await evRes.json()
        setEvents(evJson.events ?? [])
      } catch (e: any) {
        // 回滚
        setItem((it) => (it ? { ...it, quantity: previous } : it))
        toast.error(e?.message ?? '调整失败')
      }
    },
    [item]
  )

  const handleDelete = async () => {
    if (!item) return
    const ok = window.confirm(`把"${item.canonical_name}"放进回收站？`)
    if (!ok) return
    try {
      const res = await fetch(`/api/items/${item.item_id}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok || !json.ok) throw new Error(json.error || '删除失败')
      track(Events.ItemDeleted, { item_id: item.item_id, surface: 'detail' })
      toast.info('已放进回收站', { durationMs: 1800 })
      router.push('/inventory')
      router.refresh()
    } catch (e: any) {
      toast.error(e?.message ?? '删除失败')
    }
  }

  if (error) {
    return (
      <div className="px-6 pt-10">
        <BackBar />
        <div className="mt-8">
          <EmptyState
            title="加载出错了"
            description={error}
            primary={
              <Link href="/inventory">
                <Btn variant="secondary">回到库存</Btn>
              </Link>
            }
          />
        </div>
      </div>
    )
  }

  if (!item) {
    return (
      <div className="px-6 pt-10">
        <BackBar />
        <Skeleton className="h-32 mt-6" />
        <Skeleton className="h-20 mt-4" />
        <Skeleton className="h-40 mt-4" />
      </div>
    )
  }

  const expiringSoon = (() => {
    if (!item.expiry_date) return false
    const exp = new Date(item.expiry_date).getTime()
    return exp >= Date.now() && exp <= Date.now() + 7 * 24 * 60 * 60 * 1000
  })()

  return (
    <div className="px-4 pt-6 pb-24 sm:px-6">
      <div className="flex items-center justify-between px-2">
        <BackBar />
        <div className="flex gap-1">
          <Btn
            variant="ghost"
            size="sm"
            onClick={() => setEditOpen(true)}
            iconOnly={<Tag className="h-4 w-4" />}
            aria-label="编辑"
          />
          <Btn
            variant="ghost"
            size="sm"
            onClick={handleDelete}
            iconOnly={<Trash2 className="h-4 w-4 text-accent-clay" />}
            aria-label="删除"
          />
        </div>
      </div>

      <header className="mt-4 px-2">
        <h1 className="font-semibold text-h1 text-ink-primary">{item.canonical_name}</h1>
        <p className="mt-1 text-small text-ink-secondary">
          {item.categories?.name ?? '未分类'}
          {item.brand ? ` · ${item.brand}` : ''}
        </p>
      </header>

      {/* 主数量 + Stepper（大数字 = 计数单位数量；有包装规格时给换算副行） */}
      <Card className="mt-6 px-6 py-8 grid place-items-center">
        <p className="text-micro uppercase tracking-wider text-ink-secondary">家里有</p>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="font-num font-semibold text-display text-ink-primary">
            {Math.round(item.quantity * 100) / 100}
          </span>
          {item.unit && (
            <span className="text-h2 text-ink-secondary">{item.unit}</span>
          )}
        </div>
        {item.package_quantity != null && item.package_quantity >= 2 && (
          <p className="mt-2 text-small text-ink-secondary">
            每{item.unit ?? '件'}装{' '}
            <strong className="text-ink-primary font-num">
              {Math.round(item.package_quantity * 100) / 100}
            </strong>
            {' '}· 共{' '}
            <strong className="text-ink-primary font-num">
              {Math.round(item.quantity * item.package_quantity * 100) / 100}
            </strong>{' '}
            件
          </p>
        )}
        <div className="mt-6">
          <Stepper value={item.quantity} onChange={(v) => adjust(v - item.quantity)} large />
        </div>
      </Card>

      {/* 元数据 chips */}
      <section className="mt-5 px-2 flex flex-wrap gap-2">
        {item.brand && <MetaChip icon={<Tag className="h-3.5 w-3.5" />}>{item.brand}</MetaChip>}
        <LocationChip item={item} onSaved={reload} />
        {item.unit && <MetaChip icon={<Package className="h-3.5 w-3.5" />}>{item.unit}</MetaChip>}
        {item.package_quantity && (
          <MetaChip icon={<ShoppingCart className="h-3.5 w-3.5" />}>
            一{item.unit ?? '件'}装 {item.package_quantity}
          </MetaChip>
        )}
        {item.expiry_date && (
          <MetaChip
            icon={<Calendar className="h-3.5 w-3.5" />}
            tone={expiringSoon ? 'warning' : undefined}
          >
            {item.expiry_date} 到期
          </MetaChip>
        )}
      </section>

      {/* 低库存提醒（PRD §3.5 阈值设置） */}
      <section className="mt-5 px-2">
        <button
          type="button"
          onClick={() => setRuleOpen(true)}
          className="w-full text-left"
        >
          <Card className="p-4 flex items-center justify-between">
            <span className="text-body inline-flex items-center gap-2 text-ink-primary">
              <Bell className="h-4 w-4 text-ink-secondary" /> 低库存提醒
            </span>
            <span className="inline-flex items-center gap-1 text-small text-ink-secondary">
              {thresholdStatus(item)}
              <ChevronRight className="h-4 w-4" />
            </span>
          </Card>
        </button>
      </section>

      {/* 历史时间轴 */}
      <section className="mt-6 px-2">
        <h2 className="text-h3 font-semibold text-ink-primary">变化历史</h2>
        {!events ? (
          <Skeleton className="h-32 mt-3" />
        ) : events.length === 0 ? (
          <p className="mt-3 text-small text-ink-secondary">还没有变化</p>
        ) : (
          <ol className="mt-3 relative pl-4 border-l border-border-hairline">
            {events.map((e) => (
              <li key={e.event_id} className="relative pb-5">
                <span className="absolute -left-[7px] top-1 h-3 w-3 rounded-full bg-bg-canvas border border-accent-sage" />
                <p className="text-small text-ink-primary">
                  {describeEvent(e, item)}
                </p>
                <p className="text-micro text-ink-secondary mt-0.5">
                  {formatRelativeTime(e.created_at)} · {e.source}
                </p>
              </li>
            ))}
          </ol>
        )}
      </section>

      {editOpen && (
        <EditItemSheet
          item={item}
          categories={categories}
          onClose={() => setEditOpen(false)}
          onCategoriesLoaded={setCategories}
          onSaved={() => {
            setEditOpen(false)
            void reload()
          }}
        />
      )}

      {ruleOpen && (
        <ThresholdRuleSheet
          item={item}
          onClose={() => setRuleOpen(false)}
          onSaved={() => {
            setRuleOpen(false)
            void reload()
          }}
        />
      )}
    </div>
  )
}

function thresholdStatus(item: Item): string {
  const rule = item.low_stock_rules
  if (!rule || !rule.enabled) return '未开启'
  const t = Number(rule.threshold)
  if (t <= 0) return '用完才提醒'
  return `剩 ${t}${item.unit ?? '个'}时提醒`
}

function BackBar() {
  return (
    <Link
      href="/inventory"
      className="inline-flex items-center gap-1 text-small text-ink-secondary"
    >
      <ArrowLeft className="h-4 w-4" /> 库存
    </Link>
  )
}

function MetaChip({
  icon,
  children,
  tone,
}: {
  icon: React.ReactNode
  children: React.ReactNode
  tone?: 'warning'
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 h-7 rounded-pill text-micro border',
        tone === 'warning'
          ? 'border-accent-honey bg-accent-honey/15 text-accent-honey'
          : 'border-border-hairline bg-bg-surface text-ink-secondary'
      )}
    >
      {icon}
      {children}
    </span>
  )
}

function LocationChip({
  item,
  onSaved,
}: {
  item: Item
  onSaved: () => void
}) {
  const [editing, setEditing] = React.useState(false)
  const [value, setValue] = React.useState(item.storage_location ?? '')
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    setValue(item.storage_location ?? '')
  }, [item.storage_location])

  const save = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/items/${item.item_id}/meta`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ storage_location: value.trim() || null }),
      })
      const json = await res.json()
      if (!res.ok || json.error) throw new Error(json.error || '保存失败')
      toast.info('已更新', { durationMs: 1200 })
      setEditing(false)
      onSaved()
    } catch (e: any) {
      toast.error(e?.message ?? '保存失败')
    } finally {
      setSaving(false)
    }
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2 w-full">
        <div className="flex-1">
          <Input
            placeholder="例：厨房左侧橱柜"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void save()
              if (e.key === 'Escape') {
                setEditing(false)
                setValue(item.storage_location ?? '')
              }
            }}
            autoFocus
          />
        </div>
        <Btn
          size="sm"
          onClick={() => void save()}
          loading={saving}
          iconOnly={<Check className="h-4 w-4" />}
          aria-label="保存"
        />
        <Btn
          size="sm"
          variant="secondary"
          onClick={() => {
            setEditing(false)
            setValue(item.storage_location ?? '')
          }}
          iconOnly={<X className="h-4 w-4" />}
          aria-label="取消"
        />
      </div>
    )
  }

  if (item.storage_location) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="inline-flex"
        aria-label="编辑存放位置"
      >
        <MetaChip icon={<MapPin className="h-3.5 w-3.5" />}>
          {item.storage_location}
        </MetaChip>
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="inline-flex"
      aria-label="添加存放位置"
    >
      <MetaChip icon={<MapPin className="h-3.5 w-3.5" />}>+ 我在哪</MetaChip>
    </button>
  )
}

function describeEvent(e: Event, item: Item): string {
  const unit = item.unit ? item.unit : ''
  const abs = Math.abs(e.quantity_change)
  const qty = `${e.quantity_change > 0 ? '+' : e.quantity_change < 0 ? '−' : ''}${abs}${unit}`

  if (e.quantity_change > 0) return `新增 · ${qty} · 家里现在 ${e.new_quantity}`
  if (e.quantity_change < 0) return `用掉 · ${qty} · 家里现在 ${e.new_quantity}`

  switch (e.event_type) {
    case 'purchase':
      return `购入 · 家里现在 ${e.new_quantity}`
    case 'consume':
      return `用掉 · 家里现在 ${e.new_quantity}`
    case 'adjust':
      return `调整 · 家里现在 ${e.new_quantity}`
    case 'merge':
      return `合并 · 家里现在 ${e.new_quantity}`
    case 'restock_confirm':
      return `补货 · 家里现在 ${e.new_quantity}`
  }
}

function formatRelativeTime(iso: string): string {
  const ts = new Date(iso).getTime()
  const diff = Math.floor((Date.now() - ts) / 1000)
  if (diff < 60) return '刚刚'
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`
  if (diff < 604800) return `${Math.floor(diff / 86400)} 天前`
  return new Date(iso).toLocaleString('zh-CN')
}

/** 编辑 sheet：name / brand / unit / package_quantity / expiry_date / category_id */
function EditItemSheet({
  item,
  categories,
  onCategoriesLoaded,
  onClose,
  onSaved,
}: {
  item: Item
  categories: CategoryNode[]
  onClose: () => void
  onCategoriesLoaded: (cats: CategoryNode[]) => void
  onSaved: () => void
}) {
  const [name, setName] = React.useState(item.canonical_name)
  const [brand, setBrand] = React.useState(item.brand ?? '')
  const [unit, setUnit] = React.useState(item.unit ?? '')
  const [pkg, setPkg] = React.useState(item.package_quantity?.toString() ?? '')
  const [expiry, setExpiry] = React.useState(item.expiry_date ?? '')
  const [storageLocation, setStorageLocation] = React.useState(item.storage_location ?? '')
  const [categoryId, setCategoryId] = React.useState(item.category_id ?? '')
  const [saving, setSaving] = React.useState(false)
  const [err, setErr] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (categories.length === 0) {
      ;(async () => {
        const res = await fetch('/api/categories')
        const data = await res.json()
        onCategoriesLoaded(data.categories ?? [])
      })()
    }
  }, [categories.length, onCategoriesLoaded])

  // 简化：直接 PUT 到 /api/items/[id] 不存在，走 POST 然后... 不如就地走 PATCH 的元数据
  // 这里只 PATCH 部分字段。注意我们 PATCH route 现在只接受 delta/absolute。我先扩展它。
  const save = async () => {
    setSaving(true)
    setErr(null)
    try {
      const res = await fetch(`/api/items/${item.item_id}/meta`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          canonical_name: name.trim() || undefined,
          brand: brand.trim() || null,
          unit: unit.trim() || null,
          package_quantity: pkg ? Number(pkg) : null,
          expiry_date: expiry || null,
          storage_location: storageLocation.trim() || null,
          category_id: categoryId || null,
        }),
      })
      const json = await res.json()
      if (!res.ok || json.error) throw new Error(json.error || '保存失败')
      toast.info('已更新', { durationMs: 1500 })
      onSaved()
    } catch (e: any) {
      setErr(e?.message ?? '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const flat = React.useMemo(() => {
    const out: Array<{ id: string; label: string; depth: number }> = []
    categories.forEach((c) => {
      out.push({ id: c.category_id, label: c.name, depth: 0 })
      c.children.forEach((sub) =>
        out.push({ id: sub.category_id, label: sub.name, depth: 1 })
      )
    })
    return out
  }, [categories])

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()} title="编辑">
      <div className="flex flex-col gap-4">
        <Input label="名字" value={name} onChange={(e) => setName(e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <Input label="品牌" value={brand} onChange={(e) => setBrand(e.target.value)} />
          <Input label="单位" value={unit} onChange={(e) => setUnit(e.target.value)} />
        </div>
        <p className="-mt-2 text-micro text-ink-tertiary">
          单位是你随手增减时的计数单位（如提/包/瓶）。改单位只改名字，数量不会自动换算 —
          想换算的话记得同时改数量。
        </p>
        <Input
          kind="number"
          label="一包装多少"
          value={pkg}
          onChange={(e) => setPkg(e.target.value)}
        />
        <Input
          label="我在哪"
          placeholder="例：厨房左侧橱柜"
          value={storageLocation}
          onChange={(e) => setStorageLocation(e.target.value)}
        />
        <Input kind="date" label="过期" value={expiry} onChange={(e) => setExpiry(e.target.value)} />

        <div className="flex flex-col gap-1.5">
          <label className="text-small text-ink-secondary">分类</label>
          <div className="flex flex-wrap gap-1.5">
            {flat.map((c) => {
              const active = categoryId === c.id
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCategoryId(active ? '' : c.id)}
                  aria-pressed={active}
                  className={
                    'px-2.5 h-8 rounded-pill text-small border transition-colors duration-tap ' +
                    (active
                      ? 'bg-accent-sage text-bg-elevated border-accent-sage'
                      : c.depth === 0
                        ? 'bg-bg-canvas text-ink-primary border-border-hairline'
                        : 'bg-bg-surface text-ink-secondary border-border-hairline')
                  }
                >
                  {c.label}
                </button>
              )
            })}
          </div>
        </div>

        {err && <p className="text-small text-accent-clay">{err}</p>}

        <Btn onClick={save} loading={saving} block size="lg" iconLeading={<CheckCircle2 className="h-4 w-4" />}>
          保存
        </Btn>
      </div>
    </Sheet>
  )
}

/** 阈值设置 sheet（PRD §3.5）：数字 + 单位（只读展示）+ 启用开关 + 恢复默认 */
function ThresholdRuleSheet({
  item,
  onClose,
  onSaved,
}: {
  item: Item
  onClose: () => void
  onSaved: () => void
}) {
  const rule = item.low_stock_rules
  // 无自定义规则时预填「购买量 25%」默认值，与入库时的自动规则一致
  const [threshold, setThreshold] = React.useState(
    rule
      ? String(Number(rule.threshold))
      : String(Math.max(0, Math.floor(Number(item.quantity) * 0.25)))
  )
  const [enabled, setEnabled] = React.useState(rule ? rule.enabled : false)
  const [saving, setSaving] = React.useState(false)
  const [err, setErr] = React.useState<string | null>(null)
  const unit = item.unit ?? '个'

  const save = async () => {
    const t = Number(threshold)
    if (!Number.isFinite(t) || t < 0) {
      setErr('阈值不能是负数')
      return
    }
    setSaving(true)
    setErr(null)
    try {
      const res = await fetch(`/api/items/${item.item_id}/rule`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ threshold: t, enabled }),
      })
      const json = await res.json()
      if (!res.ok || json.error) throw new Error(json.error || '保存失败')
      toast.info(enabled ? '提醒设好啦' : '提醒已关', { durationMs: 1600 })
      onSaved()
    } catch (e: any) {
      setErr(e?.message ?? '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const resetDefault = async () => {
    setSaving(true)
    setErr(null)
    try {
      const res = await fetch(`/api/items/${item.item_id}/rule`, {
        method: 'DELETE',
      })
      const json = await res.json()
      if (!res.ok || !json.ok) throw new Error(json.error || '关闭失败')
      toast.info('提醒已关，不会再提示「需补货」', { durationMs: 1600 })
      onSaved()
    } catch (e: any) {
      setErr(e?.message ?? '恢复失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()} title="低库存提醒">
      <div className="flex flex-col gap-4">
        <p className="text-small text-ink-secondary">
          勾上后，剩得不多时会提醒补货，也会出现在补货建议的「快用完」里；不勾就完全不提醒。阈值按你现在的计数单位（{unit}）算。
        </p>

        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Input
              kind="number"
              label={`低于多少${unit}时提醒（0 = 用完才提醒）`}
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              min={0}
              step={1}
            />
          </div>
          <span className="h-11 px-2 inline-flex items-center text-body text-ink-secondary">
            {unit}
          </span>
        </div>

        {/* 启用开关 */}
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          onClick={() => setEnabled((v) => !v)}
          className="w-full flex items-center justify-between py-1"
        >
          <span className="text-body text-ink-primary">快用完时提醒我</span>
          <span
            className={cn(
              'relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-tap',
              enabled ? 'bg-accent-sage' : 'bg-ink-tertiary/30'
            )}
          >
            <span
              className={cn(
                'inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform duration-tap',
                enabled ? 'translate-x-5' : 'translate-x-0.5'
              )}
            />
          </span>
        </button>

        {err && <p className="text-small text-accent-clay">{err}</p>}

        <Btn onClick={save} loading={saving} block size="lg" iconLeading={<CheckCircle2 className="h-4 w-4" />}>
          保存
        </Btn>

        {rule && (
          <Btn
            variant="ghost"
            block
            size="sm"
            disabled={saving}
            onClick={resetDefault}
            iconLeading={<RotateCcw className="h-3.5 w-3.5" />}
          >
            关闭提醒（不再提示「需补货」）
          </Btn>
        )}
      </div>
    </Sheet>
  )
}
