import * as React from 'react'
import { cn } from '@/lib/utils/cn'

/**
 * Card — PRD §2.2
 *
 * kind: product | category | lowStock | change | empty
 *
 * 卡片分层：1px 边线 + 背景差，不用阴影
 */

export type CardKind =
  | 'default'
  | 'product'
  | 'category'
  | 'lowStock'
  | 'change'
  | 'empty'

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  kind?: CardKind
  selected?: boolean
  /** 左滑删除状态，外层会控制色 */
  swiping?: boolean
  /** 无边框风格：用于首页大卡片 */
  borderless?: boolean
  as?: 'div' | 'button' | 'li'
}

const kindClasses: Record<CardKind, string> = {
  default: 'bg-bg-surface',
  product: 'bg-bg-surface',
  category: 'bg-bg-surface',
  lowStock: 'bg-accent-clay-soft',
  change: 'bg-bg-surface',
  /* 空状态容器：动森 dashed 虚线卡片 */
  empty: 'bg-transparent border-dashed border-2 border-border-outline',
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ kind = 'default', selected, borderless, className, children, ...rest }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'transition-[background-color,border-color,transform] duration-tap ease-out-quart',
          borderless
            ? 'rounded-2xl border-0'
            : 'rounded-md border border-border-hairline',
          kindClasses[kind],
          selected && 'border-accent-sage border-2',
          className
        )}
        {...rest}
      >
        {children}
      </div>
    )
  }
)
Card.displayName = 'Card'
