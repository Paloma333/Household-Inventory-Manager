'use client'

import * as React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle2, AlertCircle, X } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

/**
 * Toast — PRD §2.6 / §5
 *
 * 仅用于撤销提示（5s）和错误信息（手动关闭）；成功不弹 toast。
 * 还有一个底部 UndoBar（删除类操作专用）。
 *
 * 用全局 subscription 模型而不是每个调用方管理 state，避免组件树污染。
 */

type ToastTone = 'info' | 'success' | 'error'

interface ToastItem {
  id: string
  tone: ToastTone
  message: string
  durationMs: number
  action?: { label: string; onClick: () => void }
}

type Listener = (toasts: ToastItem[]) => void

class ToastStore {
  private items: ToastItem[] = []
  private listeners = new Set<Listener>()

  subscribe = (l: Listener) => {
    this.listeners.add(l)
    l(this.items)
    return () => this.listeners.delete(l)
  }

  private emit = () => {
    for (const l of this.listeners) l(this.items)
  }

  push = (t: Omit<ToastItem, 'id'>) => {
    const id = Math.random().toString(36).slice(2)
    const item: ToastItem = { id, ...t }
    this.items = [...this.items, item]
    this.emit()
    if (item.durationMs > 0) {
      setTimeout(() => this.dismiss(id), item.durationMs)
    }
    return id
  }

  dismiss = (id: string) => {
    this.items = this.items.filter((t) => t.id !== id)
    this.emit()
  }
}

export const toastStore = new ToastStore()

export const toast = {
  info: (message: string, opts?: { durationMs?: number }) =>
    toastStore.push({
      tone: 'info',
      message,
      durationMs: opts?.durationMs ?? 3000,
    }),
  success: (message: string) =>
    toastStore.push({ tone: 'success', message, durationMs: 0 }), // 成功不弹 toast — 默认 0，但有时会用迷你光晕替代
  error: (message: string) =>
    toastStore.push({ tone: 'error', message, durationMs: 0 }), // 错误持续到用户关闭
  undo: (message: string, action: () => void) =>
    toastStore.push({
      tone: 'info',
      message,
      durationMs: 5000,
      action: { label: '撤销', onClick: action },
    }),
}

export function ToastViewport() {
  const [items, setItems] = React.useState<ToastItem[]>([])

  React.useEffect(() => {
    const unsub = toastStore.subscribe(setItems)
    return () => {
      unsub()
    }
  }, [])

  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 pointer-events-none px-4 w-full max-w-md pb-safe">
      <AnimatePresence>
        {items.map((t) => (
          <motion.div
            key={t.id}
            initial={{ y: 16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 16, opacity: 0 }}
            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
            className={cn(
              'pointer-events-auto rounded-md px-4 py-3 flex items-center gap-3',
              'border',
              t.tone === 'error' && 'bg-accent-clay-soft border-accent-clay',
              t.tone === 'success' &&
                'bg-accent-sage-soft border-accent-sage',
              t.tone === 'info' && 'bg-bg-elevated border-border-hairline'
            )}
          >
            {t.tone === 'error' ? (
              <AlertCircle className="h-4 w-4 text-accent-clay shrink-0" />
            ) : t.tone === 'success' ? (
              <CheckCircle2 className="h-4 w-4 text-accent-sage shrink-0" />
            ) : null}
            <span className="text-small text-ink-primary flex-1">
              {t.message}
            </span>
            {t.action && (
              <button
                type="button"
                onClick={() => {
                  t.action!.onClick()
                  toastStore.dismiss(t.id)
                }}
                className="text-small font-semibold text-accent-sage"
              >
                {t.action.label}
              </button>
            )}
            {t.durationMs === 0 && (
              <button
                type="button"
                aria-label="关闭"
                onClick={() => toastStore.dismiss(t.id)}
                className="text-ink-secondary"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
