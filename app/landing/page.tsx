import type { Metadata } from 'next'
import Link from 'next/link'
import {
  Camera,
  BellRing,
  ListChecks,
  Share2,
  Sparkles,
  House,
  Palette,
  Wind,
  Boxes,
} from 'lucide-react'
import { Card } from '@/components/ui/Card'

/**
 * /landing — 作品集 landing 页（公开，PRD §0 气质锚点）
 *
 * 项目介绍 + 设计意图 + 真实 demo 入口。
 * 移动端优先：max-w-xl 单列，跟 App 同一套设计 tokens。
 */

export const metadata: Metadata = {
  title: '小家 · 作品集',
  description:
    '小家（him）— 一个让 AI 帮你记住家里有什么的治愈系库存工具。拍照入库、低库存提醒、购物清单分享。',
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

const DESIGN_INTENT = [
  {
    icon: House,
    title: '生活感，而非应用感',
    desc: '打开它不是打开一个工作台，是"走进自己刚收拾过的小厨房"。没有大喇叭、没有庆祝动画。',
  },
  {
    icon: Palette,
    title: '动森式治愈小岛',
    desc: '奶油羊皮纸底 + 薄荷青 #19C8B9 + 暖棕文字，按钮有"按下去"的 3D 手感。视觉基于 animal-island-ui 设计系统。',
  },
  {
    icon: Wind,
    title: '克制，是尊重',
    desc: '能不说话就不说话。提示只出现在该出现的时候：快用完了、快过期了、该补货了。',
  },
]

const STACK = [
  'Next.js 14 (App Router) + TypeScript + Tailwind',
  'Supabase：Postgres · Auth · Storage · RLS 行级安全',
  'Qwen3.6-Flash 视觉识别，本地 mock 兜底，三档置信度确认',
  '19 个 API 路由 · PWA 可加主屏幕 · 设计系统展示页',
]

export default function LandingPage() {
  return (
    <main className="mx-auto w-full max-w-xl px-6 pt-14 pb-20">
      {/* ── Hero ── */}
      <header className="text-center">
        <p className="text-small text-ink-secondary tracking-widest uppercase">
          him · household inventory manager
        </p>
        <h1 className="mt-3 font-semibold text-display text-ink-primary leading-snug">
          记住家里有什么，
          <br />
          就不用记了
        </h1>
        <p className="mt-4 text-body text-ink-secondary leading-relaxed">
          小家是一个让 AI 帮你管理家里库存的 Web App。
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

      {/* ── 设计意图 ── */}
      <section id="design" className="mt-16">
        <h2 className="text-h3 font-semibold text-ink-primary text-center">设计意图</h2>
        <p className="mt-2 text-small text-ink-secondary text-center">
          一个不打扰你的工具，应该长什么样
        </p>
        <div className="mt-6 flex flex-col gap-3">
          {DESIGN_INTENT.map((d) => (
            <Card key={d.title} className="p-5 flex gap-4">
              <div className="h-10 w-10 rounded-md bg-bg-elevated border border-border-hairline grid place-items-center text-ink-secondary shrink-0">
                <d.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-body font-medium text-ink-primary">{d.title}</p>
                <p className="mt-1 text-small text-ink-secondary leading-relaxed">
                  {d.desc}
                </p>
              </div>
            </Card>
          ))}
        </div>
        <blockquote className="mt-6 px-5 py-4 rounded-md bg-accent-sage-soft text-body text-ink-primary leading-relaxed">
          「绝对禁止：大眼睛卡通宠物、渐变彩色卡片墙、整屏 toast 庆祝。」
          <span className="block mt-1 text-small text-ink-secondary">
            —— 写在产品 PRD 第 0 页的第一行
          </span>
        </blockquote>
      </section>

      {/* ── 技术栈 ── */}
      <section className="mt-16">
        <h2 className="text-h3 font-semibold text-ink-primary text-center">技术栈</h2>
        <ul className="mt-6 flex flex-col gap-2">
          {STACK.map((s) => (
            <Card key={s} className="px-4 py-3 text-small text-ink-secondary flex items-center gap-2">
              <Boxes className="h-3.5 w-3.5 text-accent-sage shrink-0" />
              {s}
            </Card>
          ))}
        </ul>
      </section>

      {/* ── CTA ── */}
      <section className="mt-16 text-center">
        <Card className="p-8">
          <p className="text-h3 font-semibold text-ink-primary">
            想试试看家里的感觉？
          </p>
          <p className="mt-2 text-small text-ink-secondary">
            注册一个账号，加第一件东西，60 秒
          </p>
          <div className="mt-6">
            <Link
              href="/signup"
              className="inline-flex items-center justify-center h-12 px-6 rounded-sm bg-accent-sage text-bg-elevated text-body font-medium hover:opacity-90 transition-opacity duration-tap"
            >
              带一份小家回来
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
          关于小家
        </Link>
        <p className="mt-3 text-micro text-ink-tertiary">
          him · 2026 · 设计文档：PRD v1.1（UI 交互规格）
        </p>
      </footer>
    </main>
  )
}
