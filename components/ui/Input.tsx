'use client'

import * as React from 'react'
import { AlertCircle, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

/**
 * Input — PRD §2.3
 *
 * kind: text | number | date
 * state: default | focused | filled | error | ai-suggested
 *
 * 数字用 stepper，不弹键盘（Sprint 1 再加；这里先 text/number/date）
 * ai-suggested 状态：蜂蜜色边框 + 小角标"AI"
 * 错误态：陶土橙色文字在下方 8px 处，不要抖动
 */

export type InputKind = 'text' | 'number' | 'date'

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  kind?: InputKind
  label?: string
  helperText?: string
  errorText?: string
  aiSuggested?: boolean
  trailingIcon?: React.ReactNode
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      kind = 'text',
      label,
      helperText,
      errorText,
      aiSuggested,
      trailingIcon,
      className,
      id,
      ...rest
    },
    ref
  ) => {
    const generatedId = React.useId()
    const inputId = id || generatedId
    const hasError = !!errorText

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="text-small text-ink-secondary"
          >
            {label}
          </label>
        )}
        <div className="relative">
          <input
            ref={ref}
            id={inputId}
            type={
              kind === 'number'
                ? 'number'
                : kind === 'date'
                  ? 'date'
                  : 'text'
            }
            inputMode={kind === 'number' ? 'numeric' : undefined}
            aria-invalid={hasError || undefined}
            aria-describedby={
              hasError || helperText
                ? `${inputId}-desc`
                : undefined
            }
            className={cn(
              'w-full h-10 px-4 rounded-pill bg-bg-elevated text-body font-medium',
              'text-ink-primary placeholder:text-ink-tertiary placeholder:font-normal',
              'border-2 transition-[border-color,background-color] duration-tap',
              'focus:bg-bg-elevated',
              hasError
                ? 'border-accent-clay'
                : aiSuggested
                  ? 'border-accent-honey'
                  : 'border-border-hairline hover:border-border-outline focus:border-accent-sage',
              className
            )}
            {...rest}
          />
          {aiSuggested && (
            <span
              className="absolute right-3 top-1/2 -translate-y-1/2 inline-flex items-center gap-1 px-2 h-5 rounded-pill bg-honey-soft text-honey-ink text-micro font-semibold"
              aria-label="AI 建议"
            >
              <Sparkles className="h-3 w-3" />
              AI
            </span>
          )}
          {trailingIcon && (
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-secondary">
              {trailingIcon}
            </span>
          )}
        </div>
        {(hasError || helperText) && (
          <p
            id={`${inputId}-desc`}
            className={cn(
              'flex items-center gap-1 text-micro',
              hasError ? 'text-accent-clay' : 'text-ink-secondary'
            )}
          >
            {hasError && <AlertCircle className="h-3 w-3" />}
            {hasError ? errorText : helperText}
          </p>
        )}
      </div>
    )
  }
)
Input.displayName = 'Input'
