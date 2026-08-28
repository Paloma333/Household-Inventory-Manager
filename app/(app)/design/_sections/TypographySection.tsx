'use client'

import * as React from 'react'
import { Section } from './Section'

/**
 * TypographySection — 字体阶梯
 *
 * 7 个尺寸 tokens 来自 globals.css;流体;font-display 用 LXGW WenKai / Source Han Serif
 * 数字字体 .font-num 用 Inter,带等宽数字
 */

const sizes = [
  { key: 'display', label: 'display', sample: '把家里放进云' },
  { key: 'h1', label: 'h1 / 24', sample: '小屋首页' },
  { key: 'h2', label: 'h2 / 20', sample: '快过期的牛奶' },
  { key: 'h3', label: 'h3 / 17', sample: '今天吃这个' },
  { key: 'body', label: 'body / 15', sample: '囤了 3 包咖啡豆,临期 5 天' },
  { key: 'small', label: 'small / 13', sample: '小字注解、详情页说明' },
  { key: 'micro', label: 'micro / 11', sample: '微文 / 时间戳 / 标签' },
]

export function TypographySection() {
  return (
    <Section
      id="typography"
      eyebrow="02 · Typography"
      title="字体"
      intro="display 用 LXGW WenKai 衬线(开发期 fallback system serif)给首页一点书卷气;body/small/micro 用 PingFang SC;数字全走 tabular-nums + Inter 让滚动不抖。"
    >
      <div className="space-y-4">
        {sizes.map((s) => (
          <div
            key={s.key}
            className="flex items-baseline gap-4 sm:gap-6 py-3 border-b border-border-hairline"
          >
            <code className="w-20 sm:w-28 text-micro text-ink-tertiary font-num shrink-0">
              {s.label}
            </code>
            <div
              className={`text-${s.key} text-ink-primary ${
                s.key === 'display' ? 'font-display' : ''
              } truncate flex-1`}
            >
              {s.sample}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-md border border-border-hairline bg-bg-surface p-5">
          <div className="text-micro uppercase text-ink-tertiary font-num tracking-wider mb-2">
            tabular-nums (.font-num)
          </div>
          <div className="font-num text-h2 text-ink-primary">
            88,888 → 999,999 → 1,000,000
          </div>
          <div className="mt-2 text-small text-ink-secondary">
            数字滚动 / 库存数量 / 价格栏全部用这个,数字宽度一致。
          </div>
        </div>

        <div className="rounded-md border border-border-hairline bg-bg-surface p-5">
          <div className="text-micro uppercase text-ink-tertiary font-num tracking-wider mb-2">
            font-display (衬线)
          </div>
          <div className="font-display text-h1 text-ink-primary">
            小屋,记得你有的
          </div>
          <div className="mt-2 text-small text-ink-secondary">
            首页大标题、空态文案、Sprint 5 介绍卡。
          </div>
        </div>
      </div>
    </Section>
  )
}
