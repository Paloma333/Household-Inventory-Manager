import type { Metadata } from 'next'
import Link from 'next/link'
import { Card } from '@/components/ui/Card'

export const metadata: Metadata = {
  title: '关于小家',
  description: '小家（him）— 一个让 AI 帮你记住家里有什么的治愈系库存工具',
}

const FEATURES = [
  '拍小票 / 截图 / 拍照识物，AI 自动识别物品入库',
  '库存一览：搜索、分类、低库存与临期提醒',
  '补货清单：已用完 / 快用完 / 快过期自动分组，一键勾选买回',
  '购物清单可分享给家人，公开链接只读，token 可随时作废',
  'PWA：加到主屏幕，接近原生 App 体验',
]

const STACK = [
  'Next.js 14 (App Router) · TypeScript · Tailwind',
  'Supabase：Postgres + Auth + Storage + RLS',
  'Qwen-VL-Plus 视觉识别（含本地 mock 兜底）',
  'React Query · Zustand · react-hook-form · zod',
]

export default function AboutPage() {
  return (
    <main className="mx-auto w-full max-w-xl px-6 pt-10 pb-16">
      <header>
        <p className="text-small text-ink-secondary">him · household inventory manager</p>
        <h1 className="mt-2 font-semibold text-h1 text-ink-primary">关于小家</h1>
      </header>

      <section className="mt-6">
        <Card className="p-5">
          <p className="text-body text-ink-secondary leading-relaxed">
            小家是一个帮你记住家里有什么的库存工具。不用记数、不用查单，
            买东西时拍张照，剩下的交给它——快用完的时候它会提醒你补货。
          </p>
        </Card>
      </section>

      <section className="mt-6">
        <h2 className="text-h3 font-semibold mb-3">能做什么</h2>
        <ul className="flex flex-col gap-2">
          {FEATURES.map((f) => (
            <Card key={f} className="p-4 text-body text-ink-primary">
              {f}
            </Card>
          ))}
        </ul>
      </section>

      <section className="mt-6">
        <h2 className="text-h3 font-semibold mb-3">技术栈</h2>
        <ul className="flex flex-col gap-2">
          {STACK.map((s) => (
            <Card key={s} className="p-4 text-body text-ink-secondary">
              {s}
            </Card>
          ))}
        </ul>
      </section>

      <div className="mt-10">
        <Link
          href="/"
          className="inline-block text-body font-medium text-sage hover:underline"
        >
          ← 回到小家
        </Link>
      </div>
    </main>
  )
}
