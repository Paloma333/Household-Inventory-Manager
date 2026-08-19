'use client'

import * as React from 'react'
import { cn } from '@/lib/utils/cn'

/**
 * EmptyState — PRD §2.5
 *
 * 永远带 1 个 CTA；不要纯展示型空状态
 * 插画用线稿（≤ 80×80px），这里先用 lucide 内置线条图占位
 */

export interface EmptyStateProps {
  /** 媒体区（线稿插画，80x80 左右）。可选；没传时用一个默认盒装 svg */
  illustration?: React.ReactNode
  title: string
  description?: string
  primary?: React.ReactNode
  secondary?: React.ReactNode
  className?: string
}

export function EmptyState({
  illustration,
  title,
  description,
  primary,
  secondary,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center px-6 py-12',
        className
      )}
    >
      <div className="mb-5 flex h-20 w-20 items-center justify-center text-wood">
        {illustration || <DefaultLineIllustration />}
      </div>
      <h3 className="text-h3 font-semibold text-ink-primary">{title}</h3>
      {description && (
        <p className="mt-2 max-w-xs text-small text-ink-secondary">
          {description}
        </p>
      )}
      {primary && <div className="mt-6">{primary}</div>}
      {secondary && <div className="mt-2">{secondary}</div>}
    </div>
  )
}

function DefaultLineIllustration() {
  /* 动森叶子线稿（2px 暖棕描边） */
  return (
    <svg
      viewBox="0 0 80 80"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-20 w-20"
      aria-hidden="true"
    >
      {/* 叶片 */}
      <path d="M42 10 C60 18 68 38 62 56 C48 64 28 60 20 46 C13 32 24 14 42 10 Z" />
      {/* 主叶脉 */}
      <path d="M42 10 C36 28 38 46 46 60" />
      {/* 侧叶脉 */}
      <path d="M38 26 C44 28 50 28 56 26" />
      <path d="M37 40 C44 43 52 43 59 40" />
      {/* 叶柄 */}
      <path d="M46 60 C47 65 45 69 42 72" />
    </svg>
  )
}
