'use client'

import * as React from 'react'
import { Section } from './Section'

/**
 * TokenSection — 间距 / 圆角 / 动效 tokens
 *
 * 这些不在 component 里,但开发常查;展示为可视化色块
 */

const spaces = [
  { key: '1', val: '4px' },
  { key: '2', val: '8px' },
  { key: '3', val: '12px' },
  { key: '4', val: '16px' },
  { key: '5', val: '20px' },
  { key: '6', val: '24px' },
  { key: '8', val: '32px' },
  { key: '10', val: '40px' },
  { key: '12', val: '48px' },
  { key: '16', val: '64px' },
]

const radii = [
  { key: 'xs', val: '6px', use: '微圆角 / skeleton' },
  { key: 'sm', val: '10px', use: 'input / 卡片内' },
  { key: 'md', val: '14px', use: 'Card / 默认卡片' },
  { key: 'lg', val: '20px', use: 'Sheet / Dialog' },
  { key: 'pill', val: '9999px', use: 'Badge / 头像 / FAB' },
]

const easings = [
  { key: 'out-quart', val: 'cubic-bezier(.25,1,.5,1)', use: '主要按下/颜色过渡' },
  { key: 'out-expo', val: 'cubic-bezier(.16,1,.3,1)', use: 'Sheet/Page 进入' },
  { key: 'in-out-cubic', val: 'cubic-bezier(.65,0,.35,1)', use: '对称运动 / 表格' },
  { key: 'tap', val: '120ms', use: '触感反馈(按下/抬起)' },
  { key: 'enter', val: '240ms', use: '卡片进入' },
  { key: 'leave', val: '160ms', use: '退出稍快(感知更轻)' },
  { key: 'page', val: '320ms', use: '页与页之间' },
]

export function TokenSection() {
  return (
    <Section
      id="tokens"
      eyebrow="07 · Tokens"
      title="间距 / 圆角 / 动效"
      intro="所有视觉 token 集中在 globals.css 与 tailwind.config.ts,组件只引用语义 class。改 K3 视觉风格只动这两个文件。开发查表用,设计稿评审也对齐这一份。"
    >
      {/* Spacing */}
      <div className="text-micro uppercase text-ink-tertiary font-num tracking-wider mb-3">
        01 · Spacing
      </div>
      <div className="space-y-2 mb-10">
        {spaces.map((s) => (
          <div key={s.key} className="flex items-center gap-3">
            <code className="w-20 text-micro text-ink-tertiary font-num shrink-0">
              space-{s.key}
            </code>
            <div
              className="bg-accent-sage"
              style={{ width: s.val, height: '14px' }}
            />
            <span className="text-small text-ink-secondary font-num">{s.val}</span>
          </div>
        ))}
      </div>

      {/* Radius */}
      <div className="text-micro uppercase text-ink-tertiary font-num tracking-wider mb-3">
        02 · Radius — 不要统一
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-10">
        {radii.map((r) => (
          <div
            key={r.key}
            className="rounded-md border border-border-hairline bg-bg-surface p-4"
          >
            <div
              className="h-14 bg-accent-sage-soft border border-accent-sage mb-3"
              style={{ borderRadius: r.val }}
            />
            <div className="text-small font-medium text-ink-primary font-num">
              {r.key}
            </div>
            <div className="text-micro text-ink-tertiary font-num">{r.val}</div>
            <div className="text-micro text-ink-secondary mt-1">{r.use}</div>
          </div>
        ))}
      </div>

      {/* Motion */}
      <div className="text-micro uppercase text-ink-tertiary font-num tracking-wider mb-3">
        03 · Motion · Easing + Duration
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {easings.map((e) => (
          <div
            key={e.key}
            className="flex items-center justify-between gap-3 p-3 rounded-md border border-border-hairline bg-bg-surface"
          >
            <div>
              <div className="text-small font-medium text-ink-primary font-num">
                {e.key}
              </div>
              <div className="text-micro text-ink-tertiary font-num">
                {e.val}
              </div>
              <div className="text-micro text-ink-secondary mt-1">{e.use}</div>
            </div>
            <MotionPreview durationKey={e.key} />
          </div>
        ))}
      </div>
    </Section>
  )
}

function MotionPreview({ durationKey }: { durationKey: string }) {
  const [on, setOn] = React.useState(false)

  React.useEffect(() => {
    const t = setTimeout(() => setOn(true), 60)
    return () => clearTimeout(t)
  }, [durationKey])

  // 让循环重启
  const key = `${durationKey}-${on ? 'on' : 'off'}`
  void key

  // 简单回放:left 0 -> 90%;reset
  const animClass =
    durationKey === 'out-quart'
      ? 'ease-out-quart'
      : durationKey === 'out-expo'
        ? 'ease-out-expo'
        : durationKey === 'in-out-cubic'
          ? 'ease-in-out-cubic'
          : ''

  const durClass =
    durationKey === 'tap'
      ? 'duration-tap'
      : durationKey === 'enter'
        ? 'duration-enter'
        : durationKey === 'leave'
          ? 'duration-leave'
          : durationKey === 'page'
            ? 'duration-page'
            : 'duration-enter'

  return (
    <div className="relative w-24 h-8 shrink-0 overflow-hidden rounded-sm bg-bg-elevated border border-border-hairline">
      <div
        key={`${durationKey}-${on}`}
        className={`absolute top-1 left-1 h-6 w-6 rounded-pill bg-accent-sage ${animClass} ${durClass}`}
        style={{
          animation: `${durationKey === 'tap' || durationKey === 'enter' || durationKey === 'leave' || durationKey === 'page' ? `slip-${durationKey}` : `slip-${animClass}`} ${durationKey === 'tap' ? '120ms' : durationKey === 'enter' ? '240ms' : durationKey === 'leave' ? '160ms' : durationKey === 'page' ? '320ms' : '600ms'} infinite alternate`,
        }}
      />
      <style jsx>{`
        @keyframes slip-out-quart {
          from { transform: translateX(0); }
          to { transform: translateX(64px); }
        }
        @keyframes slip-out-expo {
          from { transform: translateX(0); }
          to { transform: translateX(64px); }
        }
        @keyframes slip-ease-in-out-cubic {
          from { transform: translateX(0); }
          to { transform: translateX(64px); }
        }
        @keyframes slip-tap {
          from { transform: translateX(0); }
          to { transform: translateX(64px); }
        }
        @keyframes slip-enter {
          from { transform: translateX(0); }
          to { transform: translateX(64px); }
        }
        @keyframes slip-leave {
          from { transform: translateX(0); }
          to { transform: translateX(64px); }
        }
        @keyframes slip-page {
          from { transform: translateX(0); }
          to { transform: translateX(64px); }
        }
      `}</style>
    </div>
  )
}
