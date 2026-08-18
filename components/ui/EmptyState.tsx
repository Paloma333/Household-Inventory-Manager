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
      <div className="mb-5 flex h-20 w-20 items-center justify-center text-ink-tertiary">
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
  return (
    <svg
      viewBox="0 0 80 80"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-20 w-20"
      aria-hidden="true"
    >
      <path d="M16 28 L40 14 L64 28 L64 62 L16 62 Z" />
      <path d="M28 62 L28 40 L52 40 L52 62" />
      <circle cx="40" cy="50" r="3" />
    </svg>
  )
}
