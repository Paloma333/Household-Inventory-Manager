'use client'

import * as React from 'react'
import { Palette } from 'lucide-react'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { StickyNav } from './_sections/StickyNav'
import { ColorSection } from './_sections/ColorSection'
import { TypographySection } from './_sections/TypographySection'
import { ButtonSection } from './_sections/ButtonSection'
import { InputSection } from './_sections/InputSection'
import { CardSection } from './_sections/CardSection'
import { OverlaySection } from './_sections/OverlaySection'
import { TokenSection } from './_sections/TokenSection'

/**
 * /design — 小屋设计系统展示页
 *
 * 内部用,不挂 bottom nav;在 (app) 路由组里要登录;将来要对外开放再抽到独立分组
 * 顶导 ThemeToggle 切 light/dark,持久化到 localStorage,inline script 防闪屏
 */

export default function DesignPage() {
  return (
    <div className="min-h-screen bg-bg-canvas">
      {/* Header */}
      <header className="border-b border-border-hairline bg-bg-canvas">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 text-micro uppercase text-ink-tertiary font-num tracking-widest">
                <Palette className="h-3.5 w-3.5" />
                Design System · 设计系统
              </div>
              <h1 className="mt-2 text-display font-display text-ink-primary">
                小屋 / him UI Tokens
              </h1>
              <p className="mt-3 max-w-xl text-body text-ink-secondary">
                所有视觉决策集中在这页。所有按钮、卡片、浮层、字体、色彩都从同一份
                tokens 派生 — 改 PRD v1.1 → K3,只动 globals.css 与 tailwind.config.ts。
              </p>
            </div>
            <div className="shrink-0">
              <ThemeToggle />
            </div>
          </div>

          {/* 概览 */}
          <dl className="mt-8 grid grid-cols-3 sm:grid-cols-4 gap-3 sm:gap-4 max-w-2xl">
            <Stat label="组件" value="10" />
            <Stat label="Variant/Style" value="40+" />
            <Stat label="Tokens" value="50+" />
            <Stat label="Easing/Dur" value="7" />
          </dl>
        </div>
      </header>

      {/* Sticky 锚点导航 */}
      <StickyNav />

      {/* 7 个 sections */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 pb-16">
        <ColorSection />
        <TypographySection />
        <ButtonSection />
        <InputSection />
        <CardSection />
        <OverlaySection />
        <TokenSection />

        <footer className="mt-16 pt-8 border-t border-border-hairline text-small text-ink-tertiary">
          完 · 想看 source?每个组件都在 <code>components/ui/</code>,tokens 在{' '}
          <code>app/globals.css</code> 与 <code>tailwind.config.ts</code>。
        </footer>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border-hairline bg-bg-surface px-3 py-2.5">
      <dt className="text-micro text-ink-tertiary uppercase tracking-wider">
        {label}
      </dt>
      <dd className="mt-0.5 text-h3 font-num font-semibold text-ink-primary">
        {value}
      </dd>
    </div>
  )
}
