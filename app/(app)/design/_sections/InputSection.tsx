'use client'

import * as React from 'react'
import { Sparkles, Search } from 'lucide-react'
import { Section } from './Section'
import { Input } from '@/components/ui/Input'
import { Stepper } from '@/components/ui/Stepper'

/**
 * InputSection — 表单输入 + 数字步进器
 *
 * Input:3 kinds(text/number/date) + 5 states(default/focused/filled/error/ai-suggested)
 * Stepper:单击 ±1,长按 0.5s 起自动加速 (120ms/步)
 */

export function InputSection() {
  const [qty, setQty] = React.useState(3)
  const [qtyBig, setQtyBig] = React.useState(12)

  return (
    <Section
      id="inputs"
      eyebrow="04 · Inputs"
      title="输入"
      intro="Input 一圈 1px hairline + 焦点态 sage;错误用陶土橙文字,不抖动;AI 建议态蜂蜜色边 + 角标,绝不让用户以为是普通字段。Stepper 单击 ±1、长按加速 — 见 Sprint 3 用户反馈修。"
    >
      {/* 三个 kind */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
        <Input label="商品名" placeholder="比如 牛奶" defaultValue="全脂牛奶" />
        <Input
          label="数量"
          kind="number"
          defaultValue="2"
          helperText="数字用 stepper,不弹键盘"
        />
        <Input kind="date" label="过期日期" defaultValue="2026-09-12" />
        <Input
          label="品牌"
          placeholder="选填"
          helperText="OCR 自动识别时可改"
          aiSuggested
          defaultValue="光明"
        />
        <Input
          label="错误态示例"
          defaultValue="bad@@"
          errorText="商品名不能含特殊字符"
        />
        <Input
          label="搜索"
          placeholder="搜索库存"
          trailingIcon={<Search className="h-4 w-4" />}
        />
      </div>

      {/* AI 建议长示例 */}
      <div className="mt-6 max-w-2xl">
        <Input
          label="AI 识别结果(蜂蜜色边 + Sparkles 角标)"
          aiSuggested
          defaultValue="Lactalis 全脂牛奶 1L"
          helperText="Sprint 2 识别后展示,用户可改"
        />
      </div>

      {/* Stepper */}
      <div className="mt-12">
        <div className="text-micro uppercase text-ink-tertiary font-num tracking-wider mb-3">
          Stepper — PRD §2.3
        </div>

        <div className="flex flex-wrap items-end gap-8">
          <div>
            <div className="text-micro text-ink-secondary mb-2">默认(40px 高)</div>
            <Stepper value={qty} onChange={setQty} min={0} max={20} />
            <div className="mt-2 text-small text-ink-tertiary font-num">
              当前 {qty} · 点 + 单击 +1;长按 0.5s 起加速
            </div>
          </div>

          <div>
            <div className="text-micro text-ink-secondary mb-2">商品详情主区(56px)</div>
            <Stepper
              value={qtyBig}
              onChange={setQtyBig}
              min={0}
              max={99}
              large
            />
          </div>

          <div>
            <div className="text-micro text-ink-secondary mb-2">disabled</div>
            <Stepper value={5} onChange={() => {}} disabled />
          </div>
        </div>

        <div className="mt-4 max-w-md text-small text-ink-secondary">
          单击 = 步进 1 次(不是 2 次,这点 Sprint 3 修过一次 — 浏览器对同一按钮会同时 fire
          pointerdown + click,旧版本两个都调 adjust 所以会双倍)。长按进入连续模式后
          click 自动跳过,避免冲突。
        </div>
      </div>
    </Section>
  )
}
