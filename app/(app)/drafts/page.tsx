'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, FileText, Trash2 } from 'lucide-react'
import { Btn } from '@/components/ui/Btn'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { toast } from '@/components/ui/Toast'

/**
 * /drafts — 我的草稿（PRD §3.10）
 *
 * AI 确认页「暂存」的识别批次列表；点击继续整理（回确认页），可放弃。
 */

interface Draft {
  recognition_id: string
  source_type: string
  model: string | null
  saved_at: string | null
  created_at: string
  item_count: number
}

const SOURCE_LABEL: Record<string, string> = {
  receipt: '拍的小票',
  screenshot: '购物截图',
  camera: '拍照识物',
}

export default function DraftsPage() {
  const router = useRouter()
  const [drafts, setDrafts] = React.useState<Draft[] | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  const reload = React.useCallback(async () => {
    setError(null)
    try {
      const res = await fetch('/api/drafts', { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || '加载失败')
      setDrafts(json.drafts ?? [])
    } catch (e: any) {
      setError(e?.message ?? '加载失败')
      setDrafts([])
    }
  }, [])

  React.useEffect(() => {
    void reload()
  }, [reload])

  async function onDiscard(id: string) {
    if (!window.confirm('放弃这份草稿？里面的整理结果会丢掉。')) return
    try {
      const res = await fetch(`/api/drafts/${id}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok || !json.ok) throw new Error(json.error || '放弃失败')
      toast.info('已放弃')
      setDrafts((prev) => prev?.filter((d) => d.recognition_id !== id) ?? [])
    } catch (e: any) {
      toast.error(e?.message ?? '放弃失败')
    }
  }

  if (drafts === null) {
    return (
      <div className="px-6 pt-8 pb-32">
        <BackLink />
        <Skeleton className="h-8 w-1/3" />
        <div className="mt-6 flex flex-col gap-3">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="px-6 pt-8 pb-32">
      <BackLink />
      <h1 className="font-semibold text-h1 text-ink-primary">我的草稿</h1>
      <p className="mt-2 text-body text-ink-secondary">
        识别完没入库的批次，先存着，回头接着整理
      </p>

      {drafts.length === 0 ? (
        <div className="mt-10">
          <EmptyState
            title="还没有草稿"
            description="AI 确认页点「暂存」的批次会出现在这里"
          />
        </div>
      ) : (
        <section className="mt-6 flex flex-col gap-3">
          {drafts.map((d) => (
            <Card key={d.recognition_id} className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-md bg-bg-elevated grid place-items-center text-ink-secondary shrink-0">
                  <FileText className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-body text-ink-primary font-medium">
                    {SOURCE_LABEL[d.source_type] ?? '识别批次'} · {d.item_count} 件
                  </p>
                  <p className="text-micro text-ink-tertiary mt-0.5">
                    保存于 {formatTime(d.saved_at ?? d.created_at)}
                  </p>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => onDiscard(d.recognition_id)}
                  className="text-small text-ink-secondary inline-flex items-center gap-1 hover:text-accent-clay"
                >
                  <Trash2 className="h-3.5 w-3.5" /> 放弃
                </button>
                <Btn
                  size="sm"
                  onClick={() => router.push(`/confirm/${d.recognition_id}`)}
                >
                  继续整理
                </Btn>
              </div>
            </Card>
          ))}
        </section>
      )}
    </div>
  )
}

function BackLink() {
  return (
    <Link
      href="/settings"
      className="inline-flex items-center gap-1 text-small text-ink-secondary mb-4"
    >
      <ArrowLeft className="h-4 w-4" /> 我的
    </Link>
  )
}

function formatTime(iso: string) {
  try {
    const d = new Date(iso)
    const now = new Date()
    const sameDay = d.toDateString() === now.toDateString()
    if (sameDay) return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    return d.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })
  } catch {
    return ''
  }
}
