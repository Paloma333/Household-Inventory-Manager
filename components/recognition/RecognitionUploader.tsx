'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Camera, ImagePlus, ScanLine, Sparkles } from 'lucide-react'
import { Btn } from '@/components/ui/Btn'
import { toast } from '@/components/ui/Toast'
import { Events, track } from '@/lib/analytics'

/**
 * 上传组件 — 用于 /add/receipt、/add/screenshot、/add/camera 三个入口
 *
 * 共同流程：拍照/选图 → POST /api/recognition → loading → 跳 /confirm/[id]
 *
 * 错误处理：
 *   - quota_exceeded (429) → 显示"今天够了"按钮回首页
 *   - 网络/识别失败 → toast 错误，停留页面可重试
 */

export type SourceType = 'receipt' | 'screenshot' | 'camera'

interface Props {
  sourceType: SourceType
  title: string
  subtitle: string
  example: string
  accept: string // e.g. 'image/*' / 'image/jpeg,image/png'
  capture?: 'environment' | 'user' // 摄像头取景模式：environment=后置，user=前置
  ctaLabel?: string
}

export function RecognitionUploader({
  sourceType,
  title,
  subtitle,
  example,
  accept,
  capture,
  ctaLabel = '开始识别',
}: Props) {
  const router = useRouter()
  const fileRef = React.useRef<HTMLInputElement>(null)
  const [preview, setPreview] = React.useState<string | null>(null)
  const [chosen, setChosen] = React.useState<File | null>(null)
  const [phase, setPhase] = React.useState<'pick' | 'uploading' | 'done' | 'error'>(
    'pick'
  )
  const [progress, setProgress] = React.useState(0)
  const [errMsg, setErrMsg] = React.useState<string | null>(null)
  const [quotaInfo, setQuotaInfo] = React.useState<null | {
    reason: string
    daily_used: number
    daily_limit: number
  }>(null)
  const firedStartRef = React.useRef(false)

  React.useEffect(() => {
    if (firedStartRef.current) return
    firedStartRef.current = true
    track(Events.RecognitionStarted, { source_type: sourceType })
  }, [sourceType])

  function onPick(file: File) {
    if (!file.type.startsWith('image/')) {
      toast.error('只能传图片')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('图片太大（>10MB）')
      return
    }
    setChosen(file)
    const url = URL.createObjectURL(file)
    setPreview(url)
  }

  async function onSubmit() {
    if (!chosen) return
    setPhase('uploading')
    setProgress(8)

    const form = new FormData()
    form.append('file', chosen)
    form.append('sourceType', sourceType)

    // 假进度条（实际 fetch 上传进度浏览器读不到也不准）
    const ticker = setInterval(() => {
      setProgress((p) => Math.min(p + 7, 92))
    }, 400)

    try {
      const res = await fetch('/api/recognition', {
        method: 'POST',
        body: form,
      })
      const json = await res.json()

      clearInterval(ticker)
      setProgress(100)

      if (res.status === 429 && json.error === 'quota_exceeded') {
        setQuotaInfo({
          reason: json.reason,
          daily_used: json.quota?.daily_used ?? 0,
          daily_limit: json.quota?.daily_limit ?? 0,
        })
        setPhase('error')
        track(Events.RecognitionCompleted, {
          source_type: sourceType,
          status: 'blocked_quota',
        })
        return
      }
      if (!res.ok || !json.ok) {
        throw new Error(json.error || `HTTP ${res.status}`)
      }

      track(Events.RecognitionCompleted, {
        source_type: sourceType,
        item_count: json.items?.length ?? 0,
        duration_ms: json.task?.duration_ms,
      })

      setPhase('done')
      router.push(`/confirm/${json.task.recognition_id}`)
    } catch (e: unknown) {
      clearInterval(ticker)
      const msg = e instanceof Error ? e.message : '识别失败'
      setErrMsg(msg)
      setPhase('error')
      toast.error(`识别没成功：${msg.slice(0, 60)}`)
    }
  }

  function onReset() {
    setPhase('pick')
    setChosen(null)
    setPreview(null)
    setProgress(0)
    setErrMsg(null)
    setQuotaInfo(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div className="px-6 pt-8 pb-32">
      <Link
        href="/add"
        className="inline-flex items-center gap-1 text-small text-ink-secondary mb-4"
      >
        <ArrowLeft className="h-4 w-4" /> 添点东西
      </Link>

      <header>
        <h1 className="font-semibold text-h1 text-ink-primary">{title}</h1>
        <p className="mt-2 text-body text-ink-secondary">{subtitle}</p>
      </header>

      {/* 阶段 1：选图/拍照 */}
      {phase === 'pick' && (
        <section className="mt-8 flex flex-col gap-4">
          {/* 选区域 */}
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="aspect-square rounded-md border-2 border-dashed border-border-hairline bg-bg-surface hover:bg-bg-elevated transition-colors duration-tap grid place-items-center gap-2 text-ink-secondary"
          >
            <div className="flex flex-col items-center gap-3 p-6">
              {capture ? (
                <Camera className="h-10 w-10" strokeWidth={1.5} />
              ) : (
                <ImagePlus className="h-10 w-10" strokeWidth={1.5} />
              )}
              <div className="text-body">
                {capture ? '拍一张' : '从相册选一张'}
              </div>
              <p className="text-small text-ink-tertiary text-center max-w-xs">
                {example}
              </p>
            </div>
          </button>

          {/* 多端兼容的 input — accept + capture 同时设，移动端会拉相机 */}
          <input
            ref={fileRef}
            type="file"
            accept={accept}
            capture={capture}
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) onPick(f)
            }}
            className="sr-only"
            aria-hidden="true"
          />

          {/* 提示卡 */}
          <div className="rounded-md bg-bg-canvas p-3 flex gap-3 items-start">
            <Sparkles className="h-5 w-5 text-accent-honey shrink-0 mt-0.5" />
            <div className="text-small text-ink-secondary">
              拍得清楚点 → 识别更准。识别后可以编辑商品名字和数量，不用担心一次就对。
            </div>
          </div>
        </section>
      )}

      {/* 阶段 2：预览 + 提交 */}
      {phase === 'pick' && preview && chosen && (
        <section className="mt-4 flex flex-col gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt="待识别图片预览"
            className="w-full rounded-md border border-border-hairline"
          />
          <Btn
            type="button"
            size="xl"
            block
            onClick={onSubmit}
            iconLeading={<ScanLine className="h-5 w-5" />}
          >
            {ctaLabel}
          </Btn>
          <button
            type="button"
            onClick={onReset}
            className="text-small text-ink-secondary self-center"
          >
            重选一张
          </button>
        </section>
      )}

      {/* 阶段 3：上传中 */}
      {phase === 'uploading' && (
        <section className="mt-8 flex flex-col gap-4 items-center">
          {preview && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview}
              alt=""
              className="w-full max-w-sm rounded-md border border-border-hairline opacity-80"
            />
          )}
          <div className="w-full max-w-sm">
            <div className="h-1.5 rounded-pill bg-bg-canvas overflow-hidden">
              <div
                className="h-full bg-accent-sage transition-[width] duration-tap"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="mt-3 text-small text-ink-secondary text-center">
              {progress < 35 && '上传图片…'}
              {progress >= 35 && progress < 75 && 'AI 在看图…'}
              {progress >= 75 && progress < 100 && '快好了…'}
              {progress === 100 && '准备跳转…'}
            </p>
          </div>
        </section>
      )}

      {/* 阶段 4：出错/配额满 */}
      {phase === 'error' && (
        <section className="mt-8 flex flex-col gap-3 items-center text-center">
          {quotaInfo ? (
            <>
              <p className="text-body text-ink-primary">
                今天的识别次数用完啦
              </p>
              <p className="text-small text-ink-secondary">
                今天已用 {quotaInfo.daily_used}/{quotaInfo.daily_limit} 次
              </p>
              <Link
                href="/"
                className="text-small text-accent-sage underline mt-2"
              >
                回首页用手动添加
              </Link>
            </>
          ) : (
            <>
              <p className="text-body text-ink-primary">
                这次没识别成功 — {errMsg}
              </p>
              <Btn type="button" size="lg" onClick={onReset}>
                重试
              </Btn>
            </>
          )}
        </section>
      )}
    </div>
  )
}
