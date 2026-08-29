'use client'

import * as React from 'react'
import Link from 'next/link'
import { Btn } from '@/components/ui/Btn'
import { Input } from '@/components/ui/Input'
import { getBrowserSupabase } from '@/lib/supabase/client'

/**
 * 忘记密码 — 发送重置邮件
 * 不区分"邮箱是否存在"，避免泄露注册信息
 */
export default function ForgotPasswordPage() {
  const [email, setEmail] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [sent, setSent] = React.useState(false)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const supabase = getBrowserSupabase()
      const { error: authError } = await supabase.auth.resetPasswordForEmail(
        email,
        {
          redirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent('/reset-password')}`,
        }
      )

      if (authError) {
        console.error('[forgot-password] supabase error:', authError)
        if (authError.status === 429 || /rate limit/i.test(authError.message)) {
          setError('发得太频繁啦，过一会儿再试')
        } else {
          setError('出了点小问题，稍后再试')
        }
        return
      }

      setSent(true)
    } catch (err) {
      setError('出了点小问题，稍后再试')
    } finally {
      setLoading(false)
    }
  }

  // 邮件已发出
  if (sent) {
    return (
      <main className="min-h-screen flex flex-col px-6 py-10 bg-bg-canvas">
        <div className="max-w-sm w-full mx-auto flex-1 flex flex-col justify-center">
          <h1 className="font-semibold text-h1 text-ink-primary">
            钥匙已经寄到你邮箱啦
          </h1>
          <p className="mt-3 text-body text-ink-secondary leading-relaxed">
            点开邮件里的链接，设一个新密码就能回家了。
            <br />
            没收到的话，翻一翻垃圾邮件夹。
          </p>
          <Link
            href="/login"
            className="mt-8 block text-center text-small text-accent-sage font-medium underline-offset-2 hover:underline"
          >
            想起来了？直接回登录
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen flex flex-col px-6 py-10 bg-bg-canvas">
      <div className="max-w-sm w-full mx-auto flex-1 flex flex-col justify-center">
        <h1 className="font-semibold text-h1 text-ink-primary">
          忘记密码也没关系
        </h1>
        <p className="mt-2 text-body text-ink-secondary">
          告诉我你的邮箱，我给你寄一把新钥匙
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
            errorText={error || undefined}
          />
          <Btn type="submit" size="xl" loading={loading} block>
            寄一封重置邮件
          </Btn>
        </form>

        <p className="mt-6 text-small text-ink-secondary text-center">
          想起来了？{' '}
          <Link
            href="/login"
            className="text-accent-sage font-medium underline-offset-2 hover:underline"
          >
            直接回家
          </Link>
        </p>
      </div>
    </main>
  )
}
