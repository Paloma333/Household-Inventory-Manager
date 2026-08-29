'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Btn } from '@/components/ui/Btn'
import { Input } from '@/components/ui/Input'
import { getBrowserSupabase } from '@/lib/supabase/client'
import { toast } from '@/components/ui/Toast'

/**
 * 重置密码 — 从邮件里的链接点进来（/auth/callback 换取 session 后跳转）
 * 必须已持有 session（恢复链接自动登录），否则回忘记密码页
 */
export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = React.useState('')
  const [confirm, setConfirm] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [checked, setChecked] = React.useState(false)

  // 确保有 session（点了邮件恢复链接才会带 session 进来）
  React.useEffect(() => {
    ;(async () => {
      const supabase = getBrowserSupabase()
      const { data } = await supabase.auth.getUser()
      if (!data.user) {
        router.replace('/forgot-password')
        return
      }
      setChecked(true)
    })()
  }, [router])

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password !== confirm) {
      setError('两次输入的密码不一样')
      return
    }

    setLoading(true)
    try {
      const supabase = getBrowserSupabase()
      const { error: authError } = await supabase.auth.updateUser({ password })

      if (authError) {
        console.error('[reset-password] supabase error:', authError)
        if (authError.code === 'same_password' || /same password/i.test(authError.message)) {
          setError('新密码不能和旧密码一样')
        } else if (authError.code === 'weak_password' || /at least/i.test(authError.message)) {
          setError('密码太简单了，至少 8 个字符')
        } else {
          setError('出了点小问题，稍后再试')
        }
        return
      }

      toast.success('新钥匙配好啦，欢迎回家')
      router.push('/')
      router.refresh()
    } catch (err) {
      setError('出了点小问题，稍后再试')
    } finally {
      setLoading(false)
    }
  }

  if (!checked) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-bg-canvas">
        <p className="text-body text-ink-secondary">正在开信箱…</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen flex flex-col px-6 py-10 bg-bg-canvas">
      <div className="max-w-sm w-full mx-auto flex-1 flex flex-col justify-center">
        <h1 className="font-semibold text-h1 text-ink-primary">
          给小屋换一把新钥匙
        </h1>
        <p className="mt-2 text-body text-ink-secondary">
          设好新密码，以后别忘了它哦
        </p>

        <form className="mt-8 flex flex-col gap-4" onSubmit={onSubmit}>
          <Input
            kind="text"
            label="新密码"
            type="password"
            autoComplete="new-password"
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            helperText="至少 8 个字符"
          />
          <Input
            kind="text"
            label="再输一次"
            type="password"
            autoComplete="new-password"
            minLength={8}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            errorText={error || undefined}
          />
          <Btn type="submit" size="xl" loading={loading} block>
            换好钥匙，回家
          </Btn>
        </form>
      </div>
    </main>
  )
}
