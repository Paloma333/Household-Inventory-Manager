'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Camera,
  ImagePlus,
  Plus,
  ScanLine,
  Sparkles,
  X,
} from 'lucide-react'
import { Btn } from '@/components/ui/Btn'
import { toast } from '@/components/ui/Toast'
import { Events, track } from '@/lib/analytics'

/**
 * 上传组件 — 用于 /add/receipt、/add/screenshot、/add/camera 三个入口
 *
 * 共同流程：拍照/选图（支持一次多张，上限 maxPhotos）→ POST /api/recognition
 *           （multipart 里带多个 file 字段）→ loading → 跳 /confirm/[id]
 *
 * 布局原则（QA 2026-08-30）：
 *   - 拍照入口做小，不再占整个首屏
 *   - 缩略图用小格子，【开始识别】紧跟其后，不用滚到底部才能点
 *
 * 错误处理：
 *   - quota_exceeded (429) → 显示"今天够了"按钮回首页
 *   - 网络/识别失败 → toast 错误，停留页面可重试
 */

export type SourceType = 'receipt' | 'screenshot' | 'camera'

const MAX_FILE_SIZE = 10 * 1024 * 1024

interface Props {
  sourceType: SourceType
  title: string
  subtitle: string
  example: string
  accept: string // e.g. 'image/*' / 'image/jpeg,image/png'
  capture?: 'environment' | 'user' // 摄像头取景模式：environment=后置，user=前置
  ctaLabel?: string
  maxPhotos?: number // 一次最多几张，默认 5
}

interface ChosenPhoto {
  id: string
  file: File
  preview: string
}

export function RecognitionUploader({
  sourceType,
  title,
  subtitle,
  example,
  accept,
  capture,
  ctaLabel = '开始识别',
  maxPhotos = 5,
}: Props) {
  const router = useRouter()
  const captureRef = React.useRef<HTMLInputElement>(null)
  const albumRef = React.useRef<HTMLInputElement>(null)
  const [photos, setPhotos] = React.useState<ChosenPhoto[]>([])
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

  // 卸载时释放 object URL，避免内存泄漏
  React.useEffect(() => {
    return () => {
      photos.forEach((p) => URL.revokeObjectURL(p.preview))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function addFiles(list: FileList | null) {
    if (!list || list.length === 0) return
    const incoming = Array.from(list)
    const valid: File[] = []
    for (const f of incoming) {
      if (!f.type.startsWith('image/')) {
        toast.error('只能传图片')
        continue
      }
      if (f.size > MAX_FILE_SIZE) {
        toast.error(`「${f.name.slice(0, 20)}」太大（>10MB）`)
        continue
      }
      valid.push(f)
    }
    if (valid.length === 0) return

    setPhotos((prev) => {
      const room = maxPhotos - prev.length
      if (room <= 0) {
        toast.error(`一次最多 ${maxPhotos} 张`)
        return prev
      }
      if (valid.length > room) {
        toast.info(`一次最多 ${maxPhotos} 张，已保留前 ${room} 张`)
      }
      const take = valid.slice(0, room)
      return [
        ...prev,
        ...take.map((file) => ({
          id: `${file.name}-${file.size}-${Math.random().toString(36).slice(2, 8)}`,
          file,
          preview: URL.createObjectURL(file),
        })),
      ]
    })
  }

  function removePhoto(id: string) {
    setPhotos((prev) => {
      const target = prev.find((p) => p.id === id)
      if (target) URL.revokeObjectURL(target.preview)
      return prev.filter((p) => p.id !== id)
    })
  }

  async function onSubmit() {
    if (photos.length === 0) return
    setPhase('uploading')
    setProgress(8)

    const form = new FormData()
    photos.forEach((p) => form.append('file', p.file))
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
    setProgress(0)
    setErrMsg(null)
    setQuotaInfo(null)
    if (captureRef.current) captureRef.current.value = ''
    if (albumRef.current) albumRef.current.value = ''
  }

  const remaining = maxPhotos - photos.length

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
        <section className="mt-6 flex flex-col gap-4">
          {/* 拍一张 / 选一张 — 紧凑入口，不再占满首屏 */}
          <button
            type="button"
            onClick={() => captureRef.current?.click()}
            className="h-24 rounded-md border-2 border-dashed border-border-hairline bg-bg-surface hover:bg-bg-elevated transition-colors duration-tap flex items-center justify-center gap-3 px-6 text-ink-secondary"
          >
            {capture ? (
              <Camera className="h-6 w-6 shrink-0" strokeWidth={1.5} />
            ) : (
              <ImagePlus className="h-6 w-6 shrink-0" strokeWidth={1.5} />
            )}
            <span className="text-left">
              <span className="block text-body text-ink-primary">
                {capture ? '拍一张' : '从相册选'}
                {maxPhotos > 1 && (
                  <span className="text-small text-ink-tertiary">
                    {' '}
                    （最多 {maxPhotos} 张）
                  </span>
                )}
              </span>
              <span className="block text-small text-ink-tertiary mt-0.5">
                {example}
              </span>
            </span>
          </button>

          {/* 拍照页也给一个相册多选入口（capture input 在移动端直接拉相机，选不了多张） */}
          {capture && (
            <button
              type="button"
              onClick={() => albumRef.current?.click()}
              className="self-start inline-flex items-center gap-1.5 text-small text-accent-sage"
            >
              <ImagePlus className="h-4 w-4" />
              从相册多选几张
            </button>
          )}

          {/* 多端兼容的 input — accept + capture 同时设，移动端会拉相机（单张） */}
          <input
            ref={captureRef}
            type="file"
            accept={accept}
            capture={capture}
            onChange={(e) => {
              addFiles(e.target.files)
              // 允许连续拍第二张同名照片（iOS 每次拍完 value 相同不会触发 change）
              if (captureRef.current) captureRef.current.value = ''
            }}
            className="sr-only"
            aria-hidden="true"
          />
          <input
            ref={albumRef}
            type="file"
            accept={accept}
            multiple={maxPhotos > 1}
            onChange={(e) => {
              addFiles(e.target.files)
              if (albumRef.current) albumRef.current.value = ''
            }}
            className="sr-only"
            aria-hidden="true"
          />

          {/* 已选缩略图 + 继续添加 + 开始识别（都在一屏内，不用滚到底） */}
          {photos.length > 0 && (
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-4 gap-2">
                {photos.map((p) => (
                  <div
                    key={p.id}
                    className="relative aspect-square rounded-md overflow-hidden border border-border-hairline"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p.preview}
                      alt="待识别图片"
                      className="h-full w-full object-cover"
                    />
                    <button
                      type="button"
                      aria-label="移除这张"
                      onClick={() => removePhoto(p.id)}
                      className="absolute top-1 right-1 h-6 w-6 grid place-items-center rounded-full bg-black/50 text-white active:scale-90 transition-transform duration-tap"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                {remaining > 0 && (
                  <button
                    type="button"
                    aria-label="再添加一张"
                    onClick={() => captureRef.current?.click()}
                    className="aspect-square rounded-md border-2 border-dashed border-border-hairline bg-bg-canvas grid place-items-center text-ink-tertiary hover:bg-bg-elevated transition-colors duration-tap"
                  >
                    <Plus className="h-5 w-5" />
                  </button>
                )}
              </div>

              <Btn
                type="button"
                size="xl"
                block
                onClick={onSubmit}
                iconLeading={<ScanLine className="h-5 w-5" />}
              >
                {ctaLabel}
                {photos.length > 1 ? `（${photos.length} 张）` : ''}
              </Btn>
              <button
                type="button"
                onClick={onReset}
                className="text-small text-ink-secondary self-center"
              >
                全部重选
              </button>
            </div>
          )}

          {/* 提示卡 */}
          <div className="rounded-md bg-bg-canvas p-3 flex gap-3 items-start">
            <Sparkles className="h-5 w-5 text-accent-honey shrink-0 mt-0.5" />
            <div className="text-small text-ink-secondary">
              拍得清楚点 → 识别更准。识别后可以编辑商品名字和数量，不用担心一次就对。
            </div>
          </div>
        </section>
      )}

      {/* 阶段 2：上传中 */}
      {phase === 'uploading' && (
        <section className="mt-8 flex flex-col gap-4 items-center">
          {photos.length > 0 && (
            <div className="w-full grid grid-cols-4 gap-2">
              {photos.map((p) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={p.id}
                  src={p.preview}
                  alt=""
                  className="aspect-square w-full rounded-md border border-border-hairline object-cover opacity-80"
                />
              ))}
            </div>
          )}
          <div className="w-full max-w-sm">
            <div className="h-1.5 rounded-pill bg-bg-canvas overflow-hidden">
              <div
                className="h-full bg-accent-sage transition-[width] duration-tap"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="mt-3 text-small text-ink-secondary text-center">
              {progress < 35 && `上传 ${photos.length} 张图片…`}
              {progress >= 35 && progress < 75 && 'AI 在看图…'}
              {progress >= 75 && progress < 100 && '快好了…'}
              {progress === 100 && '准备跳转…'}
            </p>
          </div>
        </section>
      )}

      {/* 阶段 3：出错/配额满 */}
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
