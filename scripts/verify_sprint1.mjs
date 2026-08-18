// Sprint 1 端到端 — 用 supabase-js 真正模拟浏览器 cookie
// 跑：node scripts/verify_sprint1.mjs
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'

const BASE = process.env.HIM_BASE || 'http://localhost:3000'
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const EMAIL = process.env.HIM_TEST_EMAIL || `sprint1-verify-${Date.now()}@him.local`
const PASSWORD = process.env.HIM_TEST_PASSWORD || 'TestPass#2026'

if (!URL || !ANON) {
  console.error('请先 source .env.local')
  process.exit(1)
}

let cookieJar = ''
function setCookiesFrom(res) {
  const raw = res.headers.getSetCookie?.() ?? []
  cookieJar = raw
    .map((c) => c.split(';')[0])
    .filter(Boolean)
    .join('; ')
}
function getCookieHeader() {
  return cookieJar

}

async function callApp(path, { method = 'GET', body, redirect = 'manual' } = {}) {
  const headers = { 'Content-Type': 'application/json' }
  if (cookieJar) headers['Cookie'] = cookieJar
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    redirect,
  })
  // 收集新的 cookies
  setCookiesFrom(res)
  let json = null
  try {
    json = await res.json()
  } catch {}
  return { status: res.status, body: json }
}

function step(s) {
  console.log(`\n--- ${s} ---`)
}
function ok(label, status, body, expect = 200) {
  const passed = status === expect && !(body && body.error)
  console.log(`  ${passed ? '✓' : '✗'} ${label} [${status}] ${JSON.stringify(body).slice(0, 200)}`)
  return passed
}

;(async () => {
  step('0. 用 supabase-js 注册 / 登录')
  const auth = createClient(URL, ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  let { data: sign, error: signErr } = await auth.auth.signUp({
    email: EMAIL,
    password: PASSWORD,
  })
  if (signErr?.message?.includes('already')) {
    // 已注册，去登录
    const { data: si } = await auth.auth.signInWithPassword({
      email: EMAIL,
      password: PASSWORD,
    })
    sign = si
  }
  if (!sign?.session) {
    console.error('注册/登录失败：', sign, signErr)
    process.exit(1)
  }
  console.log(`  ✓ user_id = ${sign.user.id}`)

  // 构造 supabase-js 的 cookie 形态
  step('0.5 构造 cookie')
  const session = sign.session
  const blob = {
    access_token: session.access_token,
    token_type: 'bearer',
    expires_in: session.expires_in,
    expires_at: session.expires_at,
    refresh_token: session.refresh_token,
    user: sign.user,
  }
  const ref = URL.split('//')[1].split('.')[0]
  // 复刻 @supabase/ssr storageKey 编码：base64url(json(blob))
  const b64 = Buffer.from(JSON.stringify(blob))
    .toString('base64')
    .replace(/=+$/, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
  cookieJar = `sb-${ref}-auth-token=${b64}`
  console.log(`  ✓ cookie 已设 (${cookieJar.length} chars)`)

  step('bootstrap /api/bootstrap/household')
  let r = await callApp('/api/bootstrap/household', { method: 'POST', body: {} })
  console.log(`  → ${r.status} ${JSON.stringify(r.body).slice(0, 200)}`)

  step('1. POST /api/items (抽纸, 6 包)')
  r = await callApp('/api/items', {
    method: 'POST',
    body: { canonical_name: '抽纸', quantity: 6, unit: '包', brand: '维达' },
  })
  if (!ok('创建抽纸', r.status, r.body)) process.exit(1)
  const item1 = r.body.item.item_id
  console.log(`     item_id = ${item1}`)

  step('2. POST /api/items (牙膏, 1 支)')
  r = await callApp('/api/items', {
    method: 'POST',
    body: { canonical_name: '牙膏', quantity: 1, unit: '支' },
  })
  if (!ok('创建牙膏', r.status, r.body)) process.exit(1)
  const item2 = r.body.item.item_id

  step('3. GET /api/items')
  r = await callApp('/api/items')
  if (!ok('列表', r.status, r.body)) process.exit(1)
  console.log(`     共 ${r.body.items.length} 条`)
  if (!r.body.items.find((i) => i.item_id === item1)) {
    console.error('   抽纸不在列表')
    process.exit(1)
  }

  step('4. GET /api/categories')
  r = await callApp('/api/categories')
  if (!ok('分类', r.status, r.body)) process.exit(1)
  console.log(`     顶层分类 ${r.body.categories.length} 个`)

  step('5. PATCH /api/items/[id] +1 (adjust)')
  r = await callApp(`/api/items/${item1}`, {
    method: 'PATCH',
    body: { delta: 1 },
  })
  if (!ok('+1', r.status, r.body)) process.exit(1)
  if (r.body.quantity !== 7) {
    console.error(' 期望 7，实际', r.body.quantity)
    process.exit(1)
  }

  step('6. PATCH /api/items/[id] -2 (consume)')
  r = await callApp(`/api/items/${item1}`, {
    method: 'PATCH',
    body: { delta: -2, event_type: 'consume' },
  })
  if (!ok('-2', r.status, r.body)) process.exit(1)
  if (r.body.quantity !== 5) {
    console.error(' 期望 5，实际', r.body.quantity)
    process.exit(1)
  }

  step('7. GET /api/items/[id]/events')
  r = await callApp(`/api/items/${item1}/events`)
  if (!ok('events', r.status, r.body)) process.exit(1)
  console.log(`     共 ${r.body.events.length} 条历史`)
  for (const e of r.body.events) {
    console.log(
      `        ${e.event_type.padEnd(18)} ${e.previous_quantity} → ${e.new_quantity}  (Δ ${e.quantity_change > 0 ? '+' : ''}${e.quantity_change})`,
    )
  }

  step('8. GET /api/dashboard')
  r = await callApp('/api/dashboard')
  if (!ok('dashboard', r.status, r.body)) process.exit(1)
  console.log(`     itemCount=${r.body.itemCount}, lowStock=${r.body.lowStockCount}`)
  console.log(`     recentEvents=${r.body.recentEvents.length} 条`)

  step('9. PATCH /api/items/[id]/meta')
  r = await callApp(`/api/items/${item1}/meta`, {
    method: 'PATCH',
    body: { brand: '心相印' },
  })
  if (!ok('meta', r.status, r.body)) process.exit(1)

  step('10. DELETE /api/items/[id]')
  r = await callApp(`/api/items/${item1}`, { method: 'DELETE' })
  if (!ok('delete', r.status, r.body)) process.exit(1)

  step('11. 列表里确认已软删')
  r = await callApp('/api/items')
  if (!ok('list', r.status, r.body)) process.exit(1)
  if (r.body.items.find((i) => i.item_id === item1)) {
    console.error('抽纸仍在列表')
    process.exit(1)
  }
  if (!r.body.items.find((i) => i.item_id === item2)) {
    console.error('牙膏不应被删')
    process.exit(1)
  }
  console.log('  ✓ 抽纸已软删，牙膏还在')

  console.log('\n=== ✅ Sprint 1 端到端全部通过 ===\n')
  process.exit(0)
})().catch((e) => {
  console.error(e)
  process.exit(1)
})
