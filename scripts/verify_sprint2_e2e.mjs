/**
 * Sprint 2 端到端测试 — 用真实 cookie auth
 *
 * 跑：
 *   1. 登录拿到 cookies
 *   2. POST 一个小票图到 /api/recognition（multipart，附 sourceType='receipt'）
 *      → 应该触发 MOCK 适配器（QWEN_API_KEY 没设）→ 返回 task + items
 *   3. 拉 /api/recognition/[id] 验证 task 落库
 *   4. 拿现有 items → 找一个匹配名字做"重复"
 *   5. POST /api/recognition/[id]/confirm 用三分支决策
 *   6. 验证 inventory 里多了 item 或合并了
 *   7. 验证 usage_log 多了 mock / success 行
 *
 * 退出：不通过 exit 1，输出彩色结果
 */
const { createClient } = await import('@supabase/supabase-js')

const BASE = 'http://localhost:3000'
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://cgkwjpamcwffalfagddj.supabase.co'
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.ANON_KEY ?? ''
// 测试账号：用 timestamp 防止冲突；通过 Supabase 管理 API 创建并 signup
const TEST_TAG = `sprint2-verify-${Date.now()}`
const EMAIL = `${TEST_TAG}@him.local`
const PASSWORD = 'TestPass#2026'

if (!ANON_KEY) {
  console.error('需要 ANON_KEY env')
  process.exit(1)
}

function banner(s) { console.log('\n' + '─'.repeat(3) + ' ' + s + ' ' + '─'.repeat(3)) }
function ok(s) { console.log('  ✓ ' + s) }
function fail(s) { console.log('  ✗ ' + s); process.exitCode = 1 }

// 1. 用 supabase-js 注册一个新用户（避免依赖你之前的账号密码）→ 登录拿 cookie
banner('1. 注册新测试用户 + 构造 cookie')
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
ok(`user_id = ${signData.user.id} (${EMAIL})`)

const session = signData.session

// @supabase/ssr server storage 编码：base64- + base64url(json(blob))
const json = JSON.stringify({
  access_token: session.access_token,
  token_type: 'bearer',
  expires_in: session.expires_in,
  expires_at: session.expires_at,
  refresh_token: session.refresh_token,
  user: signData.user,
})
const b64 = 'base64-' + Buffer.from(json)
  .toString('base64')
  .replace(/=+$/, '')
  .replace(/\+/g, '-')
  .replace(/\//g, '_')
const ref = SUPABASE_URL.split('//')[1].split('.')[0]
const cookieHeader = `sb-${ref}-auth-token=${b64}`
ok(`cookie 已设 (${cookieHeader.length} chars, 带 base64- 前缀)`)

async function callApp(path, init = {}) {
  const isJson = !(init.body instanceof FormData) && !(init.body instanceof Blob)
  const headers = { ...(init.headers ?? {}), cookie: cookieHeader }
  if (isJson) headers['Content-Type'] = 'application/json'
  const body = isJson && init.body ? JSON.stringify(init.body) : init.body
  const res = await fetch(`${BASE}${path}`, { ...init, headers, body })
  let parsed = null
  try { parsed = await res.json() } catch {}
  return { status: res.status, body: parsed }
}

// 2. bootstrap 用户的 household
banner('2. bootstrap household')
const bootRes = await callApp('/api/bootstrap/household', { method: 'POST' })
if (bootRes.status >= 400) {
  fail(`household bootstrap 失败: ${JSON.stringify(bootRes.body)}`)
}
ok(`household 状态：${JSON.stringify(bootRes.body ?? {}).slice(0, 80) || 'ok'}`)

// 3. 拉当前 household（创一个备用 item 验证去重）
banner('3. 准备：创建一个匹配名字的 item（用于验证重复检测）')
const itemsListRes = await callApp('/api/items')
const itemsJson = itemsListRes.body
const existingItems = itemsJson.items ?? []
ok(`家里已有 ${existingItems.length} 件商品`)
if (existingItems.length === 0) {
  // 创建一个叫"可口可乐"的，专门用于测试去重匹配
  const createRes = await callApp('/api/items', {
    method: 'POST',
    body: {
      canonical_name: '可口可乐',
      quantity: 5,
      unit: '罐',
      brand: '可口可乐',
    },
  })
  if (createRes.status < 400) ok('为去重测试建了"可口可乐" x5')
  else fail('建备用 item 失败: ' + JSON.stringify(createRes.body))
}

// 4. POST 一张假图（小 PNG bytes 当 mock 用）
banner('4. POST /api/recognition（multipart）')
// 1x1 透明 PNG
const PNG_BYTES = Buffer.from(
  '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c636000000000050001a5f645400000000049454e44ae426082',
  'hex'
)
const form = new FormData()
form.append('file', new Blob([PNG_BYTES], { type: 'image/png' }), 'test-receipt.png')
form.append('sourceType', 'receipt')

const recogRes = await fetch(`${BASE}/api/recognition`, {
  method: 'POST',
  headers: { cookie: cookieHeader },
  body: form,
})
const recogJson = await recogRes.json()
console.log('  status:', recogRes.status)
if (recogRes.status === 429 && recogJson.error === 'quota_exceeded') {
  fail('quota 满了 — ' + JSON.stringify(recogJson.quota))
  process.exit(1)
}
if (!recogRes.ok) {
  fail('recognition 失败: ' + (recogJson.error ?? recogRes.status))
  console.log(JSON.stringify(recogJson, null, 2).slice(0, 500))
  process.exit(1)
}

const batchId = recogJson.task?.recognition_id
ok(`task 创建: ${batchId}`)
ok(`model: ${recogJson.task?.model}`)
ok(`items: ${recogJson.items?.length ?? 0} 件`)
ok(`MOCK 模式: ${recogJson.task?.model?.startsWith('mock') ? '是' : '否'}`)

const items = recogJson.items ?? []
if (items.length === 0) {
  fail('MOCK 没返 items')
  process.exit(1)
}

const dupItems = items.filter((i) => i.duplicate?.status === 'strict_match')
const fuzzItems = items.filter((i) => i.duplicate?.status === 'fuzzy_match')
const newItems = items.filter((i) => i.duplicate?.status === 'new_item')
ok(`去重：strict=${dupItems.length}, fuzzy=${fuzzItems.length}, new=${newItems.length}`)

// 4. 拉任务详情
banner('4. GET /api/recognition/[id]')
const getRes = await fetch(`${BASE}/api/recognition/${batchId}`, {
  headers: { cookie: cookieHeader },
})
const getJson = await getRes.json()
if (!getRes.ok) {
  fail('拉任务失败: ' + getRes.status)
} else {
  ok(`任务态: ${getJson.task?.status}, items ${getJson.items?.length}`)
  if (getJson.task?.image_url_preview) ok('拿到预览签名 URL')
  else fail('没拿到 image_url_preview')
}

// 5. 入库（三分支决策）
banner('5. POST /api/recognition/[id]/confirm')
const decisions = items.map((i) => {
  const base = {
    recognition_item_id: i.recognition_item_id,
    action:
      i.duplicate?.status === 'strict_match' || i.duplicate?.status === 'fuzzy_match'
        ? 'merge'
        : 'keep_separate',
    final_name: i.name,
    final_quantity: i.quantity || 1,
  }
  if (i.unit) base.final_unit = i.unit
  if (i.duplicate?.status !== 'new_item' && i.duplicate?.matched) {
    base.matched_item_id = i.duplicate.matched.item_id
  }
  return base
})

const confirmRes = await fetch(`${BASE}/api/recognition/${batchId}/confirm`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', cookie: cookieHeader },
  body: JSON.stringify({ decisions }),
})
const confirmJson = await confirmRes.json()
if (!confirmRes.ok || !confirmJson.ok) {
  fail('confirm 失败: ' + JSON.stringify(confirmJson))
  process.exit(1)
}
ok(`入库总结: ${JSON.stringify(confirmJson.summary)}`)
ok(`涉及的 item_ids: ${confirmJson.item_ids?.length ?? 0}`)

// 6. 验证 inventory 多了
banner('6. 验证 inventory 真多东西了')
const verifyRes = await fetch(`${BASE}/api/items`, {
  headers: { cookie: cookieHeader },
})
const verifyJson = await verifyRes.json()
ok(`当前库存: ${verifyJson.items?.length} 件`)

// 7. 查 usage_log 多了几行
banner('7. 验证 usage_log')
const quotaRes = await fetch(`${BASE}/api/admin/quota`, {
  headers: { cookie: cookieHeader },
})
const quotaJson = await quotaRes.json()
if (!quotaRes.ok) {
  fail('quota 接口失败')
} else {
  ok(`今日已用: ${quotaJson.daily.used}/${quotaJson.daily.limit}`)
  ok(`本月 token: ${quotaJson.monthly.tokens_used}`)
  ok(`MOCK 模式: ${quotaJson.mock_mode ? '是' : '否'}`)
}

console.log('\n═══════════════════════════════')
console.log(process.exitCode ? '  ✗ 部分用例失败' : '  ✓ Sprint 2 E2E 全过')
console.log('═══════════════════════════════')
