'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Send } from 'lucide-react'
import { Btn } from '@/components/ui/Btn'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { toast } from '@/components/ui/Toast'

/**
 * /feedback — 反馈（PRD §3.8 · 关于与反馈）
 */

export default function FeedbackPage() {
  const router = useRouter()
  const [content, setContent] = React.useState('')
  const [contact, setContact] = React.useState('')
  const [submitting, setSubmitting] = React.useState(false)

  async function onSubmit() {
    if (!content.trim()) {
      toast.error('说点什么吧')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ content: content.trim(), contact: contact.trim() || null }),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) throw new Error(json.error || '提交失败')
      toast.info('收到啦，谢谢反馈')
      router.push('/settings')
      router.refresh()
    } catch (e: any) {
      toast.error(e?.message ?? '提交失败')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="px-6 pt-8 pb-32">
      <Link
        href="/settings"
        className="inline-flex items-center gap-1 text-small text-ink-secondary mb-4"
      >
        <ArrowLeft className="h-4 w-4" /> 我的
      </Link>
      <h1 className="font-semibold text-h1 text-ink-primary">反馈</h1>
      <p className="mt-2 text-body text-ink-secondary">
        用着不顺心、想要什么功能，或者单纯想聊聊，都可以说
      </p>

      <section className="mt-8 flex flex-col gap-4">
        <Card className="p-4">
          <label className="text-small text-ink-secondary">想说的话</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="例如：拍小票的时候，A4 纸那么大的单子识别不全……"
            rows={5}
            maxLength={2000}
            className="mt-2 w-full rounded-md border border-border-hairline bg-bg-canvas px-3 py-2.5 text-body text-ink-primary placeholder:text-ink-tertiary focus:outline-none focus:ring-2 focus:ring-accent-sage/40"
          />
          <p className="mt-1 text-right text-micro text-ink-tertiary">
            {content.length}/2000
          </p>
        </Card>
        <Input
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          label="联系方式（选填）"
          placeholder="邮箱 / 微信，方便回复你"
          maxLength={100}
        />
        <Btn
          size="xl"
          block
          loading={submitting}
          disabled={!content.trim()}
          onClick={onSubmit}
          iconLeading={<Send className="h-5 w-5" />}
        >
          发送
        </Btn>
      </section>
    </div>
  )
}
