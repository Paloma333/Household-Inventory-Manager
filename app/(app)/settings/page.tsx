'use client'

import * as React from 'react'
import Link from 'next/link'
import {
  ChevronRight,
  Download,
  FileText,
  Info,
  LogOut,
  MessageCircle,
  Pencil,
  Trash2,
  X,
  Check,
} from 'lucide-react'
import { Btn } from '@/components/ui/Btn'
import { Title } from 'animal-island-ui'
import { Card } from '@/components/ui/Card'
import { toast } from '@/components/ui/Toast'
import { getBrowserSupabase } from '@/lib/supabase/client'

/**
 * /settings — 我的（PRD §3.8）
 *
 * 小屋名编辑 · 草稿 / 回收站入口 · 导出 CSV/JSON · 关于与反馈 · 退出
 */

export default function SettingsPage() {
  const [email, setEmail] = React.useState<string | null>(null)
  const [household, setHousehold] = React.useState<{
    name: string
    created_at: string
    item_count: number
  } | null>(null)
  const [draftCount, setDraftCount] = React.useState(0)
  const [trashCount, setTrashCount] = React.useState(0)
  const [editing, setEditing] = React.useState(false)
  const [nameDraft, setNameDraft] = React.useState('')
  const [saving, setSaving] = React.useState(false)

  const reload = React.useCallback(async () => {
    const supabase = getBrowserSupabase()
    const { data } = await supabase.auth.getUser()
    setEmail(data.user?.email ?? null)

    const [hhRes, draftRes, trashRes] = await Promise.all([
      fetch('/api/household', { cache: 'no-store' }),
      fetch('/api/drafts', { cache: 'no-store' }),
      fetch('/api/trash', { cache: 'no-store' }),
    ])
    if (hhRes.ok) {
      const hh = await hhRes.json()
      setHousehold(hh.household ?? null)
    }
    if (draftRes.ok) {
      const d = await draftRes.json()
      setDraftCount(d.drafts?.length ?? 0)
    }
    if (trashRes.ok) {
      const t = await trashRes.json()
      setTrashCount(t.items?.length ?? 0)
    }
  }, [])

  React.useEffect(() => {
    void reload()
  }, [reload])

  async function onSaveName() {
    const name = nameDraft.trim()
    if (!name) {
      toast.error('名字不能为空')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/household', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) throw new Error(json.error || '保存失败')
      setHousehold((prev) => (prev ? { ...prev, name: json.name } : prev))
      setEditing(false)
      toast.info('小屋名字改好啦')
    } catch (e: any) {
      toast.error(e?.message ?? '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const onSignOut = async () => {
    const supabase = getBrowserSupabase()
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  const daysUsed = household?.created_at
    ? Math.max(1, Math.floor((Date.now() - new Date(household.created_at).getTime()) / 86400000) + 1)
    : null

  return (
    <div className="px-6 pt-10 pb-6">
      <header>
        <Title size="large">我的</Title>
        <p className="mt-3 text-body text-ink-secondary">
          {daysUsed !== null
            ? `第 ${daysUsed} 天 · ${household?.item_count ?? 0} 件东西陪着你`
            : '家里还在等第一件东西'}
        </p>
      </header>

      <section className="mt-8">
        <Card className="p-4">
          <p className="text-small text-ink-secondary">登录账号</p>
          <p className="mt-1 text-body font-medium">{email ?? '加载中…'}</p>
        </Card>
      </section>

      <section className="mt-6">
        <h2 className="text-h3 font-semibold mb-3">小屋</h2>
        <Card className="p-4">
          {editing ? (
            <div className="flex items-center gap-2">
              <input
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                maxLength={12}
                placeholder="最多 12 个字"
                autoFocus
                className="flex-1 rounded-md border border-border-hairline bg-bg-canvas px-3 py-2 text-body text-ink-primary placeholder:text-ink-tertiary focus:outline-none focus:ring-2 focus:ring-accent-sage/40"
              />
              <button
                type="button"
                aria-label="保存"
                onClick={onSaveName}
                disabled={saving}
                className="p-2 rounded-sm text-accent-sage hover:bg-bg-elevated disabled:opacity-45"
              >
                <Check className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-label="取消"
                onClick={() => {
                  setEditing(false)
                  setNameDraft(household?.name ?? '')
                }}
                className="p-2 rounded-sm text-ink-secondary hover:bg-bg-elevated"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setNameDraft(household?.name ?? '我的小屋')
                setEditing(true)
              }}
              className="w-full flex items-center justify-between gap-2"
            >
              <span className="text-body">小屋名称</span>
              <span className="inline-flex items-center gap-1 text-ink-secondary">
                {household?.name ?? '我的小屋'}
                <Pencil className="h-3.5 w-3.5" />
              </span>
            </button>
          )}
        </Card>
      </section>

      <section className="mt-6">
        <h2 className="text-h3 font-semibold mb-3">数据</h2>
        <ul className="flex flex-col gap-2">
          <Link href="/drafts">
            <Card className="p-4 flex items-center justify-between">
              <span className="text-body inline-flex items-center gap-2">
                <FileText className="h-4 w-4 text-ink-secondary" /> 草稿
              </span>
              <span className="inline-flex items-center gap-1 text-ink-secondary">
                {draftCount}
                <ChevronRight className="h-4 w-4" />
              </span>
            </Card>
          </Link>
          <Link href="/trash">
            <Card className="p-4 flex items-center justify-between">
              <span className="text-body inline-flex items-center gap-2">
                <Trash2 className="h-4 w-4 text-ink-secondary" /> 回收站
              </span>
              <span className="inline-flex items-center gap-1 text-ink-secondary">
                {trashCount > 0 ? `${trashCount} · 30 天内可恢复` : '空的'}
                <ChevronRight className="h-4 w-4" />
              </span>
            </Card>
          </Link>
          <Card className="p-4">
            <p className="text-body inline-flex items-center gap-2">
              <Download className="h-4 w-4 text-ink-secondary" /> 导出我的库存
            </p>
            <div className="mt-3 flex gap-2">
              <a
                href="/api/export?format=csv"
                className="flex-1 inline-flex items-center justify-center h-9 rounded-md bg-bg-surface text-body text-ink-primary border border-border-hairline hover:bg-bg-elevated"
              >
                CSV
              </a>
              <a
                href="/api/export?format=json"
                className="flex-1 inline-flex items-center justify-center h-9 rounded-md bg-bg-surface text-body text-ink-primary border border-border-hairline hover:bg-bg-elevated"
              >
                JSON
              </a>
            </div>
          </Card>
        </ul>
      </section>

      <section className="mt-6">
        <h2 className="text-h3 font-semibold mb-3">更多</h2>
        <ul className="flex flex-col gap-2">
          <Link href="/about">
            <Card className="p-4 flex items-center justify-between">
              <span className="text-body inline-flex items-center gap-2">
                <Info className="h-4 w-4 text-ink-secondary" /> 关于小屋
              </span>
              <ChevronRight className="h-4 w-4 text-ink-secondary" />
            </Card>
          </Link>
          <Link href="/feedback">
            <Card className="p-4 flex items-center justify-between">
              <span className="text-body inline-flex items-center gap-2">
                <MessageCircle className="h-4 w-4 text-ink-secondary" /> 反馈
              </span>
              <ChevronRight className="h-4 w-4 text-ink-secondary" />
            </Card>
          </Link>
        </ul>
      </section>

      <section className="mt-10">
        <Btn
          variant="subtle"
          block
          iconLeading={<LogOut className="h-4 w-4" />}
          onClick={onSignOut}
        >
          先出去一下
        </Btn>
      </section>
    </div>
  )
}
