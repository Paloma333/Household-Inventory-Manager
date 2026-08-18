'use client'

import * as React from 'react'
import { Plus, Download, ChevronRight, Trash2 } from 'lucide-react'
import { Section } from './Section'
import { Btn } from '@/components/ui/Btn'

/**
 * ButtonSection — Btn 组件展示
 *
 * 5 variants × 4 sizes + icon leading/trailing/iconOnly/loading/block/disabled
 * PRD §2.1:触感 — 按下缩 0.97 + 颜色加深 8%;禁用 = opacity 0.45
 */

const variants = ['primary', 'secondary', 'ghost', 'danger', 'subtle'] as const
const sizes = ['sm', 'md', 'lg', 'xl'] as const

export function ButtonSection() {
  const [loading, setLoading] = React.useState(false)

  return (
    <Section
      id="buttons"
      eyebrow="03 · Buttons"
      title="按钮"
      intro="主操作永远 primary;次操作 secondary;危险 destructive 走 danger;subtle 只在 hover 时显形,适合列表项右侧。三种尺寸,移动端主 CTA 用 xl(56px 高),小按钮 sm(32px) 给卡片内。"
    >
      {/* Variants × Sizes 矩阵 */}
      <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
        <table className="w-full text-small border-separate border-spacing-y-3 min-w-[640px]">
          <thead>
            <tr className="text-micro text-ink-tertiary uppercase tracking-wider">
              <th className="text-left font-medium pl-2">variant \\ size</th>
              {sizes.map((s) => (
                <th key={s} className="font-medium text-center">
                  {s}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {variants.map((v) => (
              <tr key={v}>
                <td className="pl-2 text-ink-secondary font-medium font-num">
                  {v}
                </td>
                {sizes.map((s) => (
                  <td key={s} className="text-center">
                    <Btn variant={v} size={s}>
                      操作
                    </Btn>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Icon states */}
      <div className="mt-10">
        <div className="text-micro uppercase text-ink-tertiary font-num tracking-wider mb-3">
          01 · States & Icons
        </div>
        <div className="flex flex-wrap gap-3 items-center">
          <Btn variant="primary" size="md" iconLeading={<Plus className="h-4 w-4" />}>
            iconLeading
          </Btn>
          <Btn variant="primary" size="md" iconTrailing={<ChevronRight className="h-4 w-4" />}>
            iconTrailing
          </Btn>
          <Btn
            variant="secondary"
            size="md"
            iconOnly={<Download className="h-4 w-4" />}
            aria-label="下载"
          />
          <Btn variant="danger" size="md" iconLeading={<Trash2 className="h-4 w-4" />}>
            删除
          </Btn>
          <Btn
            variant="primary"
            size="md"
            loading={loading}
            onClick={() => {
              setLoading(true)
              setTimeout(() => setLoading(false), 1500)
            }}
          >
            {loading ? '保存中' : '保存'}
          </Btn>
          <Btn variant="primary" size="md" disabled>
            禁用(disabled)
          </Btn>
        </div>
      </div>

      {/* Block + 触感提示 */}
      <div className="mt-10">
        <div className="text-micro uppercase text-ink-tertiary font-num tracking-wider mb-3">
          02 · Block + 触感
        </div>
        <Btn variant="primary" size="lg" block iconLeading={<Plus className="h-5 w-5" />}>
          新建清单(底部 CTA 样式)
        </Btn>
        <div className="mt-3 text-small text-ink-secondary">
          按下时缩到 0.97 + 加深 8% 亮度(cubic-bezier 0.25 1 0.5 1,120ms),回弹不刺眼。
        </div>
      </div>
    </Section>
  )
}
