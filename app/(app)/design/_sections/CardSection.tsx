'use client'

import * as React from 'react'
import { Sparkles } from 'lucide-react'
import { Section } from './Section'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { toast } from '@/components/ui/Toast'
import { Btn } from '@/components/ui/Btn'

/**
 * CardSection — 卡片 + 各种状态面
 *
 * Card:default / product / category / lowStock / change
 * Badge:sage/clay/honey/ink × solid/dot × sm/md
 * EmptyState:永远带一个主 CTA
 * Skeleton:三种形态 — rect / circle / text
 * Toast:info/success/error/undo 四种 tone
 */

export function CardSection() {
  return (
    <Section
      id="cards"
      eyebrow="05 · Cards & Feedback"
      title="卡片与状态"
      intro="卡片分层靠 1px hairline + 背景差,绝不用阴影。Badge 用 4 种 tone × 2 形态 × 2 尺寸,把状态抽象成视觉 token 而不是每个地方硬写。空状态必须带 1 个主 CTA。"
    >
      {/* Cards */}
      <div className="text-micro uppercase text-ink-tertiary font-num tracking-wider mb-3">
        01 · Card
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8">
        {(
          [
            { kind: 'default' as const, label: 'default / 普通卡片' },
            { kind: 'product' as const, label: 'product / 商品卡' },
            { kind: 'category' as const, label: 'category / 分类' },
            { kind: 'change' as const, label: 'change / 改动量' },
            { kind: 'lowStock' as const, label: 'lowStock / 低库存' },
            {
              kind: 'default' as const,
              label: 'selected(双框)',
              selected: true,
            },
          ] as Array<{ kind: 'default' | 'product' | 'category' | 'change' | 'lowStock'; label: string; selected?: boolean }>
        ).map((c) => (
          <Card key={c.label + c.kind} kind={c.kind} selected={c.selected}>
            <div className="p-5">
              <div className="text-small text-ink-primary font-medium">
                {c.label}
              </div>
              <div className="text-micro text-ink-tertiary font-num mt-1">
                kind="{c.kind}"{c.selected ? ' selected' : ''}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Badge */}
      <div className="text-micro uppercase text-ink-tertiary font-num tracking-wider mb-3">
        02 · Badge
      </div>
      <div className="space-y-4 mb-8">
        <div className="flex flex-wrap gap-2 items-center">
          <Badge tone="sage">已建档</Badge>
          <Badge tone="clay">快过期</Badge>
          <Badge tone="honey">
            <Sparkles className="h-3 w-3" /> AI 建议
          </Badge>
          <Badge tone="ink">中性</Badge>
          <Badge tone="sage" kind="dot">
            已核实
          </Badge>
          <Badge tone="clay" kind="dot">
            注意
          </Badge>
          <Badge tone="honey" kind="dot">
            待处理
          </Badge>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <Badge tone="sage" size="md">
            size=md
          </Badge>
          <Badge tone="clay" size="md">
            大尺寸
          </Badge>
        </div>
      </div>

      {/* EmptyState */}
      <div className="text-micro uppercase text-ink-tertiary font-num tracking-wider mb-3">
        03 · EmptyState — 永远带 CTA
      </div>
      <div className="rounded-md border border-border-hairline bg-bg-surface overflow-hidden mb-8">
        <EmptyState
          title="还没建任何清单"
          description="Sprint 3 新建一个,自动给你分成三组:用完 · 快用完 · 快过期。"
          primary={<Btn variant="primary" size="md">新建清单</Btn>}
        />
      </div>

      {/* Skeleton */}
      <div className="text-micro uppercase text-ink-tertiary font-num tracking-wider mb-3">
        04 · Skeleton — 页面加载态
      </div>
      <div className="rounded-md border border-border-hairline bg-bg-surface p-5 mb-8">
        <div className="flex items-center gap-4">
          <Skeleton variant="circle" className="h-12 w-12 shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton variant="text" className="w-3/4" />
            <Skeleton variant="text" className="w-1/2" />
          </div>
        </div>
        <div className="mt-5 space-y-3">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
        <div className="mt-3 text-micro text-ink-tertiary font-num">
          1.2s 闪烁,rect / circle / text 三种
        </div>
      </div>

      {/* Toast */}
      <div className="text-micro uppercase text-ink-tertiary font-num tracking-wider mb-3">
        05 · Toast — 全屏底中弹
      </div>
      <div className="flex flex-wrap gap-3 mb-3">
        <Btn variant="primary" size="md" onClick={() => toast.success('保存成功')}>
          toast.success
        </Btn>
        <Btn
          variant="secondary"
          size="md"
          onClick={() => toast.info('库存已更新')}
        >
          toast.info
        </Btn>
        <Btn
          variant="danger"
          size="md"
          onClick={() => toast.error('识别失败,请重试')}
        >
          toast.error(持续)
        </Btn>
        <Btn
          variant="ghost"
          size="md"
          onClick={() =>
            toast.undo('已删除"全脂牛奶"', () => toast.info('已撤回'))
          }
        >
          toast.undo(5s 撤回)
        </Btn>
      </div>
      <div className="text-micro text-ink-tertiary font-num">
        提示:成功不弹 toast(改用 mini 光晕,目前占位)— 见 PRD §2.6 / §5
      </div>
    </Section>
  )
}
