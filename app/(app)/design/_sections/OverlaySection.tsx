'use client'

import * as React from 'react'
import { Section } from './Section'
import { Sheet } from '@/components/ui/Sheet'
import { Btn } from '@/components/ui/Btn'
import { Input } from '@/components/ui/Input'

/**
 * OverlaySection — Sheet 4 种类型
 *
 * PRD §2.7 type: dialog | sheet | popup | fullscreen
 * 行为:esc / swipeDown / backdropClick(可在 props 关)
 * sheet 从底部上推 280ms ease-out-expo;dialog 居中缩放 0.94 → 1
 */

type SheetType = 'dialog' | 'sheet' | 'popup' | 'fullscreen'

export function OverlaySection() {
  const [openType, setOpenType] = React.useState<SheetType | null>(null)

  const close = () => setOpenType(null)

  return (
    <Section
      id="overlays"
      eyebrow="06 · Overlays"
      title="浮层"
      intro="4 种 Sheet 共用同一组件:type 决定初始/退出动画与位置。sheet 是默认(底部上推 280ms ease-out-expo),dialog 居中缩放,fullscreen 全屏替换,popup 跟 dialog 一样位置但视觉更轻。"
    >
      <div className="flex flex-wrap gap-3">
        <Btn variant="primary" size="md" onClick={() => setOpenType('sheet')}>
          打开 sheet
        </Btn>
        <Btn variant="secondary" size="md" onClick={() => setOpenType('dialog')}>
          打开 dialog
        </Btn>
        <Btn
          variant="secondary"
          size="md"
          onClick={() => setOpenType('popup')}
        >
          打开 popup
        </Btn>
        <Btn variant="ghost" size="md" onClick={() => setOpenType('fullscreen')}>
          打开 fullscreen
        </Btn>
      </div>

      <div className="mt-4 text-micro text-ink-tertiary font-num">
        ESC 退出 / 点击 backdrop 退出(默认开)/ sheet 加 dragHandle / fullscreen 直接替代页面
      </div>

      {/* 全部 4 种叠同一个组件实例 — props 决定表现 */}
      <Sheet
        open={openType === 'sheet'}
        onOpenChange={(o) => !o && close()}
        type="sheet"
        title="从底部上推的 sheet"
        dragHandle
      >
        <div className="p-5 space-y-4">
          <p className="text-body text-ink-secondary">
            常用于"加入清单 / 加一项 / 删除确认"。slide 280ms,cubic-bezier 0.16 1 0.3 1。
          </p>
          <Input label="商品名" placeholder="比如 牛奶" />
          <Input label="数量" kind="number" defaultValue="2" />
          <Btn variant="primary" size="lg" block onClick={close}>
            添加到清单
          </Btn>
        </div>
      </Sheet>

      <Sheet
        open={openType === 'dialog'}
        onOpenChange={(o) => !o && close()}
        type="dialog"
        title="是否删除?"
      >
        <div className="p-5 space-y-4">
          <p className="text-body text-ink-secondary">
            居中 280px 宽,缩放进入(0.94 → 1)。常用于二次确认。
          </p>
          <div className="flex gap-2 justify-end">
            <Btn variant="ghost" size="md" onClick={close}>
              取消
            </Btn>
            <Btn variant="danger" size="md" onClick={close}>
              删除
            </Btn>
          </div>
        </div>
      </Sheet>

      <Sheet
        open={openType === 'popup'}
        onOpenChange={(o) => !o && close()}
        type="popup"
        title="小提示"
      >
        <div className="p-5 space-y-3">
          <p className="text-body text-ink-secondary">
            顶部下拉/底部上推的小提示,常用于 toast 之外的轻量反馈。
          </p>
          <Btn variant="primary" size="md" onClick={close}>
            知道了
          </Btn>
        </div>
      </Sheet>

      <Sheet
        open={openType === 'fullscreen'}
        onOpenChange={(o) => !o && close()}
        type="fullscreen"
        title="全屏浮层"
      >
        <div className="p-5 space-y-4">
          <p className="text-body text-ink-secondary">
            直接替换整个 viewport。给"扫描小票 / 多步表单"用。
          </p>
          <Input label="表单字段" placeholder="在这里放全屏表单内容" />
          <Input label="另一个字段" placeholder="step 2 / N" />
          <Btn variant="primary" size="lg" block onClick={close}>
            完成
          </Btn>
        </div>
      </Sheet>
    </Section>
  )
}
