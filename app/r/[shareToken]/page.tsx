/**
 * /r/[shareToken] — 公开只读的购物清单页（无需登录）
 *
 * 这是分享出去的落地页。任何拿到链接的人都能看：
 *   - 清单名
 *   - 条目 + 勾选状态
 *   - 进度
 *
 * 不做的事：
 *   - 不显示 household 名字
 *   - 不显示 user / 隐私字段
 *   - 不允许写操作
 */
'use client'

import * as React from 'react'
import Link from 'next/link'
import { ShoppingCart, Check, AlertTriangle } from 'lucide-react'
import { Btn } from '@/components/ui/Btn'
import { Card } from '@/components/ui/Card'
import { Events, track } from '@/lib/analytics'

interface SharedItem {
  id: string
  snapshot_name: string
  snapshot_brand: string | null
  snapshot_unit: string | null
  needed_qty: number
  bought: boolean
}

interface SharedList {
  list_id: string
  name: string
  status: 'active' | 'completed' | 'archived'
  share_enabled: boolean
  created_at: string
  items: SharedItem[]
}

type Props = { params: { shareToken: string } }

export default function PublicRestockPage({ params }: Props) {
  const [list, setList] = React.useState<SharedList | null>(null)
  const [error, setError] = React.useState<'not_found' | 'network' | null>(null)

  React.useEffect(() => {
    const t = params.shareToken
    if (!t) {
      setError('not_found')
      return
    }
    let cancelled = false
    fetch(`/api/r/share/${t}`, { cache: 'no-store' })
      .then(async (r) => {
        if (cancelled) return
        if (r.status === 404) {
          setError('not_found')
          return
        }
        if (!r.ok) {
          setError('network')
          return
        }
        const json = await r.json()
        setList(json.list as SharedList)
        track(Events.ShareLinkViewed, {
          list_id: (json.list as SharedList)?.list_id,
          source: 'public_link',
        })
      })
      .catch(() => {
        if (!cancelled) setError('network')
      })
    return () => {
      cancelled = true
    }
  }, [params.shareToken])

  if (error === 'not_found') {
    return (
      <div className="min-h-screen bg-bg-canvas flex items-center justify-center p-6">
        <Card className="max-w-md w-full px-6 py-10 text-center">
          <AlertTriangle
            className="mx-auto h-10 w-10 text-accent-clay"
            strokeWidth={1.5}
          />
          <h1 className="mt-4 font-semibold text-h1 text-ink-primary">
            找不到这份清单
          </h1>
          <p className="mt-2 text-body text-ink-secondary">
            链接可能失效了，或者主人已经关掉分享。
          </p>
          <Link
            href="https://him.example.com"
            className="mt-6 inline-block"
          >
            <Btn>了解小屋</Btn>
          </Link>
        </Card>
      </div>
    )
  }

  if (error === 'network' || (!list && !error)) {
    return (
      <div className="min-h-screen bg-bg-canvas flex items-center justify-center p-6">
        <Card className="max-w-md w-full px-6 py-10 text-center">
          <p className="text-body text-ink-secondary">加载中…</p>
        </Card>
      </div>
    )
  }

  const total = list!.items.length
  const bought = list!.items.filter((it) => it.bought).length
  const totalQty = list!.items.reduce(
    (s, it) => s + Number(it.needed_qty),
    0
  )
  const allChecked = total > 0 && bought === total

  return (
    <div className="min-h-screen bg-bg-canvas">
      <div className="mx-auto max-w-screen-sm px-6 pt-10 pb-24">
        {/* 头部 */}
        <header>
          <div className="flex items-center gap-2 text-small text-ink-secondary">
            <ShoppingCart className="h-4 w-4" strokeWidth={1.5} />
            <span>来自小屋的购物清单</span>
          </div>
          <h1 className="mt-3 font-semibold text-h1 text-ink-primary break-all">
            {list!.name}
          </h1>
          <div className="mt-3 flex items-center gap-3 text-small text-ink-secondary">
            <span className="font-num">
              <strong className={allChecked ? 'text-accent-sage' : 'text-ink-primary'}>
                {bought}
              </strong>{' '}
              / {total} 勾上了
            </span>
            <span>·</span>
            <span className="font-num">共 {totalQty} 件</span>
          </div>
          {total > 0 && (
            <div className="mt-3 h-1 w-full bg-bg-elevated rounded-pill overflow-hidden">
              <div
                className="h-full bg-accent-sage transition-all duration-tap"
                style={{ width: `${(bought / total) * 100}%` }}
              />
            </div>
          )}
        </header>

        {/* 条目 */}
        <section className="mt-8">
          {list!.items.length === 0 ? (
            <Card className="px-4 py-10 text-center">
              <p className="text-body text-ink-secondary">清单还是空的</p>
            </Card>
          ) : (
            <ul className="flex flex-col gap-2">
              {list!.items.map((it) => (
                <li key={it.id}>
                  <Card
                    className={`px-4 py-3 ${
                      it.bought ? 'bg-accent-sage-soft' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className={`mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-xs border-2 ${
                          it.bought
                            ? 'bg-accent-sage border-accent-sage text-bg-elevated'
                            : 'border-border-default'
                        }`}
                      >
                        {it.bought && (
                          <Check className="h-4 w-4" strokeWidth={3} />
                        )}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p
                          className={`text-body ${
                            it.bought
                              ? 'text-ink-secondary line-through'
                              : 'text-ink-primary'
                          }`}
                        >
                          {it.snapshot_name}
                          {it.snapshot_brand && (
                            <span className="text-ink-tertiary">
                              {' · '}
                              {it.snapshot_brand}
                            </span>
                          )}
                        </p>
                        <p className="mt-1 text-small text-ink-secondary font-num">
                          {it.needed_qty} {it.snapshot_unit ?? '件'}
                        </p>
                      </div>
                    </div>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* 底部引导 */}
        <footer className="mt-12 text-center">
          <p className="text-small text-ink-secondary">
            也是想把自己家里管得清清爽爽？
          </p>
          <Link
            href="https://him.example.com"
            className="inline-block mt-3"
          >
            <Btn>了解小屋</Btn>
          </Link>
          <p className="mt-6 text-micro text-ink-tertiary">
            这是只读视图 · 看到链接的人都可以阅读
          </p>
        </footer>
      </div>
    </div>
  )
}
