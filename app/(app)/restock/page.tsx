'use client'

import * as React from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  Clock,
  XCircle,
  ShoppingCart,
  Plus,
  ArrowRight,
  CheckCircle2,
  Trash2,
  Share2,
} from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Btn } from '@/components/ui/Btn'
import { Title } from 'animal-island-ui'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { toast } from '@/components/ui/Toast'
import { Events, track } from '@/lib/analytics'
import type {
  RestockList,
  SuggestGroup,
  SuggestResult,
} from '@/lib/restock/types'
import { cn } from '@/lib/utils/cn'

/**
 * /restock — PRD §3.7 补货清单
 *
 * 顶部：今日建议三分组（已用完 / 快用完 / 快过期）
 * 下方：进行中的清单 + 最近完成
 * 底部：新建清单 CTA
 */

export default function RestockPage() {
  const queryClient = useQueryClient()
  const [creating, setCreating] = React.useState(false)

  // 补货建议 + 清单列表并行查询（30s 内跨页面复用缓存，详见 QueryProvider）
  const suggestQuery = useQuery<SuggestResult>({
    queryKey: ['restock', 'suggest'],
    queryFn: async () => {
      const res = await fetch('/api/restock/suggest', { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || '建议加载失败')
      return json.suggest as SuggestResult
    },
  })
  const listsQuery = useQuery<RestockList[]>({
    queryKey: ['restock', 'lists'],
    queryFn: async () => {
      const res = await fetch('/api/restock', { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || '清单加载失败')
      return (json.lists as RestockList[]) ?? []
    },
  })
  const suggest = suggestQuery.data ?? null
  const lists = listsQuery.data ?? null
  const error =
    suggestQuery.error
      ? (suggestQuery.error as Error).message || '建议加载失败'
      : listsQuery.error
      ? (listsQuery.error as Error).message || '清单加载失败'
      : null

  const reload = React.useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['restock', 'suggest'] }),
      queryClient.invalidateQueries({ queryKey: ['restock', 'lists'] }),
    ])
  }, [queryClient])

  React.useEffect(() => {
    track(Events.RestockViewed, { source: 'nav' })
    track(Events.RestockSuggestionShown, {})
  }, [])

  async function handleCreateList() {
    setCreating(true)
    try {
      const res = await fetch('/api/restock', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || '创建失败')
      track(Events.RestockListCreated, { list_id: json.list?.list_id })
      // 创建完直接跳清单页
      window.location.href = `/restock/${json.list.list_id}`
    } catch (e: any) {
      toast.error(`创建失败：${e?.message ?? ''}`)
      setCreating(false)
    }
  }

  async function handleArchive(listId: string) {
    if (!confirm('清单要归档吗？归档后从首页移除（数据保留）。')) return
    try {
      const res = await fetch(`/api/restock/${listId}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || '归档失败')
      track(Events.ItemDeleted, { kind: 'restock_list', list_id: listId })
      void reload()
    } catch (e: any) {
      toast.error(`归档失败：${e?.message ?? ''}`)
    }
  }

  const activeLists = (lists ?? []).filter((l) => l.status === 'active')
  const recentCompleted = (lists ?? [])
    .filter((l) => l.status === 'completed')
    .slice(0, 3)
  const hasAnySuggest =
    suggest && (suggest.out_of_stock.count > 0 ||
      suggest.low_stock.count > 0 ||
      suggest.expiring_soon.count > 0)

  return (
    <div className="px-6 pt-10 pb-6">
      <header className="text-center">
        <Title size="large">补货</Title>
        <p className="mt-3 text-body text-ink-secondary">
          {suggest === null
            ? '加载中…'
            : suggest.total === 0
              ? '家里什么都不缺，过个好周末'
              : `今天有 ${suggest.total} 件东西需要补一下`}
        </p>
      </header>

      {error && (
        <p className="mt-4 text-small text-accent-clay">{error}</p>
      )}

      {/* 今日建议 — 三分组 */}
      <section className="mt-6">
        {suggest === null ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
        ) : !hasAnySuggest ? (
          <Card className="px-4 py-8 text-center">
            <CheckCircle2
              className="mx-auto h-8 w-8 text-accent-sage"
              strokeWidth={1.5}
            />
            <p className="mt-2 text-body text-ink-primary font-semibold">
              小屋储备充足
            </p>
            <p className="mt-1 text-small text-ink-secondary">
              暂无已用完 / 快用完 / 快过期的提醒
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <SuggestCard
              group={suggest.out_of_stock}
              kind="out"
              onQuickCreate={handleCreateList}
            />
            <SuggestCard
              group={suggest.low_stock}
              kind="low"
              onQuickCreate={handleCreateList}
            />
            <SuggestCard
              group={suggest.expiring_soon}
              kind="exp"
              onQuickCreate={handleCreateList}
            />
          </div>
        )}
      </section>

      {/* 进行中的清单 */}
      {lists === null ? (
        <section className="mt-8">
          <Skeleton className="h-24 w-full" />
        </section>
      ) : (
        <Section title="进行中的清单">
          {activeLists.length === 0 ? (
            <Card className="px-4 py-6 text-center bg-bg-canvas">
              <ShoppingCart
                className="mx-auto h-6 w-6 text-ink-secondary"
                strokeWidth={1.5}
              />
              <p className="mt-2 text-body text-ink-secondary">
                没有进行中的清单
              </p>
              <p className="mt-1 text-small text-ink-tertiary">
                点下面新建一份，或者去建议里挑几样加进去
              </p>
            </Card>
          ) : (
            <ul className="flex flex-col gap-3">
              {activeLists.map((l) => (
                <li key={l.list_id}>
                  <ListCard list={l} onArchive={() => handleArchive(l.list_id)} />
                </li>
              ))}
            </ul>
          )}
        </Section>
      )}

      {/* 最近完成 */}
      {recentCompleted.length > 0 && (
        <Section title="最近完成">
          <ul className="flex flex-col gap-2">
            {recentCompleted.map((l) => (
              <li key={l.list_id}>
                <Card className="px-4 py-3 flex items-center gap-3 opacity-80">
                  <CheckCircle2
                    className="h-5 w-5 text-accent-sage"
                    strokeWidth={1.5}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-body font-medium truncate">{l.name}</p>
                    <p className="text-micro text-ink-secondary mt-0.5">
                      {l.item_count} 件 ·{' '}
                      {l.completed_at
                        ? formatRelativeTime(l.completed_at)
                        : ''}
                    </p>
                  </div>
                  <Link
                    href={`/restock/${l.list_id}`}
                    className="text-small text-accent-sage shrink-0"
                  >
                    查看
                  </Link>
                </Card>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* 新建 CTA */}
      <div className="mt-8">
        <Btn
          block
          size="lg"
          iconLeading={<Plus className="h-4 w-4" />}
          onClick={handleCreateList}
          loading={creating}
        >
          新建购物清单
        </Btn>
      </div>
    </div>
  )
}

// ───────── 子组件 ─────────

function SuggestCard({
  group,
  kind,
  onQuickCreate,
}: {
  group: SuggestGroup
  kind: 'out' | 'low' | 'exp'
  onQuickCreate: () => void
}) {
  const Icon =
    kind === 'out' ? XCircle : kind === 'low' ? AlertTriangle : Clock
  const tone =
    kind === 'out'
      ? 'text-accent-clay bg-accent-clay-soft'
      : kind === 'low'
      ? 'text-accent-clay bg-accent-clay-soft'
      : 'text-accent-honey bg-accent-honey/15'

  return (
    <Card className="px-4 py-4 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span
          className={cn(
            'inline-flex h-8 w-8 items-center justify-center rounded-pill',
            tone
          )}
        >
          <Icon className="h-4 w-4" strokeWidth={1.8} />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-small text-ink-secondary">{group.title}</p>
          <p className="text-h3 font-num font-semibold text-ink-primary">
            {group.count}
          </p>
        </div>
      </div>
      {group.items.length === 0 ? (
        <p className="text-small text-ink-tertiary py-1">—</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {group.items.slice(0, 3).map((it) => (
            <li
              key={it.item_id}
              className="flex items-center justify-between gap-2"
            >
              <span className="text-small truncate text-ink-primary">
                {it.canonical_name}
                {it.brand ? (
                  <span className="text-ink-tertiary"> · {it.brand}</span>
                ) : null}
              </span>
              <span className="text-micro font-num text-ink-secondary shrink-0">
                {it.quantity}
                {it.unit ?? ''}
              </span>
            </li>
          ))}
          {group.count > 3 && (
            <li className="text-micro text-ink-tertiary">
              +{group.count - 3} 件…
            </li>
          )}
        </ul>
      )}
      {group.count > 0 && (
        <button
          type="button"
          onClick={onQuickCreate}
          className="mt-1 inline-flex items-center gap-1 text-small text-accent-sage"
        >
          一键建清单 <ArrowRight className="h-3.5 w-3.5" />
        </button>
      )}
    </Card>
  )
}

function ListCard({
  list,
  onArchive,
}: {
  list: RestockList
  onArchive: () => void
}) {
  const totalQty = list.items.reduce((sum, it) => sum + Number(it.needed_qty), 0)
  const left = list.item_count - list.bought_count
  return (
    <Card className="px-4 py-3 active:scale-[0.99]">
      <Link href={`/restock/${list.list_id}`} className="block">
        <div className="flex items-center gap-2">
          <ShoppingCart
            className="h-5 w-5 text-accent-sage"
            strokeWidth={1.5}
          />
          <div className="flex-1 min-w-0">
            <p className="text-body font-semibold truncate">{list.name}</p>
            <p className="text-micro text-ink-secondary mt-0.5">
              {list.bought_count}/{list.item_count} · 总 {totalQty}
              {list.share_enabled && list.share_token ? ' · 已分享' : ''}
            </p>
          </div>
          {left > 0 ? (
            <span className="text-small font-num text-accent-clay shrink-0">
              还差 {left}
            </span>
          ) : (
            <span className="text-small font-num text-accent-sage shrink-0">
              全部勾选
            </span>
          )}
        </div>
      </Link>
      <div className="mt-2 pt-2 border-t border-border-hairline flex items-center justify-between">
        {list.status === 'active' ? (
          <Link
            href={`/restock/${list.list_id}/share`}
            className="inline-flex items-center gap-1 text-small text-accent-sage hover:underline"
            onClick={() =>
              track(Events.ShareLinkGenerated, {
                list_id: list.list_id,
                action: 'home_list_card',
              })
            }
          >
            <Share2 className="h-3.5 w-3.5" /> 分享
            {list.share_enabled && list.share_token && (
              <CheckCircle2 className="h-3 w-3" />
            )}
          </Link>
        ) : (
          <span />
        )}
        <button
          type="button"
          onClick={onArchive}
          className="text-micro text-ink-tertiary hover:text-accent-clay inline-flex items-center gap-1"
        >
          <Trash2 className="h-3 w-3" /> 归档
        </button>
      </div>
    </Card>
  )
}

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="mt-8">
      <h2 className="text-h3 font-semibold text-ink-primary">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  )
}

function formatRelativeTime(iso: string): string {
  const ts = new Date(iso).getTime()
  const diff = Math.floor((Date.now() - ts) / 1000)
  if (diff < 60) return '刚刚'
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`
  if (diff < 604800) return `${Math.floor(diff / 86400)} 天前`
  return new Date(iso).toLocaleDateString('zh-CN')
}
