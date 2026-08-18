'use client'

import * as React from 'react'
import { cn } from '@/lib/utils/cn'

/**
 * StickyNav — /design 顶部锚点导航
 *
 * - sticky top-0,滚动后一直显示
 * - 横向 chip;sm 以下可横向滚动
 * - 当前 section 用 bg-bg-canvas + 边框高亮(IntersectionObserver 跟踪)
 */

const links = [
  { id: 'colors', label: '色彩' },
  { id: 'typography', label: '字体' },
  { id: 'buttons', label: '按钮' },
  { id: 'inputs', label: '输入' },
  { id: 'cards', label: '卡片与状态' },
  { id: 'overlays', label: '浮层' },
  { id: 'tokens', label: 'Tokens' },
]

export function StickyNav() {
  const [active, setActive] = React.useState<string>(links[0].id)

  React.useEffect(() => {
    // 用 IntersectionObserver 跟踪当前在 viewport 里的 section
    const observer = new IntersectionObserver(
      (entries) => {
        // 取最靠上的可见 section
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort(
            (a, b) =>
              a.boundingClientRect.top - b.boundingClientRect.top
          )
        if (visible[0]) setActive(visible[0].target.id)
      },
      {
        // nav ~56px 高;加 1px buffer;底部 30% 算可见
        rootMargin: '-56px 0px -60% 0px',
        threshold: [0, 0.5, 1],
      }
    )

    links.forEach((l) => {
      const el = document.getElementById(l.id)
      if (el) observer.observe(el)
    })

    return () => observer.disconnect()
  }, [])

  return (
    <nav
      className="sticky top-0 z-20 bg-bg-canvas/80 backdrop-blur border-b border-border-hairline"
      aria-label="设计系统分组导航"
    >
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <ul
          className="flex items-center gap-1 h-12 overflow-x-auto -mx-2 px-2 sm:mx-0 sm:px-0 scrollbar-none"
          style={{ scrollbarWidth: 'none' }}
        >
          {links.map((l) => {
            const isActive = active === l.id
            return (
              <li key={l.id} className="shrink-0">
                <a
                  href={`#${l.id}`}
                  className={cn(
                    'inline-flex items-center h-9 px-3 rounded-pill text-small',
                    'transition-colors duration-tap',
                    isActive
                      ? 'bg-bg-elevated text-ink-primary font-medium border border-border-hairline'
                      : 'text-ink-secondary hover:text-ink-primary'
                  )}
                >
                  {l.label}
                </a>
              </li>
            )
          })}
        </ul>
      </div>
    </nav>
  )
}
