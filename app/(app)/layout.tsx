'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Boxes, Plus, ClipboardList, Settings } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

/**
 * 主应用 layout（受保护路由组）
 * 顶部细边线；底部 4 tab 导航 + 中间 FAB
 * PRD v1.1 §0 不要营销式 Hero；底部 tab 朴素、稳定
 */

export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1 pb-24">{children}</main>
      <BottomNav />
    </div>
  )
}

function BottomNav() {
  const pathname = usePathname()

  const tabs = [
    { href: '/', label: '小屋', icon: Home },
    { href: '/inventory', label: '库存', icon: Boxes },
    { href: '/restock', label: '补货', icon: ClipboardList },
    { href: '/settings', label: '我的', icon: Settings },
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 bg-bg-elevated border-t border-border-hairline pb-safe">
      <ul className="grid grid-cols-5 items-end max-w-md mx-auto">
        {tabs.slice(0, 2).map((t) => (
          <NavItem key={t.href} {...t} active={pathname === t.href} />
        ))}

        {/* 中央 FAB 占位 */}
        <li className="flex items-end justify-center pb-2">
          <Link
            href="/add"
            aria-label="添点东西"
            className="inline-flex items-center justify-center h-14 w-14 rounded-pill bg-accent-sage text-white shadow-[0_4px_0_0_var(--shadow-teal-3d)] hover:-translate-y-0.5 hover:shadow-[0_5px_0_0_var(--shadow-teal-3d)] active:translate-y-0.5 active:shadow-[0_1px_0_0_var(--shadow-teal-3d)] transition-[transform,box-shadow] duration-tap ease-out-quart"
          >
            <Plus className="h-6 w-6" strokeWidth={2.2} />
          </Link>
        </li>

        {tabs.slice(2).map((t) => (
          <NavItem key={t.href} {...t} active={pathname === t.href} />
        ))}
      </ul>
    </nav>
  )
}

function NavItem({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string; strokeWidth?: string | number }>
  active: boolean
}) {
  return (
    <li>
      <Link
        href={href}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'flex flex-col items-center justify-center h-16 gap-0.5 text-micro transition-colors duration-tap',
          active ? 'text-accent-sage' : 'text-ink-secondary'
        )}
      >
        <Icon className="h-5 w-5" strokeWidth={active ? 2.2 : 1.6} />
        <span>{label}</span>
      </Link>
    </li>
  )
}
