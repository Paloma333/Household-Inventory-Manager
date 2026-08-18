'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Btn } from '@/components/ui/Btn'
import { Input } from '@/components/ui/Input'
import { getBrowserSupabase } from '@/lib/supabase/client'

export default function SignupPage() {
  const router = useRouter()
  const search = useSearchParams()
  const next = search.get('next') || '/'
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const supabase = getBrowserSupabase()
      const { error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
        },
      })

      if (authError) {
        // Sprint 0 调试期：把真实 Supabase 错误展示出来，方便排查
        setError(`${authError.message || authError.name || '未知错误'}（status: ${authError.status ?? 'n/a'}）`)
        console.error('[signup] supabase error:', authError)
        return
      }

      // Supabase 默认邮箱验证；这版开发期把"自动建户"的逻辑同时放在前端 + 后端
      // await 后端 route 完成 user 镜像 + household 创建
      await fetch('/api/bootstrap/household', { method: 'POST' })

      router.push(next)
      router.refresh()
    } catch (err) {
      setError('出了点小问题，稍后再试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen flex flex-col px-6 py-10 bg-bg-canvas">
      <div className="max-w-sm w-full mx-auto flex-1 flex flex-col justify-center">
        <h1 className="font-semibold text-h1 text-ink-primary">
          带一份小家回来
        </h1>
        <p className="mt-2 text-body text-ink-secondary">
          先告我一个地址，我给你起一座
        </p>

        <form className="mt-8 flex flex-col gap-4" onSubmit={onSubmit}>
          <Input
            kind="text"
            label="邮箱"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            kind="text"
            label="密码"
            type="password"
            autoComplete="new-password"
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            helperText="至少 8 个字符"
            errorText={error || undefined}
          />
          <Btn
            type="submit"
            size="xl"
            loading={loading}
            block
          >
            开始照顾小家
          </Btn>
        </form>

        <p className="mt-6 text-small text-ink-secondary text-center">
          已经有了？{' '}
          <Link
            href={`/login${next ? `?next=${encodeURIComponent(next)}` : ''}`}
            className="text-accent-sage font-medium underline-offset-2 hover:underline"
          >
            回去坐坐
          </Link>
        </p>
      </div>
    </main>
  )
}
