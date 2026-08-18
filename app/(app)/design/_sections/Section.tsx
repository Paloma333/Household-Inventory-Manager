'use client'

import * as React from 'react'
import { cn } from '@/lib/utils/cn'

/**
 * Section — 展示页分组外壳
 *
 * - sticky 锚点已由 page.tsx 顶导处理;这里只负责 scroll-margin-top(避顶导遮挡)
 * - eyebrow 给编号,标题是中文,intro 一句话设计意图
 */

export interface SectionProps {
  id: string
  eyebrow: string
  title: string
  intro: string
  children: React.ReactNode
  className?: string
}

export function Section({
  id,
  eyebrow,
  title,
  intro,
  children,
  className,
}: SectionProps) {
  return (
    <section
      id={id}
      // 顶部 sticky 锚点导航 ~56px,加 16px 呼吸
      className={cn(
        'scroll-mt-20 py-8 sm:py-12 border-t border-border-hairline',
        className
      )}
    >
      <header className="mb-6 sm:mb-8">
        <div className="text-micro uppercase tracking-widest text-ink-tertiary font-num">
          {eyebrow}
        </div>
        <h2 className="mt-1 text-h1 font-display text-ink-primary">{title}</h2>
        <p className="mt-2 max-w-xl text-body text-ink-secondary">{intro}</p>
      </header>
      {children}
    </section>
  )
}
