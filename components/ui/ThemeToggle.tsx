'use client'

import * as React from 'react'
import { Sun, Moon } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

/**
 * ThemeToggle — 切换 light/dark
 *
 * - 持久化到 localStorage('him-theme' = 'light' | 'dark')
 * - 默认 'light'(沿用 :root 默认 token)
 * - SSR safe:mount 前先读 window;初次 render 用 'light' 兜底避免 hydration mismatch
 * - 配合根 layout 的 inline script 不会闪屏
 *
 * 用法:<ThemeToggle /> 或带 onChange 的受控用
 */

const STORAGE_KEY = 'him-theme'
type Theme = 'light' | 'dark'

export interface ThemeToggleProps {
  className?: string
}

function readInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'light'
  const stored = window.localStorage.getItem(STORAGE_KEY)
  if (stored === 'dark' || stored === 'light') return stored
  return 'light'
}

function applyTheme(theme: Theme) {
  const root = document.documentElement
  if (theme === 'dark') {
    root.setAttribute('data-theme', 'dark')
    root.classList.add('dark')
  } else {
    root.removeAttribute('data-theme')
    root.classList.remove('dark')
  }
}

export function ThemeToggle({ className }: ThemeToggleProps) {
  const [theme, setTheme] = React.useState<Theme>('light')
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    const initial = readInitialTheme()
    setTheme(initial)
    applyTheme(initial)
    setMounted(true)
  }, [])

  const toggle = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    applyTheme(next)
    try {
      window.localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // 隐私模式或 storage 不可用 — 静默忽略
    }
  }

  // mount 前用 light 图标,避免 hydration 警告
  const isDark = mounted && theme === 'dark'

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? '切换到浅色模式' : '切换到深色模式'}
      aria-pressed={isDark}
      title={isDark ? '切换到浅色' : '切换到深色'}
      className={cn(
        'inline-flex items-center justify-center h-9 w-9 rounded-pill',
        'bg-bg-elevated border-2 border-border-outline text-ink-secondary',
        'shadow-[0_2px_4px_0_rgba(61,52,40,0.06)]',
        'hover:-translate-y-px hover:text-ink-primary hover:border-nook-yellow',
        'active:translate-y-0.5 active:shadow-none',
        'transition-[transform,box-shadow,color,border-color] duration-tap ease-out-quart',
        className
      )}
    >
      {isDark ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
    </button>
  )
}
