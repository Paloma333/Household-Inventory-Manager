'use client'

import * as React from 'react'
import Link from 'next/link'
import { ArrowRight, AlertTriangle, Clock, Sparkles } from 'lucide-react'
import { Title } from 'animal-island-ui'
import { Btn } from '@/components/ui/Btn'
import { Card } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { Events, track } from '@/lib/analytics'

/**
 * 首页 / 我的小家 — PRD §3.1
 *
 *   - 顶栏欢迎语（时分时问候）+ 装饰图案
 *   - "家里有 N 件" stat
 *   - 品类贴纸条（emoji 色块，替代纯文字清单）
 *   - 低库存 / 临近过期 提醒卡（有数据才显示）
 *   - 最近 3 条变化列表
 *   - 空状态：欢迎引导手动添加
 */

interface RecentEvent {
  event_id: string
  event_type: string
  quantity_change: number
  new_quantity: number
  created_at: string
  item_name: string
}

interface DashboardData {
  householdName: string
  itemCount: number
  lowStockCount: number
  expiringSoonCount: number
  recentEvents: RecentEvent[]
  categoryCounts: Array<{ category_id: string; name: string; count: number }>
}

const EventTypeLabel: Record<string, string> = {
  purchase: '入手',
  consume: '用掉',
  adjust: '调整',
  merge: '合并',
  restock_confirm: '补货',
}

/** 事件 → emoji（最近变化列表用） */
const EVENT_EMOJI: Record<string, string> = {
  purchase: '🛍️',
  consume: '🍽️',
  adjust: '✏️',
  merge: '🧺',
  restock_confirm: '🛒',
}

/** 品类 → 贴纸 emoji（与 inventory 页一致） */
const CATEGORY_EMOJI: Record<string, string> = {
  食品饮料: '🍜',
  生鲜果蔬: '🥬',
  个护美妆: '🧴',
  家居清洁: '🧺',
  健康药品: '💊',
  衣物配件: '🧣',
  数码电器: '🔌',
  其他: '📦',
}

export default function HomePage() {
  const [data, setData] = React.useState<DashboardData | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  const reload = React.useCallback(async () => {
    setError(null)
    try {
      const res = await fetch('/api/dashboard', { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok || json.error) throw new Error(json.error || '加载失败')
      setData(json)
    } catch (e: any) {
      setError(e?.message ?? '加载失败')
    }
  }, [])

  React.useEffect(() => {
    void reload()
    track(Events.AppOpen, { source: 'web' })
  }, [reload])

  const greeting = pickGreeting()
  const itemCount = data?.itemCount ?? 0
  const lowStock = data?.lowStockCount ?? 0
  const expiringSoon = data?.expiringSoonCount ?? 0

  return (
    <div className="relative px-6 pt-10 pb-6 overflow-x-clip">
      {/* 顶部装饰图案：散落的动森风小圆点/叶片（纯装饰，不抢内容） */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-6 right-2 select-none opacity-70"
      >
        <svg width="150" height="110" viewBox="0 0 150 110" fill="none">
          <circle cx="120" cy="18" r="10" className="fill-accent-sage/25" />
          <circle cx="96" cy="52" r="6" className="fill-accent-honey/40" />
          <circle cx="138" cy="72" r="4" className="fill-accent-clay/30" />
          <path
            d="M30 12c8-10 22-10 30 0-8 10-22 10-30 0z"
            className="fill-accent-sage/30"
          />
          <path
            d="M12 60c6-8 17-8 23 0-6 8-17 8-23 0z"
            className="fill-accent-sage/20"
          />
          <circle cx="52" cy="34" r="3" className="fill-accent-honey/50" />
        </svg>
      </div>

      {/* 欢迎语 — 动森燕尾缎带 */}
      <header className="enter-up relative">
        <Title size="large">
          {greeting}，{data?.householdName ?? '我的小家'}
        </Title>
        <div className="mt-3 text-body text-ink-secondary num-roll">
          {data === null ? (
            <Skeleton className="h-5 w-48 mt-1" />
          ) : itemCount === 0 ? (
            '你的小家还是空的，先带第一样东西回来吧'
          ) : (
            <>
              家里有{' '}
              <strong className="text-ink-primary">{itemCount}</strong>{' '}
              件东西
              {data && data.categoryCounts.length > 0 && (
                <>
                  {'，分 '}
                  <strong className="text-ink-primary">
                    {data.categoryCounts.length}
                  </strong>{' '}
                  类
                </>
              )}
            </>
          )}
        </div>
      </header>

      {error && (
        <p className="mt-4 text-small text-accent-clay">{error}</p>
      )}

      {/* 品类贴纸条：emoji 色块一览，点进去就是库存 */}
      {data && data.categoryCounts.length > 0 && (
        <section className="mt-6 -mx-6 px-6">
          <div className="flex gap-2.5 overflow-x-auto no-scrollbar pb-1">
            {data.categoryCounts.map((c) => (
              <Link
                key={c.category_id}
                href="/inventory"
                className="shrink-0 flex flex-col items-center gap-1 group"
                aria-label={`${c.name} ${c.count} 件`}
              >
                <span className="h-14 w-14 grid place-items-center rounded-2xl bg-bg-surface border border-border-hairline text-h2 group-active:scale-95 transition-transform duration-tap">
                  {CATEGORY_EMOJI[c.name] ?? '📦'}
                </span>
                <span className="text-micro text-ink-secondary">
                  {c.count} 件
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* 提醒卡：低库存 + 临期 */}
      {data && (lowStock > 0 || expiringSoon > 0) && (
        <section className="mt-6 flex flex-col gap-3">
          {lowStock > 0 && (
            <Link href="/inventory" className="block">
              <Card kind="lowStock" className="px-4 py-3 flex items-center gap-3 active:scale-[0.99]">
                <AlertTriangle className="h-5 w-5 text-accent-clay" strokeWidth={1.5} />
                <div className="flex-1 min-w-0">
                  <p className="text-body font-semibold">快用完了</p>
                  <p className="text-small text-ink-secondary mt-0.5">
                    {lowStock} 件东西快见底了，去补一补？
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 text-accent-clay" />
              </Card>
            </Link>
          )}
          {expiringSoon > 0 && (
            <Link href="/inventory" className="block">
              <Card className="px-4 py-3 flex items-center gap-3 bg-accent-honey/15 border-accent-honey/40 active:scale-[0.99]">
                <Clock className="h-5 w-5 text-accent-honey" strokeWidth={1.5} />
                <div className="flex-1 min-w-0">
                  <p className="text-body font-semibold">7 天内有东西过期</p>
                  <p className="text-small text-ink-secondary mt-0.5">
                    {expiringSoon} 件快到保质期了
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 text-accent-honey" />
              </Card>
            </Link>
          )}
        </section>
      )}

      {/* 最近变化（只放 3 条） */}
      {data && data.recentEvents.length > 0 && (
        <section className="mt-8">
          <h2 className="text-h3 font-semibold text-ink-primary">最近变化</h2>
          <ul className="mt-3 flex flex-col gap-2">
            {data.recentEvents.slice(0, 3).map((e) => (
              <li key={e.event_id}>
                <Card className="px-4 py-3 flex items-center gap-3">
                  <span
                    aria-hidden
                    className="h-9 w-9 grid place-items-center rounded-pill bg-bg-surface text-body shrink-0"
                  >
                    {EVENT_EMOJI[e.event_type] ?? '✨'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-body font-semibold truncate">{e.item_name}</p>
                    <p className="text-micro text-ink-secondary mt-0.5">
                      {EventTypeLabel[e.event_type] ?? e.event_type} ·{' '}
                      {formatRelativeTime(e.created_at)}
                    </p>
                  </div>
                  <span className="text-small font-num text-ink-secondary shrink-0">
                    家里 {e.new_quantity}
                  </span>
                </Card>
              </li>
            ))}
          </ul>
          <Link
            href="/inventory"
            className="mt-4 inline-flex items-center gap-1 text-small text-accent-sage"
          >
            看全部库存 <ArrowRight className="h-4 w-4" />
          </Link>
        </section>
      )}

      {/* 空状态引导 */}
      {data && data.itemCount === 0 && (
        <section className="mt-10">
          <EmptyState
            title="先把第一样东西带回家"
            description="手动一条、AI 一张小票、或者直接拍冰箱，都行"
            primary={
              <Link href="/add">
                <Btn
                  size="lg"
                  iconTrailing={<ArrowRight className="h-4 w-4" />}
                >
                  添点东西
                </Btn>
              </Link>
            }
          />
        </section>
      )}

      {/* 数据小贴士 */}
      {data && data.itemCount > 0 && (
        <section className="mt-8">
          <Link href="/inventory" className="block">
            <Card className="px-4 py-3 flex items-center gap-3 active:bg-bg-elevated">
              <Sparkles className="h-5 w-5 text-accent-sage" strokeWidth={1.5} />
              <div className="flex-1">
                <p className="text-body font-semibold">看看小家现在有什么</p>
                <p className="text-small text-ink-secondary mt-0.5">
                  按分类浏览、搜索、或点开看历史
                </p>
              </div>
              <ArrowRight className="h-4 w-4 text-ink-secondary" />
            </Card>
          </Link>
        </section>
      )}
    </div>
  )
}

function pickGreeting(): string {
  const h = new Date().getHours()
  if (h < 5) return '夜深了'
  if (h < 11) return '早上好'
  if (h < 14) return '午饭好'
  if (h < 18) return '下午好'
  if (h < 22) return '晚上好'
  return '夜深了'
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
