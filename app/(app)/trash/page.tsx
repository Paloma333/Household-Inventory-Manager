'use client'

import * as React from 'react'
import Link from 'next/link'
import { ArrowLeft, RotateCcw, Trash2 } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { toast } from '@/components/ui/Toast'

/**
 * /trash — 回收站（PRD §3.11）
 *
 * 软删的 items，30 天内可恢复；支持永久删除。
 */

interface TrashItem {
  item_id: string
  canonical_name: string
  brand: string | null
  quantity: number
  unit: string | null
  deleted_at: string | null
  categories: { name: string } | null
}

export default function TrashPage() {
  const [items, setItems] = React.useState<TrashItem[] | null>(null)

  const reload = React.useCallback(async () => {
    try {
      const res = await fetch('/api/trash', { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || '加载失败')
      setItems(json.items ?? [])
    } catch {
      setItems([])
    }
  }, [])

  React.useEffect(() => {
    void reload()
  }, [reload])

  async function onRestore(id: string) {
    try {
      const res = await fetch(`/api/trash/${id}/restore`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok || !json.ok) throw new Error(json.error || '恢复失败')
      toast.info('放回库存了')
      setItems((prev) => prev?.filter((it) => it.item_id !== id) ?? [])
    } catch (e: any) {
      toast.error(e?.message ?? '恢复失败')
    }
  }

  async function onPurge(id: string, name: string) {
    if (!window.confirm(`永久删除「${name}」？它的历史记录也会一起清除，无法恢复。`)) return
    try {
      const res = await fetch(`/api/trash/${id}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok || !json.ok) throw new Error(json.error || '删除失败')
      toast.info('已永久删除')
      setItems((prev) => prev?.filter((it) => it.item_id !== id) ?? [])
    } catch (e: any) {
      toast.error(e?.message ?? '删除失败')
    }
  }

  if (items === null) {
    return (
      <div className="px-6 pt-8 pb-32">
        <BackLink />
        <Skeleton className="h-8 w-1/3" />
        <div className="mt-6 flex flex-col gap-3">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="px-6 pt-8 pb-32">
      <BackLink />
      <h1 className="font-semibold text-h1 text-ink-primary">回收站</h1>
      <p className="mt-2 text-body text-ink-secondary">
        删除的商品在这里待 30 天，可以找回
      </p>

      {items.length === 0 ? (
        <div className="mt-10">
          <EmptyState
            title="回收站是空的"
            description="删除的商品会先到这里，30 天内可恢复"
          />
        </div>
      ) : (
        <section className="mt-6 flex flex-col gap-3">
          {items.map((it) => (
            <Card key={it.item_id} className="p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-body text-ink-primary font-medium truncate">
                    {it.canonical_name}
                  </p>
                  <p className="text-micro text-ink-tertiary mt-0.5">
                    {it.brand ? `${it.brand} · ` : ''}
                    {it.quantity} {it.unit ?? '件'}
                    {it.categories?.name ? ` · ${it.categories.name}` : ''} · 删于{' '}
                    {formatDate(it.deleted_at)}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    aria-label="恢复"
                    onClick={() => onRestore(it.item_id)}
                    className="p-2 rounded-sm text-ink-secondary hover:text-accent-sage"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    aria-label="永久删除"
                    onClick={() => onPurge(it.item_id, it.canonical_name)}
                    className="p-2 rounded-sm text-ink-secondary hover:text-accent-clay"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
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

function formatDate(iso: string | null) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleDateString('zh-CN', {
      month: 'numeric',
      day: 'numeric',
    })
  } catch {
    return ''
  }
}
