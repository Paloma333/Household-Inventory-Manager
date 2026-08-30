'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Check,
  Pencil,
  Sparkles,
  Trash2,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  ImageIcon,
  RefreshCw,
  Save,
} from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Btn } from '@/components/ui/Btn'
import { Skeleton } from '@/components/ui/Skeleton'
import { toast } from '@/components/ui/Toast'
import { Events, track } from '@/lib/analytics'
import { fieldTier, type ConfidenceTier } from '@/lib/ai/types'

/**
 * /confirm/[batchId] — Sprint 2 核心确认页
 *
 * PRD §11.2
 *  - 三档置信度分级（high / mid / low）
 *  - 可逐项编辑任意字段
 *  - 重复购买三分支：
 *    a. strict_match → 自动建议"合并到现有的"
 *    b. fuzzy_match → 让用户在"合并"/"新建"间选
 *    c. new_item → 默认新建
 *  - 底部"一键入库"
 *  - 错误/重试入口
 */

type DuplicateStatus = 'strict_match' | 'fuzzy_match' | 'new_item'
type Action = 'merge' | 'keep_separate' | 'skip'

interface ItemRow {
  recognition_item_id: string
  raw_name: string
  name: string
  brand: string | null
  quantity: number
  unit: string | null
  package_quantity: number | null
  category_id: string | null
  category_hint: string | null
  expiry_date: string | null
  restock_hint: boolean | null
  restock_alert: boolean
  confidence: {
    name: number
    quantity: number
    category: number
    unit: number
    package_quantity: number
    expiry_date: number
  }
  duplicate: {
    status: DuplicateStatus
    score: number
    matched: {
      item_id: string
      canonical_name: string
      quantity: number
    } | null
  }
  action: Action
  corrected: boolean
  expanded: boolean
}

/**
 * 档级徽章：
 * - high → 不显示文字，只显示绿色打勾 icon（AI 结果可信）
 * - mid / low → 统一显示「待确认」（不暴露"高置信/需修正"这种术语）
 */
const TIER_STYLES: Record<ConfidenceTier, { bg: string; text: string; label: string }> = {
  high: { bg: 'bg-accent-sage', text: 'text-white', label: '' },
  mid: { bg: 'bg-honey-soft', text: 'text-honey-ink', label: '待确认' },
  low: { bg: 'bg-honey-soft', text: 'text-honey-ink', label: '待确认' },
}

export default function ConfirmPage({
  params,
}: {
  params: { batchId: string }
}) {
  const router = useRouter()
  const batchId = params.batchId
  const [loading, setLoading] = React.useState(true)
  const [loadErr, setLoadErr] = React.useState<string | null>(null)
  const [task, setTask] = React.useState<{
    recognition_id: string
    status: string
    source_type: string
    image_url_preview: string | null
    image_urls_preview: string[] | null
    model: string
    processing_time_ms: number | null
    created_at: string
  } | null>(null)

  const [items, setItems] = React.useState<ItemRow[]>([])
  const [cats, setCats] = React.useState<CategoryNode[] | null>(null)
  const [submitting, setSubmitting] = React.useState(false)

  // 加载主任务 + 分类
  React.useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [res, cRes] = await Promise.all([
          fetch(`/api/recognition/${batchId}`),
          fetch('/api/categories'),
        ])
        if (!res.ok) throw new Error(`加载失败 HTTP ${res.status}`)
        const data = await res.json()
        const cData = cRes.ok ? await cRes.json() : { categories: [] }

        if (cancelled) return
        if (data.task?.status === 'confirmed') {
          toast.info('这次识别已经入库过了')
          router.replace('/inventory')
          router.refresh()
          return
        }
        setTask(data.task)
        // 草稿恢复：暂存时把编辑状态存进了 task.draft_json.decisions
        const draftDecisions = (data.task?.draft_json?.decisions ?? []) as Array<{
          recognition_item_id: string
          action: Action
          final_name?: string
          final_quantity?: number
          final_unit?: string | null
          final_brand?: string | null
          final_category_id?: string | null
          final_package_quantity?: number | null
          final_expiry_date?: string | null
          matched_item_id?: string | null
          restock_alert?: boolean
        }>
        const draftMap = new Map(
          draftDecisions.map((d) => [d.recognition_item_id, d])
        )
        // 分类名 → category_id 映射（AI 的 category_hint 自动选中用）
        const catByName = new Map<string, string>()
        ;(cData.categories ?? []).forEach((c: CategoryNode) => {
          catByName.set(c.name.trim(), c.category_id)
          c.children.forEach((sub) =>
            catByName.set(sub.name.trim(), sub.category_id)
          )
        })
        setItems(
          (data.items ?? []).map((row: any): ItemRow => {
            const tier = computeTier(row.confidence_json ?? row.confidence)
            const saved = draftMap.get(row.recognition_item_id)
            const defaultAction =
              row.duplicate?.status === 'strict_match' || row.duplicate?.status === 'fuzzy_match'
                ? 'merge'
                : 'keep_separate'
            // AI 分类 hint → 自动选中对应大类
            const hint = row.category_hint ?? null
            const autoCatId = hint ? catByName.get(hint.trim()) ?? null : null
            return {
              recognition_item_id: row.recognition_item_id,
              raw_name: row.raw_name,
              name: saved?.final_name ?? row.final_name ?? row.predicted_name ?? '',
              brand: saved?.final_brand ?? row.predicted_brand ?? null,
              quantity:
                saved?.final_quantity ?? row.final_quantity ?? row.predicted_quantity ?? 1,
              unit: saved?.final_unit ?? row.final_unit ?? row.predicted_unit ?? null,
              package_quantity:
                saved?.final_package_quantity ??
                row.final_package_quantity ??
                row.predicted_package_quantity ??
                null,
              category_id:
                saved?.final_category_id ?? row.final_category_id ?? autoCatId,
              category_hint: hint,
              expiry_date: saved?.final_expiry_date ?? row.predicted_expiry_date ?? null,
              restock_hint: row.restock_hint ?? null,
              restock_alert: saved?.restock_alert ?? row.restock_hint ?? false,
              confidence: row.confidence_json ?? row.confidence,
              duplicate: row.duplicate,
              action: saved?.action ?? defaultAction,
              corrected: false,
              expanded: tier === 'low',
            }
          })
        )
        setCats(cData.categories ?? [])
        setLoading(false)

        // 埋：batch 加载完成 + duplicate detected 数
        const dupCount = (data.items ?? []).filter(
          (r: any) => r.duplicate?.status !== 'new_item' && r.duplicate?.matched
        ).length
        track(Events.DuplicateDetected, {
          batch_id: batchId,
          total_items: (data.items ?? []).length,
          duplicate_count: dupCount,
        })
      } catch (e: unknown) {
        if (!cancelled) {
          setLoadErr(e instanceof Error ? e.message : '加载失败')
          setLoading(false)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [batchId, router])

  function patchItem(idx: number, patch: Partial<ItemRow>) {
    setItems((prev) =>
      prev.map((it, i) => (i === idx ? { ...it, ...patch, corrected: true } : it))
    )
  }

  function setAction(idx: number, action: Action) {
    setItems((prev) =>
      prev.map((it, i) =>
        i === idx
          ? {
              ...it,
              action,
              // 选 merge 但没 matched_item_id 时降级到 keep_separate
              ...(action === 'merge' && !it.duplicate?.matched
                ? { action: 'keep_separate' }
                : {}),
              corrected: action === 'skip' ? it.corrected : true,
            }
          : it
      )
    )
  }

  function buildDecisions() {
    return items.map((it) => {
      const base: any = {
        recognition_item_id: it.recognition_item_id,
        action: it.action,
        final_name: it.name.trim(),
        final_quantity: Number(it.quantity) || 0,
        corrected: it.corrected,
      }
      if (it.unit) base.final_unit = it.unit
      if (it.brand) base.final_brand = it.brand
      if (it.category_id) base.final_category_id = it.category_id
      if (it.package_quantity) base.final_package_quantity = Number(it.package_quantity)
      if (it.expiry_date) base.final_expiry_date = it.expiry_date
      // 快用完提醒开关（勾选才建 low_stock_rule）
      base.restock_alert = it.restock_alert
      if (it.action === 'merge' && it.duplicate?.matched) {
        base.matched_item_id = it.duplicate.matched.item_id
      }
      return base
    })
  }

  // 暂存为草稿（PRD §3.10）—— 不入库，存编辑状态，改天继续
  const [savingDraft, setSavingDraft] = React.useState(false)

  async function onSaveDraft() {
    if (items.length === 0) return
    setSavingDraft(true)
    try {
      const res = await fetch(`/api/recognition/${batchId}/draft`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ decisions: buildDecisions() }),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) throw new Error(json.error || '暂存失败')
      toast.info('已暂存，去「我的 → 草稿」可以继续')
      router.push('/drafts')
      router.refresh()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : '暂存失败')
    } finally {
      setSavingDraft(false)
    }
  }

  async function onSubmit() {
    if (items.length === 0) {
      router.push('/inventory')
      return
    }
    setSubmitting(true)
    try {
      const decisions = buildDecisions()

      const res = await fetch(`/api/recognition/${batchId}/confirm`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ decisions }),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) throw new Error(json.error || '入库失败')

      const s = json.summary

      // 统计：duplicate_confirmed 数 = merge 数；item_corrected 数 = corrected=true 的数
      const correctedCount = decisions.filter((d) => d.corrected).length
      const strictDuplicateCount = decisions.filter(
        (d) => d.action === 'merge' && !!d.matched_item_id
      ).length
      track(Events.ItemConfirmed, {
        batch_id: batchId,
        ...s,
      })
      if (correctedCount > 0) {
        track(Events.RecognitionItemCorrected, {
          batch_id: batchId,
          corrected_count: correctedCount,
        })
      }
      if (strictDuplicateCount > 0) {
        track(Events.DuplicateConfirmed, {
          batch_id: batchId,
          merged_count: strictDuplicateCount,
        })
      }

      const msg =
        s.new_items + s.merged === 0
          ? '已跳过所有商品'
          : `已添加 ${s.new_items} 件，合并 ${s.merged} 件，跳过 ${s.skipped} 件`
      toast.info(msg, { durationMs: 2500 })

      router.push('/inventory')
      router.refresh()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : '入库失败')
    } finally {
      setSubmitting(false)
    }
  }

  // ───────── 渲染 ─────────
  if (loading) {
    return (
      <div className="px-6 pt-8 pb-32">
        <Link
          href="/add"
          className="inline-flex items-center gap-1 text-small text-ink-secondary mb-4"
        >
          <ArrowLeft className="h-4 w-4" /> 添点东西
        </Link>
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="mt-3 h-5 w-3/4" />
        <div className="mt-8 flex flex-col gap-3">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      </div>
    )
  }

  if (loadErr || !task) {
    return (
      <div className="px-6 pt-8 pb-32">
        <Link
          href="/add"
          className="inline-flex items-center gap-1 text-small text-ink-secondary mb-4"
        >
          <ArrowLeft className="h-4 w-4" /> 添点东西
        </Link>
        <h1 className="font-semibold text-h1 text-ink-primary">没找到这个识别</h1>
        <p className="mt-2 text-body text-ink-secondary">{loadErr}</p>
        <div className="mt-6">
          <Btn
            size="lg"
            onClick={() => router.push('/add')}
            iconLeading={<RefreshCw className="h-5 w-5" />}
          >
            重新添加
          </Btn>
        </div>
      </div>
    )
  }

  const pendingCount = items.filter(
    (it) => it.action !== 'skip' && computeTier(it.confidence) !== 'high'
  ).length
  const enabledCount = items.filter((it) => it.action !== 'skip').length

  return (
    <div className="px-6 pt-8 pb-32">
      <Link
        href="/add"
        className="inline-flex items-center gap-1 text-small text-ink-secondary mb-4"
      >
        <ArrowLeft className="h-4 w-4" /> 添点东西
      </Link>

      <header>
        {task.status === 'draft' && (
          <p className="mb-3 text-micro text-accent-honey inline-flex items-center gap-1">
            <Save className="h-3 w-3" /> 这是上次暂存的草稿，接着整理
          </p>
        )}
        <h1 className="font-semibold text-h1 text-ink-primary">AI 整理好啦</h1>
        <p className="mt-2 text-body text-ink-secondary">
          {task.source_type === 'receipt'
            ? '小票上的商品'
            : task.source_type === 'screenshot'
              ? '截图里的商品'
              : '拍到的商品'}
          ，核对下再加进小屋
        </p>
        {task.model?.startsWith('mock') && (
          <p className="mt-2 text-micro text-accent-honey inline-flex items-center gap-1">
            <Sparkles className="h-3 w-3" /> MOCK 演示数据，没消耗真实 token
          </p>
        )}
      </header>

      {/* 预览图 + 统计（多图批次显示缩略图组） */}
      <section className="mt-6 flex items-start gap-3 rounded-md bg-bg-canvas p-3">
        <div className="flex gap-1.5 shrink-0">
          {(task.image_urls_preview && task.image_urls_preview.length > 0
            ? task.image_urls_preview
            : task.image_url_preview
              ? [task.image_url_preview]
              : []
          )
            .slice(0, 3)
            .map((url, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={url + i}
                src={url}
                alt={`识别原图 ${i + 1}`}
                className="h-16 w-16 rounded-sm object-cover border border-border-hairline"
              />
            ))}
          {(task.image_urls_preview?.length ?? 0) > 3 && (
            <div className="h-16 w-16 rounded-sm bg-bg-elevated grid place-items-center text-small text-ink-secondary">
              +{(task.image_urls_preview?.length ?? 3) - 3}
            </div>
          )}
          {!(task.image_urls_preview?.length) && !task.image_url_preview && (
            <div className="h-16 w-16 rounded-sm bg-bg-elevated grid place-items-center text-ink-secondary">
              <ImageIcon className="h-6 w-6" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-small text-ink-primary">
            {items.length} 件商品 ·{' '}
            {pendingCount > 0 ? `${pendingCount} 件待确认` : '看起来都对'}
          </p>
          <p className="text-micro text-ink-tertiary mt-0.5">
            模型：{task.model} ·{' '}
            {task.processing_time_ms
              ? `${(task.processing_time_ms / 1000).toFixed(1)} 秒`
              : ''}
          </p>
        </div>
      </section>

      {/* 商品列表 */}
      <section className="mt-6 flex flex-col gap-4">
        {items.map((it, idx) => (
          <ItemCard
            key={it.recognition_item_id}
            item={it}
            cats={cats ?? []}
            onChange={(patch) => patchItem(idx, patch)}
            onAction={(a) => setAction(idx, a)}
          />
        ))}
      </section>

      {items.length === 0 && (
        <Card className="mt-6 p-6 text-center">
          <p className="text-body text-ink-primary">这次没有识别到商品</p>
          <p className="text-small text-ink-secondary mt-1">
            可能图太糊、太小、或者不是购物清单
          </p>
          <div className="mt-4">
            <Btn variant="secondary" onClick={() => router.push('/add')}>
              换个方式
            </Btn>
          </div>
        </Card>
      )}

      {/* 底部操作 */}
      {items.length > 0 && (
        <div className="mt-8 flex flex-col gap-3 pb-4">
          <Btn
            size="xl"
            block
            onClick={onSubmit}
            loading={submitting}
            iconLeading={<Check className="h-5 w-5" />}
            disabled={enabledCount === 0}
          >
            {enabledCount === 0 ? '已跳过全部' : `入库 ${enabledCount} 件`}
          </Btn>
          <Btn
            variant="secondary"
            size="md"
            block
            onClick={onSaveDraft}
            loading={savingDraft}
            iconLeading={<Save className="h-4 w-4" />}
          >
            暂存，改天再整理
          </Btn>
          <button
            type="button"
            onClick={() => router.push('/add')}
            className="text-small text-ink-secondary self-center"
          >
            再来一次
          </button>
        </div>
      )}
    </div>
  )
}

// ───────── 单个商品卡片 ─────────
function ItemCard({
  item,
  cats,
  onChange,
  onAction,
}: {
  item: ItemRow
  cats: CategoryNode[]
  onChange: (patch: Partial<ItemRow>) => void
  onAction: (a: Action) => void
}) {
  const tier = computeTier(item.confidence)
  const sty = TIER_STYLES[tier]

  return (
    <Card className="p-4">
      {/* 头部：分档徽章 + 删除 */}
      <div className="flex items-center justify-between gap-2">
        <span
          className={`px-2 h-6 inline-flex items-center gap-1 rounded-xs ${sty.bg} ${sty.text} text-micro font-medium`}
        >
          {tier === 'high' ? <Check className="h-3.5 w-3.5" /> : sty.label}
        </span>
        <button
          type="button"
          aria-label="跳过这件"
          onClick={() => onAction(item.action === 'skip' ? 'keep_separate' : 'skip')}
          className="text-ink-secondary hover:text-accent-clay"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {item.action === 'skip' ? (
        <div className="mt-3 text-small text-ink-tertiary">— 已跳过 —</div>
      ) : (
        <>
          {/* 名称（高置信：不带 AI 角标；中/低：带 + 可点击编辑） */}
          <div className="mt-3">
            <Input
              value={item.name}
              onChange={(e) => onChange({ name: e.target.value })}
              label={`物品名称${fieldTier(item.confidence.name) === 'low' ? '（建议确认）' : ''}`}
              placeholder="商品名字"
              autoComplete="off"
              aiSuggested={fieldTier(item.confidence.name) !== 'high'}
            />
            {item.raw_name && item.raw_name !== item.name && (
              <p className="mt-1 text-micro text-ink-tertiary">
                原图文字："{item.raw_name}"
              </p>
            )}
          </div>

          {/* 数量 + 单位 */}
          <div className="mt-3 grid grid-cols-[1fr_1fr] gap-3">
            <Input
              kind="number"
              value={String(item.quantity)}
              onChange={(e) => onChange({ quantity: Number(e.target.value) || 0 })}
              label="数量"
            />
            <Input
              value={item.unit ?? ''}
              onChange={(e) => onChange({ unit: e.target.value || null })}
              label="单位"
              placeholder="包/瓶/提"
            />
          </div>

          {/* 分类（AI 已自动选好，可一键改） */}
          <div className="mt-3">
            <label className="text-small text-ink-secondary">
              分类{item.category_hint ? '（AI 已自动选好）' : ''}
            </label>
            <CategoryPicker
              cats={cats}
              value={item.category_id ?? ''}
              hint={item.category_hint ?? undefined}
              onChange={(v) => onChange({ category_id: v || null })}
            />
          </div>

          {/* 快用完时提醒我（AI 会根据易耗品判断预勾选） */}
          <button
            type="button"
            role="switch"
            aria-checked={item.restock_alert}
            onClick={() => onChange({ restock_alert: !item.restock_alert })}
            className="mt-3 w-full flex items-center justify-between rounded-md border border-border-hairline bg-bg-canvas px-3 py-2.5"
          >
            <span className="text-left">
              <span className="block text-small text-ink-primary">快用完时提醒我</span>
              <span className="block text-micro text-ink-tertiary">
                {item.restock_hint
                  ? 'AI 觉得是易耗品，已帮你勾上'
                  : '勾上后剩得不多时会提醒补货'}
              </span>
            </span>
            <span
              className={
                'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-tap ' +
                (item.restock_alert ? 'bg-accent-sage' : 'bg-ink-tertiary/30')
              }
            >
              <span
                className={
                  'inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform duration-tap ' +
                  (item.restock_alert ? 'translate-x-5' : 'translate-x-0.5')
                }
              />
            </span>
          </button>

          {/* 品牌 + 包装 + 过期（折叠） */}
          {item.expanded && (
            <div className="mt-3 flex flex-col gap-3 border-t border-border-hairline pt-3">
              <Input
                value={item.brand ?? ''}
                onChange={(e) => onChange({ brand: e.target.value || null })}
                label="品牌"
                placeholder="选填"
              />
              <div className="grid grid-cols-2 gap-3">
                <Input
                  kind="number"
                  value={String(item.package_quantity ?? '')}
                  onChange={(e) =>
                    onChange({
                      package_quantity: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                  label="一包装多少"
                />
                <Input
                  kind="date"
                  value={item.expiry_date ?? ''}
                  onChange={(e) =>
                    onChange({ expiry_date: e.target.value || null })
                  }
                  label="过期日"
                />
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => onChange({ expanded: !item.expanded })}
            className="mt-2 text-micro text-ink-secondary inline-flex items-center gap-1"
          >
            {item.expanded ? (
              <>
                <ChevronDown className="h-3 w-3" /> 收起详情
              </>
            ) : (
              <>
                <ChevronRight className="h-3 w-3" /> 改品牌/包装/过期
              </>
            )}
          </button>

          {/* 重复处理分支 */}
          {item.duplicate?.status !== 'new_item' && item.duplicate?.matched && (
            <DuplicateBranch
              item={item}
              onChange={onChange}
              onAction={onAction}
            />
          )}
        </>
      )}
    </Card>
  )
}

// ───────── 重复三分支 ─────────
function DuplicateBranch({
  item,
  onChange,
  onAction,
}: {
  item: ItemRow
  onChange: (patch: Partial<ItemRow>) => void
  onAction: (a: Action) => void
}) {
  const matched = item.duplicate!.matched!
  const isStrict = item.duplicate!.status === 'strict_match'

  return (
    <div className="mt-3 rounded-md border border-accent-honey/40 bg-accent-honey/10 p-3">
      <div className="flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 text-accent-honey shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-small text-ink-primary">
            {isStrict ? '小屋里已经有这个了' : '跟小屋里有件像的'}
          </p>
          <p className="text-micro text-ink-secondary mt-1">
            现有：{matched.canonical_name} · 现存量 {matched.quantity}
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-col gap-1.5">
        <label className="flex items-center gap-2 p-2 rounded-sm hover:bg-bg-elevated cursor-pointer">
          <input
            type="radio"
            name={`action-${item.recognition_item_id}`}
            checked={item.action === 'merge'}
            onChange={() => onAction('merge')}
            className="accent-accent-sage"
          />
          <div className="text-small">
            <div className="text-ink-primary">合并到现有的</div>
            <div className="text-micro text-ink-tertiary">
              数量加到 {matched.quantity + Number(item.quantity || 0)}
            </div>
          </div>
        </label>
        <label className="flex items-center gap-2 p-2 rounded-sm hover:bg-bg-elevated cursor-pointer">
          <input
            type="radio"
            name={`action-${item.recognition_item_id}`}
            checked={item.action === 'keep_separate'}
            onChange={() => onAction('keep_separate')}
            className="accent-accent-sage"
          />
          <div className="text-small">
            <div className="text-ink-primary">分开算（新商品）</div>
            <div className="text-micro text-ink-tertiary">
              新建一件独立的，名字照当前的
            </div>
          </div>
        </label>
        <label className="flex items-center gap-2 p-2 rounded-sm hover:bg-bg-elevated cursor-pointer">
          <input
            type="radio"
            name={`action-${item.recognition_item_id}`}
            checked={item.action === 'skip'}
            onChange={() => onAction('skip')}
            className="accent-accent-sage"
          />
          <div className="text-small">
            <div className="text-ink-primary">跳过这件</div>
          </div>
        </label>
      </div>

      {!isStrict && (
        <div className="mt-3 flex items-center gap-1.5">
          <Pencil className="h-3.5 w-3.5 text-ink-secondary" />
          <p className="text-micro text-ink-secondary">
            不确定的话，名字改一下再"分开算"会更清楚
          </p>
        </div>
      )}
    </div>
  )
}

// ───────── 分类选择器（与 manual 共用样式，Sprint 2 inline 一份） ─────────
interface CategoryNode {
  category_id: string
  name: string
  parent_id: string | null
  is_system: boolean
  sort_order: number
  children: CategoryNode[]
}

function CategoryPicker({
  cats,
  value,
  hint,
  onChange,
}: {
  cats: CategoryNode[]
  value: string
  hint?: string
  onChange: (v: string) => void
}) {
  const flat = React.useMemo(() => {
    const out: Array<{ id: string; label: string; depth: number }> = []
    cats.forEach((c) => {
      out.push({ id: c.category_id, label: c.name, depth: 0 })
      c.children.forEach((sub) =>
        out.push({ id: sub.category_id, label: sub.name, depth: 1 })
      )
    })
    return out
  }, [cats])

  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {flat.map((c) => {
        const active = value === c.id
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => onChange(active ? '' : c.id)}
            aria-pressed={active}
            className={
              'px-2.5 h-8 inline-flex items-center gap-1 rounded-pill text-small border transition-colors duration-tap ' +
              (active
                ? 'bg-accent-sage text-white border-accent-sage shadow-sm'
                : 'bg-bg-canvas text-ink-primary border-border-hairline hover:bg-bg-elevated')
            }
          >
            {active && <Check className="h-3.5 w-3.5" />}
            {c.label}
          </button>
        )
      })}
      {hint && !value && (
        <p className="w-full text-micro text-ink-tertiary">AI 觉得是：{hint}</p>
      )}
    </div>
  )
}

function computeTier(c: ItemRow['confidence']): ConfidenceTier {
  const vals = [c.name, c.quantity, c.unit, c.category, c.package_quantity, c.expiry_date].filter(
    (v) => typeof v === 'number'
  )
  const min = vals.length ? Math.min(...vals) : 0.5
  return min >= 0.85 ? 'high' : min >= 0.6 ? 'mid' : 'low'
}
