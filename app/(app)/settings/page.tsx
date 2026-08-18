'use client'

import * as React from 'react'
import { LogOut } from 'lucide-react'
import { Btn } from '@/components/ui/Btn'
import { Card } from '@/components/ui/Card'
import { getBrowserSupabase } from '@/lib/supabase/client'

export default function SettingsPage() {
  const [email, setEmail] = React.useState<string | null>(null)

  React.useEffect(() => {
    const supabase = getBrowserSupabase()
    supabase.auth.getUser().then(({ data }: { data: { user: { email?: string } | null } }) => {
      setEmail(data.user?.email ?? null)
    })
  }, [])

  const onSignOut = async () => {
    const supabase = getBrowserSupabase()
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  return (
    <div className="px-6 pt-10 pb-6">
      <header>
        <h1 className="font-semibold text-h1 text-ink-primary">我的</h1>
        <p className="mt-2 text-body text-ink-secondary">
          已使用 0 天 · 家里还在等第一件东西
        </p>
      </header>

      <section className="mt-8">
        <Card className="p-4">
          <p className="text-small text-ink-secondary">登录账号</p>
          <p className="mt-1 text-body font-medium">{email ?? '加载中…'}</p>
        </Card>
      </section>

      <section className="mt-6">
        <h2 className="text-h3 font-semibold mb-3">小家</h2>
        <Card className="p-4 flex items-center justify-between">
          <span className="text-body">小家名称</span>
          <span className="text-ink-secondary">我的小家</span>
        </Card>
      </section>

      <section className="mt-6">
        <h2 className="text-h3 font-semibold mb-3">数据</h2>
        <ul className="flex flex-col gap-2">
          <Card className="p-4 text-body">草稿（0）</Card>
          <Card className="p-4 text-body">回收站（30 天内可恢复）</Card>
          <Card className="p-4 text-body">导出我的库存（CSV / JSON）</Card>
        </ul>
      </section>

      <section className="mt-10">
        <Btn
          variant="subtle"
          block
          iconLeading={<LogOut className="h-4 w-4" />}
          onClick={onSignOut}
        >
          先出去一下
        </Btn>
      </section>
    </div>
  )
}
