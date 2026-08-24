import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

/**
 * /api/dashboard — 首页数据（Sprint 1）
 *
 * 返回：
 *   householdName
 *   itemCount                     — 当前 household 全部未删 item
 *   lowStockCount                 — 勾了「快用完时提醒我」且 quantity ≤ threshold 的数量（opt-in）
 *   expiringSoonCount             — 7 天内过期的商品数
 *   recentEvents                  — 最近 3 条 inventory_events，附带 item 名字
 *   categoryCounts                — 每个分类下的 item 数量，首页 chip 用
 *
 * 跑得稍微多查询，但每天打开一次，无所谓
 */

export async function GET() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { data: household } = await supabase
    .from('households')
    .select('household_id, name')
    .eq('owner_id', user.id)
    .limit(1)
    .maybeSingle()

  if (!household) {
    return NextResponse.json({
      householdName: '尚未建家',
      itemCount: 0,
      lowStockCount: 0,
      expiringSoonCount: 0,
      recentEvents: [],
      categoryCounts: [],
    })
  }

  const today = new Date()
  const sevenDaysLater = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)
  const todayStr = today.toISOString().slice(0, 10)
  const sevenDaysLaterStr = sevenDaysLater.toISOString().slice(0, 10)

  // 并发跑
  const [
    itemsCountRes,
    expiringRes,
    recentEventsRes,
    categoryCountsRes,
    lowStockRes,
  ] = await Promise.all([
    supabase
      .from('items')
      .select('*', { count: 'exact', head: true })
      .eq('household_id', household.household_id)
      .is('deleted_at', null),
    supabase
      .from('items')
      .select('*', { count: 'exact', head: true })
      .eq('household_id', household.household_id)
      .is('deleted_at', null)
      .gte('expiry_date', todayStr)
      .lte('expiry_date', sevenDaysLaterStr),
    supabase
      .from('inventory_events')
      .select(
        `
        event_id, event_type, quantity_change, previous_quantity, new_quantity, created_at, item_id,
        items:item_id ( canonical_name )
      `
      )
      .eq('household_id', household.household_id)
      .order('created_at', { ascending: false })
      .limit(3),
    supabase
      .from('items')
      .select('category_id, categories:category_id ( name )')
      .eq('household_id', household.household_id)
      .is('deleted_at', null)
      .not('category_id', 'is', null),
    // 低库存 = 勾了「快用完时提醒我」（enabled 规则）且 quantity ≤ threshold
    // （quantity 与 threshold 是两列比较，拿回来 JS 里算）
    supabase
      .from('items')
      .select('quantity, low_stock_rules ( threshold, enabled )')
      .eq('household_id', household.household_id)
      .is('deleted_at', null)
      .gt('quantity', 0),
  ])

  // 分类聚合
  const catMap = new Map<string, { category_id: string; name: string; count: number }>()
  ;(categoryCountsRes.data ?? []).forEach((row: any) => {
    const cid = row.category_id
    const name = row.categories?.name ?? '未分类'
    if (!catMap.has(cid)) catMap.set(cid, { category_id: cid, name, count: 0 })
    catMap.get(cid)!.count++
  })
  const categoryCounts = Array.from(catMap.values()).sort((a, b) => b.count - a.count)

  const recentEvents = (recentEventsRes.data ?? []).map((e: any) => ({
    event_id: e.event_id,
    event_type: e.event_type,
    quantity_change: e.quantity_change,
    new_quantity: e.new_quantity,
    created_at: e.created_at,
    item_name: e.items?.canonical_name ?? '已删除',
  }))

  // 低库存计数：只统计勾了「快用完时提醒我」且 quantity ≤ threshold 的
  const lowStockCount = (lowStockRes.data ?? []).filter((row: any) => {
    const rule = Array.isArray(row.low_stock_rules)
      ? row.low_stock_rules[0]
      : row.low_stock_rules
    return rule?.enabled && Number(row.quantity) <= Number(rule.threshold)
  }).length

  return NextResponse.json({
    householdName: household.name,
    itemCount: itemsCountRes.count ?? 0,
    lowStockCount,
    expiringSoonCount: expiringRes.count ?? 0,
    recentEvents,
    categoryCounts,
  })
}
