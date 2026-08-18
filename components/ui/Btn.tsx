'use client'

import * as React from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

/**
 * Btn — PRD §2.1
 *
 * variant: primary | secondary | ghost | danger | subtle
 * size:    sm(32) | md(40) | lg(48) | xl(56 主 CTA)
 * state:   default | pressed | disabled | loading
 * iconLeading | iconTrailing | iconOnly
 *
 * 触感：按下缩 0.97 + 颜色加深 8%
 * 禁用：opacity 0.45，不要灰色禁用样式（破坏色彩温度）
 */

export type BtnVariant =
  | 'primary'
  | 'secondary'
  | 'ghost'
  | 'danger'
  | 'subtle'

export type BtnSize = 'sm' | 'md' | 'lg' | 'xl'

export interface BtnProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: BtnVariant
  size?: BtnSize
  loading?: boolean
  iconLeading?: React.ReactNode
  iconTrailing?: React.ReactNode
  iconOnly?: React.ReactNode
  block?: boolean
}

const variantClasses: Record<BtnVariant, string> = {
  primary:
    'bg-accent-sage text-bg-elevated border border-accent-sage hover:bg-[#6a8462] active:bg-[#60755a]',
  secondary:
    'bg-bg-surface text-ink-primary border border-border-hairline hover:bg-bg-elevated',
  ghost:
    'bg-transparent text-ink-secondary border border-transparent hover:bg-bg-elevated',
  danger:
    'bg-accent-clay text-bg-elevated border border-accent-clay hover:bg-[#b56a4d] active:bg-[#a25d42]',
  subtle:
    'bg-transparent text-ink-secondary border border-transparent opacity-0 hover:opacity-100 focus-visible:opacity-100',
}

const sizeClasses: Record<BtnSize, string> = {
  sm: 'h-8 px-3 text-small gap-1.5',
  md: 'h-10 px-4 text-body gap-2',
  lg: 'h-12 px-5 text-h3 gap-2',
  xl: 'h-14 px-6 text-h3 gap-2.5',
}

const iconOnlySize: Record<BtnSize, string> = {
  sm: 'h-8 w-8',
  md: 'h-10 w-10',
  lg: 'h-12 w-12',
  xl: 'h-14 w-14',
}

export const Btn = React.forwardRef<HTMLButtonElement, BtnProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      disabled,
      iconLeading,
      iconTrailing,
      iconOnly,
      block,
      className,
      children,
      ...rest
    },
    ref
  ) => {
    const isDisabled = disabled || loading

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        className={cn(
          'inline-flex items-center justify-center rounded-md',
          'font-medium select-none whitespace-nowrap',
          'transition-[transform,background-color,border-color] duration-tap ease-out-quart',
          'active:scale-[0.97] active:brightness-95',
          'disabled:opacity-45 disabled:cursor-not-allowed disabled:active:scale-100',
          iconOnly ? iconOnlySize[size] : sizeClasses[size],
          variantClasses[variant],
          block && 'w-full',
          className
        )}
        aria-busy={loading || undefined}
        {...rest}
      >
        {loading ? (
          <Loader2
            className={cn('animate-spin', size === 'sm' ? 'h-4 w-4' : 'h-5 w-5')}
          />
        ) : iconOnly ? (
          iconOnly
        ) : (
          <>
            {iconLeading}
            {children}
            {iconTrailing}
          </>
        )}
      </button>
    )
  }
)
Btn.displayName = 'Btn'
