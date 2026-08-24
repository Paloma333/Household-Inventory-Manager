'use client'

import * as React from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

/**
 * Btn — PRD §2.1 · 动森版（animal-island-ui 3D 游戏按钮）
 *
 * variant: primary | secondary | ghost | danger | subtle
 * size:    sm(32) | md(40) | lg(48) | xl(56 主 CTA)
 * state:   default | pressed | disabled | loading
 * iconLeading | iconTrailing | iconOnly
 *
 * 动森规则：
 * - 全部 pill 圆角（50px）
 * - 3D 像素厚边只给 primary / danger：默认 0 5px 0 0，hover 抬起 -1px 厚边 6px，
 *   按下 translateY(2px) 厚边收 1px（"按下去"手感）
 * - secondary 用奶油底 + 暖棕描边 + 柔和浮起阴影
 * - 禁用：opacity 0.45 + 厚边消失
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
    'bg-accent-sage text-white border-2 border-accent-sage ' +
    'shadow-[0_5px_0_0_var(--shadow-teal-3d)] ' +
    'hover:bg-[#41dd52] hover:border-[#41dd52] hover:-translate-y-px hover:shadow-[0_6px_0_0_var(--shadow-teal-3d)] ' +
    'active:translate-y-0.5 active:shadow-[0_1px_0_0_var(--shadow-teal-3d)]',
  secondary:
    'bg-bg-canvas text-ink-primary border-2 border-border-outline ' +
    'shadow-[0_2px_4px_0_rgba(61,52,40,0.06)] ' +
    'hover:-translate-y-px hover:shadow-[0_3px_10px_0_rgba(61,52,40,0.1)] hover:border-accent-sage hover:text-accent-sage ' +
    'active:translate-y-0 active:shadow-[0_2px_4px_0_rgba(61,52,40,0.06)]',
  ghost:
    'bg-transparent text-ink-secondary border-2 border-transparent hover:bg-bg-elevated',
  danger:
    'bg-accent-danger text-white border-2 border-accent-danger ' +
    'shadow-[0_5px_0_0_var(--shadow-danger-3d)] ' +
    'hover:bg-[#e87878] hover:border-[#e87878] hover:-translate-y-px hover:shadow-[0_6px_0_0_var(--shadow-danger-3d)] ' +
    'active:translate-y-0.5 active:shadow-[0_1px_0_0_var(--shadow-danger-3d)]',
  subtle:
    'bg-transparent text-ink-secondary border-2 border-transparent opacity-0 hover:opacity-100 focus-visible:opacity-100',
}

const sizeClasses: Record<BtnSize, string> = {
  sm: 'h-8 px-4 text-small gap-1.5',
  md: 'h-10 px-5 text-body gap-2',
  lg: 'h-12 px-6 text-h3 gap-2',
  xl: 'h-14 px-7 text-h3 gap-2.5',
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
          'inline-flex items-center justify-center rounded-pill',
          'font-semibold tracking-[0.02em] select-none whitespace-nowrap',
          'transition-[transform,box-shadow,background-color,border-color,color] duration-tap ease-out-quart',
          'disabled:opacity-45 disabled:cursor-not-allowed disabled:shadow-none disabled:translate-y-0',
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
