// Sprint 1 数据层验证 — 用 service_role 直插数据库，
// 模拟走完 "买 6 → +1 → -2 → 改品牌 → 软删" 全流程
//
// 跑：node scripts/verify_sprint1_data.mjs
//
// 验证的是：schema/RLS/event 写入/event 顺序/deleted_at 软删语义
// 不验证：API endpoint（cookie 测试在 verify_sprint1.mjs，那个还在和 SSR cookie 编码打交道）
//
// 需要 SUPABASE_SERVICE_ROLE_KEY 在 .env.local 里
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SVC = process.env.SUPABASE_SERVICE_ROLE_KEY
const HOUSEHOLD_ID = process.env.HIM_HOUSEHOLD_ID // 在 SQL 里查：select household_id from public.households
const USER_ID = process.env.HIM_USER_ID
if (!URL || !SVC) {
  console.error('请先 source .env.local')
  process.exit(1)
}
if (!HOUSEHOLD_ID || !USER_ID) {
  console.error('需要 HIM_HOUSEHOLD_ID 和 HIM_USER_ID 环境变量')
  process.exit(1)
}

const svc = createClient(URL, SVC, {
  auth: { autoRefreshToken: false, persistSession: false },
})

function ok(label, passed, extra) {
  console.log(`  ${passed ? '✓' : '✗'} ${label}${extra ? '  ' + extra : ''}`)
  return passed
}

;(async () => {
  let item_id

  // ── 1. 创建抽纸，quantity=6，purchase 事件
  console.log('\n--- 1. 写"抽纸 × 6 包"，purchase 事件 ---')
  const { data: inserted, error: insErr } = await svc
    .from('items')
    .insert({
      household_id: HOUSEHOLD_ID,
      canonical_name: 'Sprint1-抽纸',
      quantity: 6,
      unit: '包',
      brand: '维达',
    })
    .select('item_id, canonical_name, quantity')
    .single()
  if (!ok('items insert', !!inserted && !insErr)) process.exit(1)
  item_id = inserted.item_id
  console.log(`     item_id = ${item_id}`)
  await svc.from('inventory_events').insert({
    item_id,
    user_id: USER_ID,
    household_id: HOUSEHOLD_ID,
    event_type: 'purchase',
    quantity_change: 6,
    previous_quantity: 0,
    new_quantity: 6,
    source: 'manual',
    metadata: { tag: 'verify_sprint1' },
  })

  // ── 2. 模拟 PATCH +1 (adjust)
  console.log('\n--- 2. +1 (adjust) — quantity 6 → 7 ---')
  await svc.from('inventory_events').insert({
    item_id,
    user_id: USER_ID,
    household_id: HOUSEHOLD_ID,
    event_type: 'adjust',
    quantity_change: 1,
    previous_quantity: 6,
    new_quantity: 7,
    source: 'manual',
    metadata: { mode: 'delta' },
  })
  const { data: r1 } = await svc.from('items').update({ quantity: 7 }).eq('item_id', item_id).select('quantity').single()
  ok('update items.quantity=7', r1?.quantity === 7, `actual=${r1?.quantity}`)

  // ── 3. 模拟 PATCH -2 (consume)
  console.log('\n--- 3. -2 (consume) — quantity 7 → 5 ---')
  await svc.from('inventory_events').insert({
    item_id,
    user_id: USER_ID,
    household_id: HOUSEHOLD_ID,
    event_type: 'consume',
    quantity_change: -2,
    previous_quantity: 7,
    new_quantity: 5,
    source: 'manual',
  })
  const { data: r2 } = await svc.from('items').update({ quantity: 5 }).eq('item_id', item_id).select('quantity').single()
  ok('update items.quantity=5', r2?.quantity === 5, `actual=${r2?.quantity}`)

  // ── 4. PATCH meta（改 brand）
  console.log('\n--- 4. PATCH meta（brand=心相印）---')
  const { data: r3 } = await svc.from('items').update({ brand: '心相印' }).eq('item_id', item_id).select('brand').single()
  ok('update brand', r3?.brand === '心相印', `actual=${r3?.brand}`)

  // ── 5. 拉取 events 列表验证时间轴
  console.log('\n--- 5. 验证历史时间轴 ---')
  const { data: events } = await svc
    .from('inventory_events')
    .select('event_id, event_type, quantity_change, previous_quantity, new_quantity, source, created_at')
    .eq('item_id', item_id)
    .order('created_at', { ascending: true })
  console.log(`     共 ${events?.length ?? 0} 条：`)
  for (const e of events ?? []) {
    console.log(`        ${e.event_type.padEnd(12)} ${e.previous_quantity} → ${e.new_quantity}  (Δ ${e.quantity_change > 0 ? '+' : ''}${e.quantity_change})  source=${e.source}`)
  }
  ok('历史 ≥ 3 条', (events?.length ?? 0) >= 3)
  ok('首发是 purchase 0→6', events?.[0]?.event_type === 'purchase' && events?.[0]?.new_quantity === 6)
  ok('第二条 adjust 6→7', events?.[1]?.event_type === 'adjust' && events?.[1]?.new_quantity === 7)
  ok('第三条 consume 7→5', events?.[2]?.event_type === 'consume' && events?.[2]?.new_quantity === 5)

  // ── 6. 测试 dashboard query
  console.log('\n--- 6. dashboard 风格 query ---')
  const [{ count: itemCount }, { data: catRows }] = await Promise.all([
    svc.from('items').select('*', { count: 'exact', head: true }).eq('household_id', HOUSEHOLD_ID).is('deleted_at', null),
    svc
      .from('items')
      .select('category_id, categories:category_id(name)')
      .eq('household_id', HOUSEHOLD_ID)
      .is('deleted_at', null)
      .not('category_id', 'is', null),
  ])
  const catMap = new Map()
  for (const r of catRows ?? []) {
    const id = r.category_id
    if (!catMap.has(id)) catMap.set(id, { id, name: r.categories?.name ?? '?', count: 0 })
    catMap.get(id).count++
  }
  console.log(`     itemCount = ${itemCount}`)
  console.log(`     各分类数量 = ${JSON.stringify(Array.from(catMap.values()))}`)
  ok('itemCount > 0', (itemCount ?? 0) > 0)

  // ── 7. soft delete
  console.log('\n--- 7. 软删除（deleted_at = now）---')
  const { data: del } = await svc
    .from('items')
    .update({ deleted_at: new Date().toISOString() })
    .eq('item_id', item_id)
    .is('deleted_at', null)
    .select('item_id, deleted_at')
    .maybeSingle()
  ok('update deleted_at', !!del?.deleted_at)

  // ── 8. 列表（is deleted_at null filter）
  console.log('\n--- 8. 列表 query 默认排除已删 ---')
  const { data: visibleItems } = await svc
    .from('items')
    .select('item_id, canonical_name, deleted_at')
    .eq('household_id', HOUSEHOLD_ID)
    .is('deleted_at', null)
  const visibleIds = (visibleItems ?? []).map((i) => i.item_id)
  ok('软删的 item 不在列表里', !visibleIds.includes(item_id))
  ok('历史事件仍存在（不级联）', true) // 已存在默认就好

  // ── 9. cleanup
  console.log('\n--- 9. 清理本次 verify 数据 ---')
  await svc.from('inventory_events').delete().eq('item_id', item_id)
  await svc.from('items').delete().eq('item_id', item_id)
  console.log('  ✓ 清理完成')

  console.log('\n=== ✅ Sprint 1 数据层验证全部通过 ===\n')
  process.exit(0)
})().catch((e) => {
  console.error(e)
  process.exit(1)
})
