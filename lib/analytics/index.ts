'use client'

import * as React from 'react'
import { nanoid } from 'nanoid'

/**
 * 前端埋点 SDK — PRD v1.0 §12
 *
 * - 自动生成 session_id（首次访问存 localStorage）
 * - 用 navigator.sendBeacon 异步发送，避免阻塞主线程
 * - 失败 fallback 排队，下个事件触发时重试
 *
 * 用法：
 *   import { track } from '@/lib/analytics'
 *   track('item_created', { category: '食品饮料', source: 'manual' })
 */

interface AnalyticsContextValue {
  sessionId: string
  userId?: string
  householdId?: string
}

const SESSION_KEY = 'him.analytics.session_id'
const queue: Array<() => Promise<void>> = []

function getSessionId(): string {
  if (typeof window === 'undefined') return ''
  let id = sessionStorage.getItem(SESSION_KEY)
  if (!id) {
    id = nanoid(12)
    sessionStorage.setItem(SESSION_KEY, id)
  }
  return id
}

let _ctx: AnalyticsContextValue = { sessionId: '' }

export function configureAnalytics(ctx: { userId?: string; householdId?: string }) {
  _ctx = {
    sessionId: getSessionId(),
    userId: ctx.userId,
    householdId: ctx.householdId,
  }
}

async function flush(): Promise<void> {
  while (queue.length) {
    const task = queue.shift()
    if (!task) break
    try {
      await task()
    } catch {
      // swallow — analytics 失败不影响主流程
    }
  }
}

async function send(
  eventName: string,
  properties?: Record<string, unknown>
): Promise<void> {
  const payload = {
    event_name: eventName,
    properties: properties ?? {},
    session_id: _ctx.sessionId,
    user_id: _ctx.userId,
    household_id: _ctx.householdId,
    client_ts: new Date().toISOString(),
  }

  // 优先 sendBeacon（页面卸载时仍能发送）
  if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
    try {
      const blob = new Blob([JSON.stringify(payload)], {
        type: 'application/json',
      })
      const sent = navigator.sendBeacon('/api/analytics/log', blob)
      if (sent) return
    } catch {
      // 退到 fetch
    }
  }

  try {
    await fetch('/api/analytics/log', {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: { 'content-type': 'application/json' },
      keepalive: true,
    })
  } catch {
    // 静默失败 — 埋点不应当让用户看到失败
  }
}

export function track(
  eventName: string,
  properties?: Record<string, unknown>
): void {
  if (typeof window === 'undefined') return
  queue.push(() => send(eventName, properties))
  void flush()
}

/**
 * React Hook — 在 layout 顶层挂载后调用 configureAnalytics
 */
export function useAnalyticsContext(
  ctx: { userId?: string; householdId?: string }
) {
  React.useEffect(() => {
    configureAnalytics(ctx)
  }, [ctx.userId, ctx.householdId])
}

/**
 * PRD §12.1 标准化事件名 — 防止拼错
 */
export const Events = {
  AppOpen: 'app_open',
  AddStarted: 'add_started',
  RecognitionStarted: 'recognition_started',
  RecognitionCompleted: 'recognition_completed',
  RecognitionItemCorrected: 'recognition_item_corrected',
  ItemConfirmed: 'item_confirmed',
  ItemCreated: 'item_created',
  ItemAdjusted: 'item_adjusted',
  InventoryViewed: 'inventory_viewed',
  SearchUsed: 'search_used',
  RestockViewed: 'restock_viewed',
  ItemDeleted: 'item_deleted',
  DuplicateDetected: 'duplicate_detected',
  DuplicateConfirmed: 'duplicate_confirmed',
  // Sprint 3 — 补货清单 + 分享
  RestockSuggestionShown: 'restock_suggestion_shown',
  RestockListCreated: 'restock_list_created',
  RestockItemAdded: 'restock_item_added',
  RestockItemChecked: 'restock_item_checked',
  RestockItemRemoved: 'restock_item_removed',
  RestockListCompleted: 'restock_list_completed',
  ShareLinkGenerated: 'share_link_generated',
  ShareLinkCopied: 'share_link_copied',
  ShareLinkViewed: 'share_link_viewed',
} as const

export type EventName = (typeof Events)[keyof typeof Events]
