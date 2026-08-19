'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Title, Icon } from 'animal-island-ui'
import type { IconName } from 'animal-island-ui'
import { Card } from '@/components/ui/Card'

/**
 * /add — PRD §3.2 添加入口 · 动森版
 *
 * 四个入口用 animal-island-ui 的彩色 SVG 图标（相机/购物/图鉴/DIY），
 * 页头是燕尾缎带 Title。
 */

const entries: Array<{
  icon: IconName
  title: string
  desc: string
  eta: string
  available: boolean
  href: string
}> = [
  {
    icon: 'icon-camera',
    title: '拍张小票',
    desc: '拍小票或购物小条，AI 帮你整理',
    eta: '预估 30 秒',
    available: true,
    href: '/add/receipt',
  },
  {
    icon: 'icon-shopping',
    title: '上传购物截图',
    desc: '京东/淘宝/拼多多订单、购物车都行',
    eta: '预估 30 秒',
    available: true,
    href: '/add/screenshot',
  },
  {
    icon: 'icon-critterpedia',
    title: '拍照识物',
    desc: '拍冰箱、储物柜、桌面，AI 发现候选',
    eta: '预估 60 秒',
    available: true,
    href: '/add/camera',
  },
  {
    icon: 'icon-diy',
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
        <Title size="large">添点东西</Title>
        <p className="mt-3 text-body text-ink-secondary">
          选一种带回小家的方式
        </p>
      </header>

      <section className="mt-8 flex flex-col gap-3">
        {entries.map((e) => {
          const inner = (
            <Card className="p-4 flex items-center gap-4 hover:-translate-y-0.5 hover:bg-bg-elevated transition-[transform,background-color] duration-tap ease-out-quart">
              <div className="h-14 w-14 rounded-lg bg-bg-canvas grid place-items-center shrink-0">
                <Icon name={e.icon} size={36} bounce />
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
            >
              {inner}
            </div>
          )
        })}
      </section>

      <p className="mt-6 text-small text-ink-secondary">
        小提示：第一次使用推荐先试拍张小票，看 AI 帮你整理
      </p>
    </div>
  )
}
