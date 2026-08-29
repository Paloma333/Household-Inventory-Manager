'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Btn } from '@/components/ui/Btn'
import { Input } from '@/components/ui/Input'
import { getBrowserSupabase } from '@/lib/supabase/client'
import { toast } from '@/components/ui/Toast'

export default function LoginPage() {
  return (
    <React.Suspense fallback={null}>
      <LoginForm />
    </React.Suspense>
  )
}

function LoginForm() {
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
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (authError) {
        // 详细错误只打在 console 便于排查，界面统一显示通用文案
        console.error('[login] supabase error:', authError)
        setError('出了点小问题，稍后再试')
        return
      }

      router.push(next)
      router.refresh()
    } catch (err) {
      setError('出了点小问题，稍后再试')
      toast.error('出了点小问题，稍后再试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen flex flex-col px-6 py-10 bg-bg-canvas">
      <div className="max-w-sm w-full mx-auto flex-1 flex flex-col justify-center">
        <h1 className="font-semibold text-h1 text-ink-primary">爱是宜居的家，欢迎回来。</h1>
        <p className="mt-2 text-body text-ink-secondary">
          你的小屋一直在等你
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
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            errorText={error || undefined}
          />
          <Btn
            type="submit"
            size="xl"
            loading={loading}
            block
          >
            进小家
          </Btn>
        </form>

        <p className="mt-6 text-small text-ink-secondary text-center">
          还没账号？{' '}
          <Link
            href={`/signup${next ? `?next=${encodeURIComponent(next)}` : ''}`}
            className="text-accent-sage font-medium underline-offset-2 hover:underline"
          >
            建立一个你的小屋
          </Link>
        </p>

        <p className="mt-5 text-center">
          <Link
            href="/landing"
            className="text-micro text-ink-tertiary underline-offset-2 hover:underline"
          >
            了解小屋
          </Link>
        </p>
      </div>
    </main>
  )
}
