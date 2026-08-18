'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Link as LinkIcon,
  Copy,
  RefreshCw,
  Share2,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react'
import { Btn } from '@/components/ui/Btn'
import { Card } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { toast } from '@/components/ui/Toast'
import { Events, track } from '@/lib/analytics'
import type { RestockList } from '@/lib/restock/types'

/**
 * /restock/[listId]/share — 把清单分享出去（PRD §3.7）
 *
 * - 显示/复制短链 URL（base URL + /r/{token}）
 * - 一键复制纯文本（自定义消息 + 条目 + 链接）
 * - 重新生成 token（撤销后重发）
 * - 撤掉分享（关闭 share_enabled）
 */
type Props = { params: { listId: string } }

export default function ShareListPage({ params }: Props) {
  const router = useRouter()
  const [list, setList] = React.useState<RestockList | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [regenerating, setRegenerating] = React.useState(false)
  const [origin, setOrigin] = React.useState('')

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      setOrigin(window.location.origin)
    }
  }, [])

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

  const shareUrl = list?.share_token && origin ? `${origin}/r/${list.share_token}` : ''

  async function ensureShareToken(): Promise<string | null> {
    if (!list) return null
    // 没开过 → 打开
    if (!list.share_enabled || !list.share_token) {
      try {
        const res = await fetch(`/api/restock/${list.list_id}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ share_enabled: true }),
        })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || '开启分享失败')
        await reload()
        return (json.list as RestockList).share_token ?? null
      } catch (e: any) {
        toast.error(`开启分享失败：${e?.message ?? ''}`)
        return null
      }
    }
    return list.share_token
  }

  async function handleCopyLink() {
    const token = await ensureShareToken()
    if (!token || !origin) return
    const url = `${origin}/r/${token}`
    const ok = await copyToClipboard(url)
    if (ok) {
      toast.info('链接已复制', { durationMs: 2000 })
      track(Events.ShareLinkCopied, { list_id: list?.list_id, kind: 'url' })
    } else {
      toast.error('复制失败，请手动选择')
    }
  }

  async function handleCopyText() {
    const token = await ensureShareToken()
    if (!token || !list || !origin) return
    const url = `${origin}/r/${token}`
    const text = buildShareText(list, url)
    const ok = await copyToClipboard(text)
    if (ok) {
      toast.info('文本已复制 · 长按对话框可直接粘贴', { durationMs: 3000 })
      track(Events.ShareLinkCopied, { list_id: list.list_id, kind: 'text' })
    } else {
      toast.error('复制失败')
    }
  }

  async function handleRegenerate() {
    if (!list) return
    if (!confirm('重新生成分享链接？原来的链接立刻失效。')) return
    setRegenerating(true)
    try {
      // PATCH share_enabled: true → service 端会生成新 token
      const res = await fetch(`/api/restock/${list.list_id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ share_enabled: true }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || '重置失败')
      track(Events.ShareLinkGenerated, {
        list_id: list.list_id,
        action: 'regenerate',
      })
      await reload()
      toast.info('链接已重新生成')
    } catch (e: any) {
      toast.error(`重置失败：${e?.message ?? ''}`)
    } finally {
      setRegenerating(false)
    }
  }

  async function handleDisable() {
    if (!list) return
    if (!confirm('关掉分享？收到链接的人打开会看到 404。')) return
    try {
      const res = await fetch(`/api/restock/${list.list_id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ share_enabled: false }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || '关闭失败')
      track(Events.ShareLinkGenerated, {
        list_id: list.list_id,
        action: 'disable',
      })
      await reload()
      toast.info('已关闭分享')
    } catch (e: any) {
      toast.error(`关闭失败：${e?.message ?? ''}`)
    }
  }

  if (error && !list) {
    return (
      <div className="px-6 pt-10 pb-6">
        <Empty>
          <Btn onClick={() => router.refresh()}>重试</Btn>
        </Empty>
      </div>
    )
  }

  if (!list) {
    return (
      <div className="px-6 pt-10 pb-6">
        <Skeleton className="h-7 w-32 mb-4" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="mt-3 h-14 w-full" />
        <Skeleton className="mt-3 h-14 w-full" />
      </div>
    )
  }

  return (
    <div className="px-6 pt-10 pb-32">
      <Link
        href={`/restock/${list.list_id}`}
        className="inline-flex items-center gap-1 text-small text-ink-secondary"
      >
        <ArrowLeft className="h-4 w-4" /> 返回清单
      </Link>

      <header className="mt-4">
        <h1 className="font-semibold text-h1 text-ink-primary flex items-center gap-2">
          <Share2 className="h-6 w-6" strokeWidth={1.5} /> 分享清单
        </h1>
        <p className="mt-2 text-body text-ink-secondary">
          {list.name} · {list.bought_count}/{list.item_count} 件勾上
        </p>
      </header>

      {list.status !== 'active' && (
        <p className="mt-4 text-small text-accent-clay">
          清单已 {list.status === 'completed' ? '完成' : '归档'}，无法分享。
        </p>
      )}

      {/* 分享链接卡 */}
      {list.status === 'active' && (
        <Card className="mt-6 px-4 py-4">
          {list.share_enabled && shareUrl ? (
            <>
              <p className="text-small text-ink-secondary">分享链接</p>
              <p className="mt-1 break-all font-num text-body text-ink-primary select-all">
                {shareUrl}
              </p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <Btn
                  block
                  variant="primary"
                  size="md"
                  iconLeading={<Copy className="h-4 w-4" />}
                  onClick={handleCopyLink}
                >
                  复制链接
                </Btn>
                <Btn
                  block
                  variant="secondary"
                  size="md"
                  iconLeading={<LinkIcon className="h-4 w-4" />}
                  onClick={handleCopyText}
                >
                  复制文本
                </Btn>
              </div>
              <a
                href={shareUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-1 text-small text-accent-sage"
                onClick={() =>
                  track(Events.ShareLinkViewed, {
                    list_id: list.list_id,
                    surface: 'preview',
                  })
                }
              >
                打开看看 <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </>
          ) : (
            <div>
              <p className="text-small text-ink-secondary">
                还没有分享链接。
              </p>
              <Btn
                block
                size="md"
                className="mt-3"
                iconLeading={<Share2 className="h-4 w-4" />}
                onClick={handleCopyLink}
              >
                开启分享
              </Btn>
            </div>
          )}
        </Card>
      )}

      {/* 预览文本 */}
      {list.status === 'active' && list.share_enabled && (
        <Card className="mt-3 px-4 py-4">
          <p className="text-small text-ink-secondary">复制这段文本发出去</p>
          <pre className="mt-2 whitespace-pre-wrap text-small text-ink-primary bg-bg-canvas rounded-sm p-3 leading-relaxed">
            {buildShareText(list, shareUrl)}
          </pre>
        </Card>
      )}

      {/* 管理 */}
      {list.status === 'active' && list.share_enabled && (
        <section className="mt-6 flex flex-col gap-2">
          <p className="text-small text-ink-secondary">管理</p>
          <Btn
            block
            variant="ghost"
            size="md"
            iconLeading={<RefreshCw className="h-4 w-4" />}
            loading={regenerating}
            onClick={handleRegenerate}
          >
            重新生成链接（旧的作废）
          </Btn>
          <Btn
            block
            variant="ghost"
            size="md"
            onClick={handleDisable}
            className="text-accent-clay hover:bg-accent-clay/10"
          >
            关闭分享
          </Btn>
        </section>
      )}

      {/* 提示 */}
      <p className="mt-8 text-micro text-ink-tertiary leading-relaxed">
        看到链接的任何人（不用登录）都能读清单。已勾选 ✓ 和待购 ◻️ 都会显示。
        想安全收回：随时点这里"关闭分享"或"重新生成链接"。
      </p>
    </div>
  )
}

// ───────── helpers ─────────
function buildShareText(list: RestockList, url: string): string {
  const head = `🛒 ${list.name}`
  const lines = list.items.map((it) => {
    const box = it.bought ? '✓' : '◻️'
    const qty = `${it.needed_qty}${it.snapshot_unit ?? '件'}`
    const brand = it.snapshot_brand ? ` · ${it.snapshot_brand}` : ''
    return `${box} ${it.snapshot_name}${brand}（${qty}）`
  })
  const totalQty = list.items.reduce((s, it) => s + Number(it.needed_qty), 0)
  const summary = `${list.bought_count}/${list.item_count} 勾上了 · 共 ${totalQty} 件`
  return [head, ...lines, summary, url].join('\n')
}

async function copyToClipboard(text: string): Promise<boolean> {
  if (typeof navigator === 'undefined') return false
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // fallback
  }
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    document.body.removeChild(ta)
    return true
  } catch {
    return false
  }
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-10 text-center text-ink-secondary">
      <CheckCircle2 className="mx-auto h-6 w-6" strokeWidth={1.5} />
      <p className="mt-2 text-body">加载出错了</p>
      <div className="mt-4">{children}</div>
    </div>
  )
}
