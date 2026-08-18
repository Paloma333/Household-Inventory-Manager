'use client'

import * as React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

/**
 * Sheet — PRD §2.7
 *
 * type: dialog | sheet | popup | fullscreen
 * behavior: esc | swipeDown | backdropClick
 *
 * sheet 从底部上推 280ms ease-out-expo
 * dialog 背景遮罩 200ms 淡入 + 居中缩放 0.94→1.0
 */

export type SheetType = 'sheet' | 'dialog' | 'popup' | 'fullscreen'

export interface SheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  type?: SheetType
  /** 标题（dialog 居中布局用） */
  title?: React.ReactNode
  /** 关闭按钮（顶部右上角） */
  showClose?: boolean
  /** 点击 backdrop 关闭 */
  backdropClose?: boolean
  /** ESC 关闭 */
  escClose?: boolean
  /** Sheet 顶部拖把 */
  dragHandle?: boolean
  className?: string
  children: React.ReactNode
}

export function Sheet({
  open,
  onOpenChange,
  type = 'sheet',
  title,
  showClose = true,
  backdropClose = true,
  escClose = true,
  dragHandle = false,
  className,
  children,
}: SheetProps) {
  React.useEffect(() => {
    if (!escClose || !open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [escClose, open, onOpenChange])

  React.useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          {/* backdrop */}
          <motion.div
            className="absolute inset-0 bg-bg-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => backdropClose && onOpenChange(false)}
            aria-hidden="true"
          />

          {/* panel */}
          <motion.div
            role="dialog"
            aria-modal="true"
            className={cn(
              'relative bg-bg-elevated shadow-none overflow-hidden',
              'flex flex-col max-h-[90vh]',
              type === 'sheet' &&
                'w-full rounded-t-lg sm:rounded-lg sm:max-w-md sm:mx-4',
              type === 'dialog' && 'w-[280px] max-w-[90vw] rounded-lg',
              type === 'fullscreen' && 'w-full h-full',
              type === 'popup' && 'rounded-md',
              className
            )}
            initial={
              type === 'sheet' || type === 'fullscreen'
                ? { y: '100%' }
                : { opacity: 0, scale: 0.94 }
            }
            animate={
              type === 'sheet' || type === 'fullscreen'
                ? { y: 0 }
                : { opacity: 1, scale: 1 }
            }
            exit={
              type === 'sheet' || type === 'fullscreen'
                ? { y: '100%' }
                : { opacity: 0, scale: 0.94 }
            }
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
          >
            {dragHandle && type === 'sheet' && (
              <div className="flex justify-center pt-2">
                <div className="h-1 w-8 rounded-pill bg-border-hairline" />
              </div>
            )}
            {(title || showClose) && (
              <div className="flex items-center justify-between px-5 pt-4">
                {title &&
                  (typeof title === 'string' ? (
                    <h2 className="text-h3 font-semibold text-ink-primary">
                      {title}
                    </h2>
                  ) : (
                    title
                  ))}
                {showClose && (
                  <button
                    type="button"
                    aria-label="关闭"
                    onClick={() => onOpenChange(false)}
                    className="ml-auto h-8 w-8 rounded-pill text-ink-secondary hover:bg-bg-surface flex items-center justify-center active:scale-95"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            )}
            <div className="flex-1 overflow-y-auto">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
