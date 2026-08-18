'use client'

import * as React from 'react'
import { Minus, Plus } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { animateNumber } from '@/lib/utils/animate-number'

/**
 * Stepper — PRD §2.3 / §3.4.4
 * 数字用 stepper 不弹键盘。长按 0.5s 进入连续 +/- 模式（每 120ms 步进 1）。
 *
 * 关键：单击 = 步进 1 次（不是 2 次）
 *   - 早期版本同时挂 onPointerDown + onClick，两个都调 adjust → 点一下 +2
 *   - 修：pointerdown 只起 timer，click 才真正 adjust；长按进入连按模式后 click 跳过
 */

export interface StepperProps {
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  step?: number
  /** 大号样式，用于商品详情主区 */
  large?: boolean
  className?: string
  disabled?: boolean
}

export function Stepper({
  value,
  onChange,
  min = 0,
  max = 999,
  step = 1,
  large = false,
  className,
  disabled = false,
}: StepperProps) {
  const [display, setDisplay] = React.useState(value)
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const intervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null)
  const cancelRef = React.useRef<(() => void) | null>(null)
  // 长按进入连续模式后，click 不再 adjust（否则会多 +1）
  const longPressActiveRef = React.useRef(false)

  // value 改变时滚动到位
  React.useEffect(() => {
    cancelRef.current?.()
    cancelRef.current = animateNumber(display, value, 220, setDisplay)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  React.useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      if (intervalRef.current) clearInterval(intervalRef.current)
      cancelRef.current?.()
    }
  }, [])

  const adjust = (delta: number) => {
    const next = Math.max(min, Math.min(max, value + delta))
    if (next === value) return
    onChange(next)
  }

  const beginLongPress = (delta: number) => {
    if (disabled) return
    longPressActiveRef.current = false
    // 0.5s 后进入连续模式
    timerRef.current = setTimeout(() => {
      longPressActiveRef.current = true
      adjust(delta) // 第一次连按（给用户即时反馈）
      intervalRef.current = setInterval(() => adjust(delta), 120)
    }, 500)
  }

  const endPress = () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (intervalRef.current) clearInterval(intervalRef.current)
    timerRef.current = null
    intervalRef.current = null
  }

  const handleClick = (delta: number) => {
    // 长按已经处理过（adjust + interval），click 不重复
    if (longPressActiveRef.current) {
      longPressActiveRef.current = false
      return
    }
    adjust(delta)
  }

  const btn = (delta: number) => (
    <button
      type="button"
      onClick={() => handleClick(delta)}
      onPointerDown={() => beginLongPress(delta)}
      onPointerUp={endPress}
      onPointerLeave={endPress}
      onPointerCancel={endPress}
      disabled={disabled}
      aria-label={delta > 0 ? '增加' : '减少'}
      className={cn(
        'inline-flex items-center justify-center rounded-pill',
        'bg-bg-elevated border border-border-hairline',
        'active:scale-[0.94] active:bg-accent-honey/20',
        'disabled:opacity-45',
        'transition-[transform,background-color] duration-tap ease-out-quart',
        large ? 'h-14 w-14' : 'h-9 w-9'
      )}
    >
      {delta > 0 ? (
        <Plus className={large ? 'h-6 w-6' : 'h-4 w-4'} />
      ) : (
        <Minus className={large ? 'h-6 w-6' : 'h-4 w-4'} />
      )}
    </button>
  )

  return (
    <div
      className={cn(
        'inline-flex items-center gap-3 num-roll',
        className
      )}
    >
      {btn(-1)}
      <span
        className={cn(
          'font-num font-semibold text-ink-primary min-w-[2ch] text-center',
          large ? 'text-h1' : 'text-body'
        )}
        aria-live="polite"
      >
        {Math.round(display)}
      </span>
      {btn(1)}
    </div>
  )
}

