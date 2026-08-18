'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Plus,
  Share2,
  Check,
  Trash2,
  ShoppingCart,
  Edit3,
  Save,
  X,
} from 'lucide-react'
import { Btn } from '@/components/ui/Btn'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { toast } from '@/components/ui/Toast'
import { Events, track } from '@/lib/analytics'
import type { RestockItem, RestockList } from '@/lib/restock/types'
import { cn } from '@/lib/utils/cn'

/**
 * /restock/[listId] — 购物清单详情（PRD §3.7）
 *
 * - 顶部：清单名（可改名）+ 进度 + 分享按钮
 * - 中间：条目列表（可勾选 / 编辑 qty / 改名 / 删除）
 * - 底部：加临时条目 + 全部买到了（checkout）
 */
type Props = { params: { listId: string } }

export default function RestockListPage({ params }: Props) {
  const router = useRouter()
  const [list, setList] = React.useState<RestockList | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [adding, setAdding] = React.useState(false)
  const [newName, setNewName] = React.useState('')
  const [newQty, setNewQty] = React.useState('1')
  const [editingTitle, setEditingTitle] = React.useState(false)
  const [titleDraft, setTitleDraft] = React.useState('')
  const [checking, setChecking] = React.useState(false)
  const [submitting, setSubmitting] = React.useState(false)
  const [finishing, setFinishing] = React.useState(false)

  const reload = React.useCallback(async () => {
    setError(null)
    try {
      const res = await fetch(`/api/restock/${params.listId}`, {
        cache: 'no-store',
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || '加载失败')
      setList(json.list as RestockList)
    } catch (e: any) {
      setError(e?.message ?? '加载失败')
    }
  }, [params.listId])

  React.useEffect(() => {
    void reload()
  }, [reload])

  const isCompleted = list?.status === 'completed'
  const isArchived = list?.status === 'archived'
  const isReadOnly = isCompleted || isArchived

  // ───────── 勾选 ─────────
  async function handleCheck(item: RestockItem, bought: boolean) {
    setChecking(true)
    // optimistic update
    setList((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        items: prev.items.map((it) =>
          it.id === item.id
            ? {
                ...it,
                bought,
                checked_at: bought ? new Date().toISOString() : null,
              }
            : it
        ),
        bought_count:
          prev.bought_count + (bought ? 1 : -1) +
          // 自身切换
          (item.bought === bought ? 0 : bought ? 1 : -1),
      }
    })

    try {
      const res = await fetch(
        `/api/restock/${params.listId}/items/${item.id}`,
        {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ bought }),
        }
      )
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || '勾选失败')
      track(Events.RestockItemChecked, {
        item_id: item.item_id,
        custom: !item.item_id,
        bought,
      })
      // 用 server 返回的 items 校正一次
      void reload()
    } catch (e: any) {
      toast.error(`勾选失败：${e?.message ?? ''}`)
      void reload()
    } finally {
      setChecking(false)
    }
  }

  // ───────── 改 qty ─────────
  async function handleUpdateQty(item: RestockItem, qty: number) {
    try {
      const res = await fetch(
        `/api/restock/${params.listId}/items/${item.id}`,
        {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ needed_qty: qty }),
        }
      )
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || '更新失败')
      void reload()
    } catch (e: any) {
      toast.error(`改数量失败：${e?.message ?? ''}`)
    }
  }

  // ───────── 删一条 ─────────
  async function handleDelete(item: RestockItem) {
    if (!confirm(`要从清单删掉"${item.snapshot_name}"吗？`)) return
    try {
      const res = await fetch(
        `/api/restock/${params.listId}/items/${item.id}`,
        { method: 'DELETE' }
      )
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || '删除失败')
      track(Events.RestockItemRemoved, {
        restock_item_id: item.id,
        was_checked: item.bought,
      })
      void reload()
    } catch (e: any) {
      toast.error(`删除失败：${e?.message ?? ''}`)
    }
  }

  // ───────── 改名 ─────────
  async function handleRename(name: string) {
    setEditingTitle(false)
    if (name === list?.name) return
    try {
      const res = await fetch(`/api/restock/${params.listId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || '改名失败')
      void reload()
    } catch (e: any) {
      toast.error(`改名失败：${e?.message ?? ''}`)
    }
  }

  // ───────── 加临时条目 ─────────
  async function handleAddCustom(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    try {
      const res = await fetch(`/api/restock/${params.listId}/items`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          custom_name: newName.trim(),
          needed_qty: parseFloat(newQty) || 1,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || '加条目失败')
      track(Events.RestockItemAdded, {
        restock_item_id: json.item?.id,
        source: 'manual',
        custom: true,
      })
      setNewName('')
      setNewQty('1')
      setAdding(false)
      void reload()
    } catch (e: any) {
      toast.error(`加条目失败：${e?.message ?? ''}`)
    }
  }

  // ───────── Checkout ─────────
  async function handleCheckout() {
    if (!list) return
    const boughtCount = list.items.filter((it) => it.bought).length
    if (boughtCount === 0) {
      if (
        !confirm(
          '清单里还没有勾选任何东西。也要把这一份标为完成吗？（这通常表示放弃清单）'
        )
      )
        return
    } else {
      if (
        !confirm(
          `把 ${boughtCount} 件勾选的东西写回库存？\n\n完成后清单会标为"已完成"，不可再改。`
        )
      )
        return
    }
    setFinishing(true)
    try {
      const res = await fetch(`/api/restock/${params.listId}/checkout`, {
        method: 'POST',
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || '完成失败')
      track(Events.RestockListCompleted, {
        list_id: list.list_id,
        items_applied: json.items_applied,
        events_written: json.events_written,
        new_items_created: json.new_items_created,
      })
      toast.info(
        `完成 · 写回 ${json.events_written} 个库存事件，新增 ${json.new_items_created} 个`,
        { durationMs: 3000 }
      )
      router.push(`/restock`)
    } catch (e: any) {
      toast.error(`完成失败：${e?.message ?? ''}`)
    } finally {
      setFinishing(false)
    }
  }

  // ───────── Render ─────────
  if (error && !list) {
    return (
      <div className="px-6 pt-10 pb-6">
        <Link
          href="/restock"
          className="inline-flex items-center gap-1 text-small text-accent-sage mb-4"
        >
          <ArrowLeft className="h-4 w-4" /> 返回
        </Link>
        <EmptyState
          title="打开清单出错了"
          description={error}
          primary={
            <Btn onClick={() => router.refresh()}>重试</Btn>
          }
        />
      </div>
    )
  }

  if (!list) {
    return (
      <div className="px-6 pt-10 pb-6">
        <Skeleton className="h-8 w-40 mb-4" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="mt-3 h-16 w-full" />
        <Skeleton className="mt-3 h-16 w-full" />
      </div>
    )
  }

  const allChecked = list.item_count > 0 && list.bought_count === list.item_count

  return (
    <div className="px-6 pt-10 pb-32">
      {/* 顶部 */}
      <header>
        <Link
          href="/restock"
          className="inline-flex items-center gap-1 text-small text-ink-secondary"
        >
          <ArrowLeft className="h-4 w-4" /> 补货清单
        </Link>
        <div className="mt-3 flex items-start gap-2">
          {isCompleted && (
            <span className="mt-1 inline-flex items-center gap-1 px-2 h-6 rounded-pill bg-accent-sage-soft text-accent-sage text-micro">
              <Check className="h-3 w-3" /> 已完成
            </span>
          )}
          {isArchived && (
            <span className="mt-1 px-2 h-6 rounded-pill bg-bg-canvas text-ink-secondary text-micro inline-flex items-center">
              已归档
            </span>
          )}
          {!editingTitle && !isArchived && (
            <h1
              className="flex-1 font-semibold text-h1 text-ink-primary break-all"
              onClick={() => {
                if (isReadOnly) return
                setEditingTitle(true)
                setTitleDraft(list.name)
              }}
              role={isReadOnly ? undefined : 'button'}
            >
              {list.name}
            </h1>
          )}
          {editingTitle && (
            <form
              className="flex-1 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                handleRename(titleDraft.trim() || list.name)
              }}
            >
              <input
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                autoFocus
                className="flex-1 h-10 px-3 rounded-sm bg-bg-surface text-body text-ink-primary border border-border-hairline outline-none focus:bg-bg-elevated focus:border-accent-sage"
              />
              <Btn
                size="md"
                type="submit"
                iconOnly={<Save className="h-4 w-4" />}
              />
              <Btn
                size="md"
                variant="secondary"
                type="button"
                iconOnly={<X className="h-4 w-4" />}
                onClick={() => setEditingTitle(false)}
              />
            </form>
          )}
          {!isReadOnly && !editingTitle && (
            <button
              type="button"
              onClick={() => {
                setEditingTitle(true)
                setTitleDraft(list.name)
              }}
              className="mt-1 p-2 text-ink-tertiary hover:text-ink-primary"
              aria-label="改名"
            >
              <Edit3 className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="mt-2 flex items-center justify-between">
          <p className="text-small text-ink-secondary">
            <span
              className={cn(
                'font-num',
                allChecked ? 'text-accent-sage' : 'text-ink-primary'
              )}
            >
              {list.bought_count}
            </span>
            <span className="font-num"> / {list.item_count}</span> 件勾上
          </p>
          <Link
            href={`/restock/${list.list_id}/share`}
            className="inline-flex items-center gap-1 text-small text-accent-sage"
            onClick={() =>
              track(Events.ShareLinkGenerated, {
                list_id: list.list_id,
                action: 'nav_to_share',
              })
            }
          >
            <Share2 className="h-4 w-4" /> 分享
          </Link>
        </div>
        {/* 进度条 */}
        {list.item_count > 0 && (
          <div className="mt-3 h-1 w-full bg-bg-canvas rounded-pill overflow-hidden">
            <div
              className="h-full bg-accent-sage transition-all duration-tap"
              style={{
                width: `${(list.bought_count / list.item_count) * 100}%`,
              }}
            />
          </div>
        )}
      </header>

      {/* 条目 */}
      <section className="mt-6">
        {list.items.length === 0 ? (
          <EmptyState
            title="清单还是空的"
            description="加几条东西，或者从建议里挑几样过来"
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {list.items.map((item) => (
              <li key={item.id}>
                <ItemRow
                  item={item}
                  readOnly={isReadOnly}
                  onCheck={(b) => handleCheck(item, b)}
                  onUpdateQty={(q) => handleUpdateQty(item, q)}
                  onDelete={() => handleDelete(item)}
                  disabled={checking || submitting}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 添加 */}
      {!isReadOnly && (
        <section className="mt-4">
          {adding ? (
            <Card className="px-4 py-3">
              <form onSubmit={handleAddCustom} className="flex flex-col gap-2">
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="要买什么？"
                  autoFocus
                  className="h-10 px-3 rounded-sm bg-bg-canvas text-body text-ink-primary border border-border-hairline outline-none focus:bg-bg-elevated focus:border-accent-sage"
                />
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={newQty}
                    onChange={(e) => setNewQty(e.target.value)}
                    min="0.5"
                    step="0.5"
                    className="w-24 h-10 px-3 rounded-sm bg-bg-canvas text-body text-ink-primary text-center font-num border border-border-hairline outline-none focus:bg-bg-elevated focus:border-accent-sage"
                  />
                  <Btn type="submit" size="md" iconLeading={<Plus className="h-4 w-4" />}>
                    加进去
                  </Btn>
                  <Btn
                    type="button"
                    variant="ghost"
                    size="md"
                    onClick={() => {
                      setAdding(false)
                      setNewName('')
                      setNewQty('1')
                    }}
                  >
                    取消
                  </Btn>
                </div>
              </form>
            </Card>
          ) : (
            <Btn
              block
              variant="secondary"
              iconLeading={<Plus className="h-4 w-4" />}
              onClick={() => setAdding(true)}
            >
              加一条
            </Btn>
          )}
        </section>
      )}

      {/* 底部 sticky Checkout */}
      {!isReadOnly && list.item_count > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-10 bg-bg-elevated border-t border-border-hairline p-4 pb-[calc(theme(spacing.4)+env(safe-area-inset-bottom))]">
          <div className="mx-auto max-w-screen-sm">
            <Btn
              block
              size="xl"
              variant={allChecked ? 'primary' : 'secondary'}
              iconLeading={<Check className="h-5 w-5" />}
              loading={finishing}
              onClick={handleCheckout}
            >
              {allChecked ? '全部买到了 · 完成' : '全部买到了'}
            </Btn>
            {allChecked && (
              <p className="mt-1 text-center text-micro text-ink-secondary">
                会把 {list.bought_count} 件勾选的东西写回库存
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ───────── Item 行 ─────────
function ItemRow({
  item,
  readOnly,
  onCheck,
  onUpdateQty,
  onDelete,
  disabled,
}: {
  item: RestockItem
  readOnly: boolean
  onCheck: (bought: boolean) => void
  onUpdateQty: (qty: number) => void
  onDelete: () => void
  disabled: boolean
}) {
  const [editing, setEditing] = React.useState(false)
  const [qtyDraft, setQtyDraft] = React.useState(String(item.needed_qty))

  React.useEffect(() => {
    setQtyDraft(String(item.needed_qty))
  }, [item.needed_qty])

  return (
    <Card
      className={cn(
        'px-4 py-3 transition-colors duration-tap',
        item.bought && 'bg-accent-sage-soft'
      )}
    >
      <div className="flex items-start gap-3">
        <button
          type="button"
          role="checkbox"
          aria-checked={item.bought}
          disabled={readOnly || disabled}
          onClick={() => onCheck(!item.bought)}
          className={cn(
            'mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-xs border-2 transition-colors duration-tap',
            item.bought
              ? 'bg-accent-sage border-accent-sage text-bg-elevated'
              : 'border-border-default hover:border-accent-sage',
            (readOnly || disabled) && 'opacity-60'
          )}
        >
          {item.bought && <Check className="h-4 w-4" strokeWidth={3} />}
        </button>
        <div className="flex-1 min-w-0">
          <p
            className={cn(
              'text-body truncate',
              item.bought
                ? 'text-ink-secondary line-through'
                : 'text-ink-primary'
            )}
          >
            {item.snapshot_name}
            {item.snapshot_brand && (
              <span className="text-ink-tertiary"> · {item.snapshot_brand}</span>
            )}
            {item.item_id && (
              <Link
                href={`/inventory/${item.item_id}`}
                className="ml-2 text-micro text-accent-sage"
                onClick={(e) => e.stopPropagation()}
              >
                查看
              </Link>
            )}
          </p>
          {!editing ? (
            <button
              type="button"
              onClick={() => !readOnly && setEditing(true)}
              className="mt-1 inline-flex items-baseline gap-1 text-small text-ink-secondary"
              disabled={readOnly}
            >
              <span className="font-num">{item.needed_qty}</span>
              <span>{item.snapshot_unit ?? '件'}</span>
            </button>
          ) : (
            <form
              className="mt-1 flex items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                const q = parseFloat(qtyDraft)
                if (!isNaN(q) && q > 0) {
                  onUpdateQty(q)
                  setEditing(false)
                }
              }}
            >
              <input
                type="number"
                value={qtyDraft}
                onChange={(e) => setQtyDraft(e.target.value)}
                min="0.5"
                step="0.5"
                autoFocus
                className="w-20 h-8 px-2 rounded-xs bg-bg-canvas text-small font-num text-ink-primary border border-border-hairline outline-none focus:border-accent-sage"
              />
              <button
                type="submit"
                className="text-small text-accent-sage"
              >
                保存
              </button>
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="text-small text-ink-tertiary"
              >
                取消
              </button>
            </form>
          )}
        </div>
        {!readOnly && (
          <button
            type="button"
            onClick={onDelete}
            className="shrink-0 p-1 text-ink-tertiary hover:text-accent-clay"
            aria-label="删除"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
    </Card>
  )
}
