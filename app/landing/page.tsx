import type { Metadata } from 'next'
import Link from 'next/link'
import {
  Camera,
  BellRing,
  ListChecks,
  Share2,
  Sparkles,
} from 'lucide-react'
import { Card } from '@/components/ui/Card'

/**
 * /landing — 作品集 landing 页（公开，PRD §0 气质锚点）
 *
 * 项目介绍 + 设计意图 + 真实 demo 入口。
 * 移动端优先：max-w-xl 单列，跟 App 同一套设计 tokens。
 */

export const metadata: Metadata = {
  title: '小屋日志 · My Cabin Log',
  description:
    '小屋日志（My Cabin Log）— 记录、整理买回家的物品；轻松、用心地过好今天的生活。拍照入库、快用完提醒、购物清单分享。',
}

const FEATURES = [
  {
    icon: Camera,
    title: '拍照就能入库',
    desc: '拍小票、截图、或直接对着一柜子东西拍，AI 识别成结构化库存，不用手打字。',
  },
  {
    icon: BellRing,
    title: '快用完会提醒',
    desc: '每件东西都能设低库存阈值，剩多少时提醒你，补货建议自动分好「已用完 / 快用完 / 快过期」。',
  },
  {
    icon: ListChecks,
    title: '购物清单闭环',
    desc: '补货建议一键勾选生成清单，买完回写库存；清单还能分享给家人，公开链接只读。',
  },
  {
    icon: Share2,
    title: '一家人共用一个家',
    desc: '邀请另一半共用同一个库存；回收站 30 天可恢复，导出 CSV / JSON 数据随时带走。',
  },
]

export default function LandingPage() {
  return (
    <main className="mx-auto w-full max-w-xl px-6 pt-14 pb-20">
      {/* ── Hero ── */}
      <header className="text-center">
        <p className="text-small text-ink-secondary tracking-widest uppercase">
          小屋日志 · My Cabin Log
        </p>
        <h1 className="mt-3 font-semibold text-display text-ink-primary leading-snug">
          记录、整理买回家的物品；
          <br />
          轻松、用心地过好今天的生活。
        </h1>
        <p className="mt-4 text-body text-ink-secondary leading-relaxed">
          小屋日志是一个让 AI 帮你管理家里库存的 Web App。
          <br className="hidden sm:block" />
          买东西时拍张照，剩下的交给它。
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Link
            href="/login"
            className="inline-flex items-center gap-2 h-12 px-6 rounded-sm bg-accent-sage text-bg-elevated text-body font-medium hover:opacity-90 transition-opacity duration-tap"
          >
            <Sparkles className="h-4 w-4" /> 进入小家
          </Link>
          <a
            href="#design"
            className="inline-flex items-center h-12 px-5 rounded-sm bg-bg-surface text-body text-ink-primary border border-border-hairline hover:bg-bg-elevated transition-colors duration-tap"
          >
            看看设计
          </a>
        </div>
        <p className="mt-6 text-micro text-ink-tertiary">
          完整作品 · 移动端优先 · PWA 可加到主屏幕
        </p>
      </header>

      {/* ── 功能 ── */}
      <section className="mt-16">
        <h2 className="text-h3 font-semibold text-ink-primary text-center">能做什么</h2>
        <div className="mt-6 flex flex-col gap-3">
          {FEATURES.map((f) => (
            <Card key={f.title} className="p-5 flex gap-4">
              <div className="h-10 w-10 rounded-md bg-accent-sage-soft grid place-items-center text-accent-sage shrink-0">
                <f.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-body font-medium text-ink-primary">{f.title}</p>
                <p className="mt-1 text-small text-ink-secondary leading-relaxed">
                  {f.desc}
                </p>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="mt-16 text-center">
        <Card className="p-8">
          <p className="text-h3 font-semibold text-ink-primary">
            爱是宜居的家，欢迎到来。
          </p>
          <p className="mt-2 text-small text-ink-secondary">
            注册账号，给你的小屋添加第一件东西吧～
          </p>
          <div className="mt-6">
            <Link
              href="/signup"
              className="inline-flex items-center justify-center h-12 px-6 rounded-sm bg-accent-sage text-bg-elevated text-body font-medium hover:opacity-90 transition-opacity duration-tap"
            >
              建立一个你的小屋
            </Link>
          </div>
        </Card>
      </section>

      {/* ── Footer ── */}
      <footer className="mt-12 text-center">
        <Link
          href="/about"
          className="text-small text-ink-secondary underline-offset-2 hover:underline"
        >
          了解小屋
        </Link>
        <p className="mt-3 text-micro text-ink-tertiary">
          My Cabin Log · 2026
        </p>
      </footer>
    </main>
  )
}
