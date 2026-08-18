'use client'

import * as React from 'react'
import { Section } from './Section'

/**
 * ColorSection — 设计系统调色板
 *
 * 全部取自 globals.css CSS 变量;Tailwind 把它们映射成 bg-canvas/text-ink-primary 等
 * 这里直接展示色块 + 变量名,组件层永远不写硬编码颜色
 */

interface Swatch {
  label: string
  twClass: string
  varName: string
  textClass?: string
}

const swatches: Swatch[] = [
  // 背景
  { label: 'canvas', twClass: 'bg-bg-canvas', varName: '--bg-canvas' },
  { label: 'surface', twClass: 'bg-bg-surface', varName: '--bg-surface' },
  { label: 'elevated', twClass: 'bg-bg-elevated', varName: '--bg-elevated' },
  {
    label: 'overlay',
    twClass: 'bg-bg-overlay',
    varName: '--bg-overlay',
    textClass: 'text-bg-surface',
  },

  // 边框 / 分隔线
  { label: 'hairline', twClass: 'bg-border-hairline', varName: '--border-hairline' },

  // 文本
  { label: 'ink-primary', twClass: 'bg-ink-primary', varName: '--ink-primary' },
  { label: 'ink-secondary', twClass: 'bg-ink-secondary', varName: '--ink-secondary' },
  { label: 'ink-tertiary', twClass: 'bg-ink-tertiary', varName: '--ink-tertiary' },

  // 重点色
  { label: 'accent-sage', twClass: 'bg-accent-sage', varName: '--accent-sage' },
  {
    label: 'accent-sage-soft',
    twClass: 'bg-accent-sage-soft',
    varName: '--accent-sage-soft',
  },
  { label: 'accent-clay', twClass: 'bg-accent-clay', varName: '--accent-clay' },
  {
    label: 'accent-clay-soft',
    twClass: 'bg-accent-clay-soft',
    varName: '--accent-clay-soft',
  },
  { label: 'accent-honey', twClass: 'bg-accent-honey', varName: '--accent-honey' },

  // 置信度
  {
    label: 'confidence-low',
    twClass: 'bg-confidence-low',
    varName: '--confidence-low',
  },
  {
    label: 'confidence-mid',
    twClass: 'bg-confidence-mid',
    varName: '--confidence-mid',
  },
]

export function ColorSection() {
  return (
    <Section
      id="colors"
      eyebrow="01 · Color"
      title="色彩"
      intro="纸颗粒感的米白打底 + 鼠尾草绿/陶土橙/蜂蜜黄三重点。dark 模式由 :root[data-theme=dark] 全量覆盖;组件代码层永远用语义 class,不写 #xxxxxx。"
    >
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {swatches.map((s) => (
          <div
            key={s.label}
            className="rounded-md border border-border-hairline overflow-hidden bg-bg-surface"
          >
            <div
              className={`h-20 ${s.twClass} ${s.textClass ?? ''} flex items-end p-2`}
            >
              <span className="text-micro font-num uppercase tracking-wider opacity-80">
                {s.label}
              </span>
            </div>
            <div className="px-3 py-2 bg-bg-surface">
              <div className="text-small text-ink-primary font-medium truncate">
                {s.label}
              </div>
              <code className="block text-micro text-ink-secondary truncate">
                {s.varName}
              </code>
            </div>
          </div>
        ))}
      </div>
    </Section>
  )
}
