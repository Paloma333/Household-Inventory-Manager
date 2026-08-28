'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowLeft, BellRing, Check, Save, Sparkles } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { Btn } from '@/components/ui/Btn'
import { toast } from '@/components/ui/Toast'
import { Skeleton } from '@/components/ui/Skeleton'
import { Events, track } from '@/lib/analytics'

/**
 * /add/manual — PRD §3.2 手动添加（完整版）
 *
 * 字段：
 *   - canonical_name * (1-80)
 *   - quantity * (>= 0)
 *   - unit (选自提示列表 + 自填)
 *   - category_id (顶层 + 子分类二选一)
 *   - brand (选填)
 *   - expiry_date (选填)
 *   - package_quantity (选填，比如"一提 = 6 包")
 *
 * 提交：写 items + inventory_events，路由到 /inventory
 * 埋点：进入此页面 fire add_started，提交成功 fire item_created
 */

const FormSchema = z.object({
  canonical_name: z.string().trim().min(1, '名字不能空').max(80, '名字别太长'),
  quantity: z.coerce.number().finite().min(0, '不能小于 0').default(1),
  unit: z.string().trim().max(8).optional().or(z.literal('')),
  brand: z.string().trim().max(40).optional().or(z.literal('')),
  storage_location: z.string().trim().max(80).optional().or(z.literal('')),
  category_id: z.string().uuid().optional().or(z.literal('')),
  expiry_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, '日期格式应为 YYYY-MM-DD')
    .optional()
    .or(z.literal('')),
  package_quantity: z
    .union([z.literal(''), z.coerce.number().finite().positive().max(999)])
    .optional(),
})

type FormValues = z.infer<typeof FormSchema>

const UNIT_PRESETS = ['包', '提', '盒', '瓶', '罐', '袋', '件', '支', '片', '块']

interface CategoryNode {
  category_id: string
  name: string
  parent_id: string | null
  is_system: boolean
  sort_order: number
  children: CategoryNode[]
}

export default function ManualAddPage() {
  const router = useRouter()
  const [cats, setCats] = React.useState<CategoryNode[] | null>(null)
  const [catsError, setCatsError] = React.useState<string | null>(null)
  const [submitting, setSubmitting] = React.useState(false)
  const [restockAlert, setRestockAlert] = React.useState(false)
  const firedStartRef = React.useRef(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      canonical_name: '',
      quantity: 1,
      unit: '',
      brand: '',
      storage_location: '',
      category_id: '',
      expiry_date: '',
      package_quantity: '' as unknown as number,
    },
    mode: 'onBlur',
  })

  // 加载分类
  React.useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/categories')
        const data = await res.json()
        if (!cancelled) {
          if (data.error) throw new Error(data.error)
          setCats(data.categories ?? [])
        }
      } catch (e: any) {
        if (!cancelled) setCatsError(e.message || '分类加载失败')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // 进入页面 → fire add_started（仅一次）
  React.useEffect(() => {
    if (firedStartRef.current) return
    firedStartRef.current = true
    track(Events.AddStarted, { source: 'manual' })
  }, [])

  const watchedCategory = watch('category_id')

  const onSubmit = handleSubmit(async (data) => {
    setSubmitting(true)
    try {
      const payload: Record<string, unknown> = {
        canonical_name: data.canonical_name.trim(),
        quantity: data.quantity,
      }
      if (data.unit) payload.unit = data.unit.trim()
      if (data.brand) payload.brand = data.brand.trim()
      if (data.storage_location) payload.storage_location = data.storage_location.trim()
      if (data.category_id) payload.category_id = data.category_id
      if (data.expiry_date) payload.expiry_date = data.expiry_date
      if (data.package_quantity) payload.package_quantity = Number(data.package_quantity)
      payload.restock_alert = restockAlert

      const res = await fetch('/api/items', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) {
        throw new Error(json.error || '保存失败')
      }

      track(Events.ItemCreated, {
        source: 'manual',
        category_id: data.category_id || null,
        quantity: data.quantity,
      })

      toast.info('已加进小屋 →', { durationMs: 1800 })
      router.push('/inventory')
      router.refresh()
    } catch (e: any) {
      toast.error(e?.message ?? '保存失败')
    } finally {
      setSubmitting(false)
    }
  })

  return (
    <div className="px-6 pt-8 pb-32">
      <Link
        href="/add"
        className="inline-flex items-center gap-1 text-small text-ink-secondary mb-4"
      >
        <ArrowLeft className="h-4 w-4" /> 添点东西
      </Link>

      <header>
        <h1 className="font-semibold text-h1 text-ink-primary">手动添加</h1>
        <p className="mt-2 text-body text-ink-secondary">
          第一样东西进来，最自然的就是手写
        </p>
      </header>

      <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-5">
        {/* 名字 */}
        <Input
          label="物品名称"
          placeholder="例：抽纸 / 厨房纸 / 牙膏"
          autoFocus
          autoComplete="off"
          {...register('canonical_name')}
          errorText={errors.canonical_name?.message}
        />

        {/* 数量 + 单位 */}
        <div className="grid grid-cols-[1fr_auto] gap-3 items-end">
          <Input
            kind="number"
            label="数量"
            placeholder="例：6"
            {...register('quantity')}
            errorText={errors.quantity?.message}
          />
          <Input
            label="单位"
            placeholder="包 / 提"
            className="w-24"
            {...register('unit')}
            errorText={errors.unit?.message}
          />
        </div>

        {/* 单位快捷 */}
        <div className="-mt-2 flex flex-wrap gap-1.5">
          {UNIT_PRESETS.map((u) => (
            <button
              key={u}
              type="button"
              onClick={() => setValue('unit', u, { shouldDirty: true })}
              className="px-2.5 h-7 rounded-pill bg-bg-surface border border-border-hairline text-small text-ink-secondary hover:bg-bg-elevated transition-colors duration-tap"
            >
              {u}
            </button>
          ))}
        </div>

        {/* 分类 */}
        <div className="flex flex-col gap-1.5">
          <label className="text-small text-ink-secondary">分到哪儿</label>
          {catsError ? (
            <p className="text-micro text-accent-clay">{catsError}</p>
          ) : cats === null ? (
            <Skeleton className="h-10 w-full" />
          ) : (
            <CategoryPicker
              cats={cats}
              value={watchedCategory}
              onChange={(v) => setValue('category_id', v, { shouldDirty: true })}
            />
          )}
        </div>

        {/* 快用完时提醒我 */}
        <button
          type="button"
          role="switch"
          aria-checked={restockAlert}
          onClick={() => setRestockAlert((v) => !v)}
          className="flex items-center justify-between gap-3 rounded-md border border-border-hairline bg-bg-canvas px-3 py-2.5 text-left"
        >
          <span>
            <span className="flex items-center gap-1.5 text-small text-ink-primary">
              <BellRing className="h-3.5 w-3.5 text-accent-sage" /> 快用完时提醒我
            </span>
            <span className="block mt-0.5 text-micro text-ink-tertiary">
              勾上后剩得不多时会提醒补货，不勾就不会提示「少」
            </span>
          </span>
          <span
            className={
              'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-tap ' +
              (restockAlert ? 'bg-accent-sage' : 'bg-ink-tertiary/30')
            }
          >
            <span
              className={
                'inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform duration-tap ' +
                (restockAlert ? 'translate-x-5' : 'translate-x-0.5')
              }
            />
          </span>
        </button>

        {/* 品牌（选填） */}
        <Input
          label="什么牌子（选填）"
          placeholder="例：维达 / 心相印"
          {...register('brand')}
          errorText={errors.brand?.message}
        />

        {/* 我在哪（选填） */}
        <Input
          label="我在哪（选填）"
          placeholder="例：厨房左侧橱柜"
          {...register('storage_location')}
          errorText={errors.storage_location?.message}
        />

        {/* 包装 */}
        <Input
          kind="number"
          label="一包装多少（选填）"
          placeholder="例：6（一提 = 6 包）"
          {...register('package_quantity')}
          errorText={errors.package_quantity?.message}
        />

        {/* 保质期 */}
        <Input
          kind="date"
          label="什么时候过期（选填）"
          {...register('expiry_date')}
          errorText={errors.expiry_date?.message}
        />

        <div className="h-2" />

        <Btn
          type="submit"
          size="xl"
          block
          loading={submitting}
          iconLeading={<Save className="h-5 w-5" />}
        >
          加进小屋
        </Btn>

        <p className="text-small text-ink-secondary inline-flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5" /> 一次只填一个 → AI 入库 Sprint 2 来
        </p>
      </form>
    </div>
  )
}

/** 分类选择器：一行一个顶层分类，子类紧凑横排 */
function CategoryPicker({
  cats,
  value,
  onChange,
}: {
  cats: CategoryNode[]
  value?: string
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
    <div className="flex flex-wrap gap-1.5">
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
    </div>
  )
}
