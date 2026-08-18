import Link from 'next/link'
import { ArrowLeft, Camera, ImagePlus, ScanLine, Pencil } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Btn } from '@/components/ui/Btn'

/**
 * /add — PRD §3.2 添加入口
 * Sprint 1：手动添加可用（→ /add/manual），其余三个 AI 入口带"Sprint 2 来"
 */

const entries = [
  {
    icon: Camera,
    title: '拍张小票',
    desc: '拍小票或购物小条，AI 帮你整理',
    eta: '预估 30 秒',
    available: true,
    href: '/add/receipt',
  },
  {
    icon: ImagePlus,
    title: '上传购物截图',
    desc: '京东/淘宝/拼多多订单、购物车都行',
    eta: '预估 30 秒',
    available: true,
    href: '/add/screenshot',
  },
  {
    icon: ScanLine,
    title: '拍照识物',
    desc: '拍冰箱、储物柜、桌面，AI 发现候选',
    eta: '预估 60 秒',
    available: true,
    href: '/add/camera',
  },
  {
    icon: Pencil,
    title: '手动添加',
    desc: '自己填名字和数量',
    eta: '立刻开始',
    available: true,
    href: '/add/manual',
  },
]

export default function AddPage() {
  return (
    <div className="px-6 pt-10 pb-6">
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-small text-ink-secondary mb-4"
      >
        <ArrowLeft className="h-4 w-4" /> 小家
      </Link>
      <header>
        <h1 className="font-semibold text-h1 text-ink-primary">添点东西</h1>
        <p className="mt-2 text-body text-ink-secondary">
          选一种带回小家的方式
        </p>
      </header>

      <section className="mt-8 flex flex-col gap-3">
        {entries.map((e) => {
          const Icon = e.icon
          const inner = (
            <Card className="p-4 flex items-center gap-4 hover:bg-bg-elevated transition-colors duration-tap">
              <div className="h-12 w-12 rounded-sm bg-bg-canvas grid place-items-center text-accent-sage">
                <Icon className="h-6 w-6" strokeWidth={1.5} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-h3 font-semibold">{e.title}</p>
                  {!e.available && (
                    <span className="px-1.5 h-5 inline-flex items-center rounded-xs bg-bg-canvas text-micro text-ink-secondary">
                      即将上线
                    </span>
                  )}
                </div>
                <p className="text-small text-ink-secondary mt-0.5">
                  {e.desc}
                </p>
                <p className="text-micro text-ink-tertiary mt-1">{e.eta}</p>
              </div>
            </Card>
          )
          return e.available && e.href ? (
            <Link key={e.title} href={e.href}>
              {inner}
            </Link>
          ) : (
            <div
              key={e.title}
              className="opacity-60"
              aria-disabled="true"
              title="Sprint 2 启用"
            >
              {inner}
            </div>
          )
        })}
      </section>

      <p className="mt-6 text-small text-ink-secondary">
        小提示：第一次使用推荐先试手动添加 → Sprint 2 来试 AI 闭环
      </p>
    </div>
  )
}
