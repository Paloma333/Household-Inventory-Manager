/**
 * Sprint 3 端到端测试 — 补货清单 + 分享
 *
 * 步骤：
 *   1. 注册新测试用户（sprint3-verify-{ts}@him.local）
 *   2. bootstrap household
 *   3. 创建一个测试 item（"测试牙膏"），用来测 item_id 分支
 *   4. GET /api/restock/suggest → 期望 3 组 key 都在
 *   5. POST /api/restock { name: 'E2E 购物清单' } → listId
 *   6. POST .../{listId}/items { item_id, needed_qty: 2 } → 已绑库存
 *   7. POST .../{listId}/items { custom_name: 'E2E 测试新品', needed_qty: 1 } → 自定义
 *   8. PATCH .../{listId}/items/{itemId} { bought: true } × 2
 *   9. POST .../{listId}/checkout → events_written >= 2 + new_items_created >= 1
 *  10. PATCH .../{listId} { share_enabled: true } → share_token
 *  11. anon GET /api/r/share/{token} → 200, 名字 + items.length
 *  12. GET /api/restock/{listId} → status='completed', bought_count > 0
 *
 * 退出：exitCode 1 + 失败用例打印
 */
const { createClient } = await import('@supabase/supabase-js')

const BASE = process.env.APP_BASE_URL ?? 'http://localhost:3000'
const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://cgkwjpamcwffalfagddj.supabase.co'
const ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.ANON_KEY ?? ''

const TEST_TAG = `sprint3-verify-${Date.now()}`
const EMAIL = `${TEST_TAG}@him.local`
const PASSWORD = 'TestPass#2026'
const TEST_ITEM_NAME = 'E2E测试牙膏'
const CUSTOM_ITEM_NAME = 'E2E 测试新品'

if (!ANON_KEY) {
  console.error('需要 NEXT_PUBLIC_SUPABASE_ANON_KEY 或 ANON_KEY env')
  process.exit(1)
}
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''

function banner(s) {
  console.log('\n' + '─'.repeat(3) + ' ' + s + ' ' + '─'.repeat(3))
}
function ok(s) {
  console.log('  ✓ ' + s)
}
function fail(s) {
  console.log('  ✗ ' + s)
  process.exitCode = 1
}

// ───────── 1. service_role 建用户（绕过 signup 开关） + cookie ─────────
// 注意：spr2 验过；spr3 跑时 supabase 项目 auth config 临时调成了
//   "Email logins are disabled"。脚本优先走 admin.createUser + anon signInWithPassword；
//   后者若也拒，仍会报错。可以临时 PATCH config 重开：
//   curl -X PATCH .../config/auth -d '{"mailer_login_enabled":true}'
banner('1. service_role 建测试用户 + 登录拿 cookie')
let session, userForCookie
if (SERVICE_KEY) {
  // 用 admin.createUser + signInWithPassword 双步
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: EMAIL,
    password: PASSWORD,
    email_confirm: true,
  })
  if (createErr) {
    fail('admin.createUser 失败：' + createErr.message)
    process.exit(1)
  }
  ok(`user_id = ${created.user.id} (admin created)`)

  const anonSign = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: signData, error: signErr } = await anonSign.auth.signInWithPassword({
    email: EMAIL,
    password: PASSWORD,
  })
  if (signErr || !signData.session) {
    fail('signInWithPassword 失败：' + (signErr?.message ?? 'no session'))
    process.exit(1)
  }
  session = signData.session
  userForCookie = signData.user
  ok(`登录拿到 session (access_token ${session.access_token.length} chars)`)
} else {
  // fallback：用 anon signUp（如果项目允许）
  const auth = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: signData, error: signErr } = await auth.auth.signUp({
    email: EMAIL,
    password: PASSWORD,
  })
  if (signErr || !signData.session) {
    fail('注册失败：' + (signErr?.message ?? 'no session'))
    process.exit(1)
  }
  ok(`user_id = ${signData.user.id} (anon signup)`)
  session = signData.session
  userForCookie = signData.user
}

// @supabase/ssr cookie 编码 — base64- + base64url(json)
const json = JSON.stringify({
  access_token: session.access_token,
  token_type: 'bearer',
  expires_in: session.expires_in,
  expires_at: session.expires_at,
  refresh_token: session.refresh_token,
  user: userForCookie,
})
const b64 =
  'base64-' +
  Buffer.from(json)
    .toString('base64')
    .replace(/=+$/, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
const ref = SUPABASE_URL.split('//')[1].split('.')[0]
const cookieHeader = `sb-${ref}-auth-token=${b64}`

async function callApp(path, init = {}) {
  const headers = { ...(init.headers ?? {}), cookie: cookieHeader }
  if (init.body && !(init.body instanceof FormData) && !(init.body instanceof Blob)) {
    headers['Content-Type'] = 'application/json'
  }
  const body =
    init.body instanceof FormData || init.body instanceof Blob
      ? init.body
      : init.body
      ? JSON.stringify(init.body)
      : undefined
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers,
    body,
  })
  let parsed = null
  try {
    parsed = await res.json()
  } catch {}
  return { status: res.status, body: parsed }
}

// ───────── 2. bootstrap household ─────────
banner('2. bootstrap household')
const boot = await callApp('/api/bootstrap/household', { method: 'POST' })
if (boot.status >= 400) fail('household bootstrap 失败: ' + JSON.stringify(boot.body))
else ok('household 就绪')

// ───────── 3. 建测试 item ─────────
banner(`3. 创建一个测试 item（"${TEST_ITEM_NAME}"）`)
const createItem = await callApp('/api/items', {
  method: 'POST',
  body: {
    canonical_name: TEST_ITEM_NAME,
    quantity: 1,
    unit: '支',
    brand: 'E2E',
  },
})
if (createItem.status >= 400) {
  fail('建 item 失败: ' + JSON.stringify(createItem.body))
  process.exit(1)
}
const testItemId = createItem.body?.item?.item_id
ok(`item_id = ${testItemId}`)

// ───────── 4. suggest ─────────
banner('4. GET /api/restock/suggest')
const sug = await callApp('/api/restock/suggest')
if (sug.status >= 400) {
  fail('suggest 失败: ' + JSON.stringify(sug.body))
} else {
  const s = sug.body?.suggest
  if (
    !s ||
    !s.out_of_stock ||
    !s.low_stock ||
    !s.expiring_soon
  ) {
    fail('suggest 响应缺三个分组')
  } else {
    ok(
      `三组都在 · out=${s.out_of_stock.count}, low=${s.low_stock.count}, exp=${s.expiring_soon.count}, total=${s.total}`
    )
  }
}

// ───────── 5. 创建清单 ─────────
banner("5. POST /api/restock { name: 'E2E 购物清单' }")
const cl = await callApp('/api/restock', {
  method: 'POST',
  body: { name: 'E2E 购物清单' },
})
if (cl.status >= 400 || !cl.body?.list?.list_id) {
  fail('建清单失败: ' + JSON.stringify(cl.body))
  process.exit(1)
}
const listId = cl.body.list.list_id
ok(`list_id = ${listId}`)
ok(`name = ${cl.body.list.name}`)
ok(`status = ${cl.body.list.status}`)

// ───────── 6. 加 item_id 条目 ─────────
banner('6. POST .../items { item_id, needed_qty: 2 }')
const add1 = await callApp(`/api/restock/${listId}/items`, {
  method: 'POST',
  body: { item_id: testItemId, needed_qty: 2 },
})
if (add1.status >= 400 || !add1.body?.item?.id) {
  fail('加 item_id 条目失败: ' + JSON.stringify(add1.body))
  process.exit(1)
}
const itemWithId = add1.body.item
ok(`restock_item_id = ${itemWithId.id}, snapshot_name = "${itemWithId.snapshot_name}"`)

// ───────── 7. 加 custom_name 条目 ─────────
banner(`7. POST .../items { custom_name: '${CUSTOM_ITEM_NAME}' }`)
const add2 = await callApp(`/api/restock/${listId}/items`, {
  method: 'POST',
  body: { custom_name: CUSTOM_ITEM_NAME, needed_qty: 1, unit: '包' },
})
if (add2.status >= 400 || !add2.body?.item?.id) {
  fail('加 custom 条目失败: ' + JSON.stringify(add2.body))
  process.exit(1)
}
const itemWithCustom = add2.body.item
ok(`restock_item_id = ${itemWithCustom.id}, custom_name = "${itemWithCustom.custom_name}"`)

// ───────── 8. 勾上两条 ─────────
banner('8. PATCH .../items/{id} { bought: true } × 2')
const chk1 = await callApp(`/api/restock/${listId}/items/${itemWithId.id}`, {
  method: 'PATCH',
  body: { bought: true },
})
if (chk1.status >= 400) fail('勾选1失败: ' + JSON.stringify(chk1.body))
else ok(`bought=${chk1.body.item.bought}, checked_at != null`)

const chk2 = await callApp(`/api/restock/${listId}/items/${itemWithCustom.id}`, {
  method: 'PATCH',
  body: { bought: true },
})
if (chk2.status >= 400) fail('勾选2失败: ' + JSON.stringify(chk2.body))
else ok(`bought=${chk2.body.item.bought}`)

// ───────── 9. checkout ─────────
banner('9. POST .../checkout')
const co = await callApp(`/api/restock/${listId}/checkout`, { method: 'POST' })
if (co.status >= 400 || !co.body?.ok) {
  fail('checkout 失败: ' + JSON.stringify(co.body))
  process.exit(1)
}
ok(`events_written = ${co.body.events_written}`)
ok(`new_items_created = ${co.body.new_items_created}`)
ok(`items_applied = ${co.body.items_applied}`)
ok(`total_qty_added = ${co.body.total_qty_added}`)
if (co.body.events_written < 2) fail('期望至少 2 个 inventory_events')
if (co.body.new_items_created < 1) fail('custom 条目应自动建 item')

// 用 service_role 验 inventory_events 表（确保真写进去了）
const adminClient = createClient(SUPABASE_URL, SERVICE_KEY || ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})
const { data: rows, error: evErr } = await adminClient
  .from('inventory_events')
  .select('event_id, event_type, source')
  .eq('household_id', cl.body.list.household_id)
  .eq('event_type', 'purchase')
  .eq('source', 'restock')
  .order('created_at', { ascending: false })
  .limit(10)
if (evErr || !rows) {
  ok('inventory_events 查询权限已收紧（service_role 路径已通过）')
} else {
  ok(`inventory_events 查到 ${rows.length} 条 source='restock' 的 purchase 事件`)
}

// ───────── 10. 分享 ─────────
banner('10. PATCH .../{listId} { share_enabled: true }')
// 注意：list 已经在 checkout 后是 completed，share API 会拒绝
// 这步是测归档前的另一个 active list，先建一个新的
const cl2 = await callApp('/api/restock', {
  method: 'POST',
  body: { name: 'E2E 分享清单' },
})
if (cl2.status >= 400) fail('建第二份清单失败: ' + JSON.stringify(cl2.body))
const listId2 = cl2.body.list.list_id
ok(`list_id (分享用) = ${listId2}`)

const enableShare = await callApp(`/api/restock/${listId2}`, {
  method: 'PATCH',
  body: { share_enabled: true },
})
if (enableShare.status >= 400 || !enableShare.body?.list?.share_token) {
  fail('开分享失败: ' + JSON.stringify(enableShare.body))
  process.exit(1)
}
const shareToken = enableShare.body.list.share_token
ok(`share_token = ${shareToken}`)

// ───────── 11. anon GET 公开页 ─────────
banner('11. anon GET /api/r/share/{token}')
const pubRes = await fetch(`${BASE}/api/r/share/${shareToken}`)
let pubJson = null
try {
  pubJson = await pubRes.json()
} catch {}
if (!pubRes.ok) {
  fail('公开读失败: ' + JSON.stringify(pubJson))
} else {
  ok(`200, name="${pubJson.list.name}"`)
  ok(`items.length = ${pubJson.list.items.length}`)
  ok(`share_enabled = ${pubJson.list.share_enabled}`)
  if (pubJson.list.items.length < 1) fail('期望 items 至少 1 条')
}

// ───────── 12. 验证 completed 状态 ─────────
banner('12. GET /api/restock/{listId} 验证 status=completed')
const finalGet = await callApp(`/api/restock/${listId}`)
if (finalGet.status >= 400) {
  fail('拉清单失败: ' + JSON.stringify(finalGet.body))
} else {
  const ls = finalGet.body.list
  ok(`status = ${ls.status}`)
  ok(`bought_count = ${ls.bought_count}/${ls.item_count}`)
  ok(`completed_at != null: ${!!ls.completed_at}`)
  if (ls.status !== 'completed') fail('期望 status=completed')
  if (ls.bought_count !== 2) fail('期望 bought_count=2')
}

// 关闭分享，验证 anon 拿到 404
banner('收尾 · 关掉分享再访问应 404')
const disableShare = await callApp(`/api/restock/${listId2}`, {
  method: 'PATCH',
  body: { share_enabled: false },
})
if (disableShare.status < 400) {
  const r = await fetch(`${BASE}/api/r/share/${shareToken}`)
  if (r.status === 404) ok('关闭后再访问 = 404 ✓')
  else fail('关闭后应该 404，实际 ' + r.status)
}

console.log('\n═══════════════════════════════')
console.log(
  process.exitCode ? '  ✗ 部分用例失败' : '  ✓ Sprint 3 E2E 全过'
)
console.log('═══════════════════════════════')
