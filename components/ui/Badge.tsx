'use client'

import * as React from 'react'
import { cn } from '@/lib/utils/cn'

/**
 * Badge — atomic 状态徽章
 *
 * tone: sage(成功/到位) | clay(警告/低库存) | honey(注意/AI) | ink(中性)
 * kind: solid(填充底) | dot(点 + 文字)
 * size:  sm(20px 高) | md(24px 高)
 *
 * 用途:库存条上的"快过期"提示、确认页置信度标记、null 状态标识
 */

export type BadgeTone = 'sage' | 'clay' | 'honey' | 'ink'
export type BadgeKind = 'solid' | 'dot'

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone
  kind?: BadgeKind
  size?: 'sm' | 'md'
}

const toneClasses: Record<BadgeTone, { solid: string; dot: string }> = {
  sage: {
    solid: 'bg-accent-sage-soft text-accent-sage',
    dot: 'text-accent-sage',
  },
  clay: {
    solid: 'bg-accent-clay-soft text-accent-clay',
    dot: 'text-accent-clay',
  },
  honey: {
    solid: 'bg-accent-honey/20 text-accent-honey',
    dot: 'text-accent-honey',
  },
  ink: {
    solid: 'bg-bg-elevated text-ink-secondary',
    dot: 'text-ink-secondary',
  },
}

const dotColor: Record<BadgeTone, string> = {
  sage: 'bg-accent-sage',
  clay: 'bg-accent-clay',
  honey: 'bg-accent-honey',
  ink: 'bg-ink-secondary',
}

const sizeClasses = {
  sm: 'h-5 px-1.5 text-micro gap-1',
  md: 'h-6 px-2 text-small gap-1.5',
}

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  (
    { tone = 'ink', kind = 'solid', size = 'sm', className, children, ...rest },
    ref
  ) => {
    return (
      <span
        ref={ref}
        className={cn(
          'inline-flex items-center rounded-pill font-medium select-none',
          sizeClasses[size],
          kind === 'solid' ? toneClasses[tone].solid : toneClasses[tone].dot,
          className
        )}
        {...rest}
      >
        {kind === 'dot' && (
          <span
            className={cn('h-1.5 w-1.5 rounded-pill shrink-0', dotColor[tone])}
            aria-hidden="true"
          />
        )}
        {children}
      </span>
    )
  }
)
Badge.displayName = 'Badge'
