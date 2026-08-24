import type { RecognitionResult, NormalizedItem } from './types'

/**
 * MOCK AI 数据 — 当 QWEN_API_KEY 没配置 / 设置了 MOCK_AI=1 时使用
 *
 * 根据 sourceType 返回典型数据：
 * - receipt: 5-8 条（便利店购物小票）
 * - screenshot: 4-6 条（电商订单截图）
 * - camera: 3-5 条（拍厨房一角）
 *
 * 故意带一些低/中置信度字段，让前端的三档 UI 有东西展示
 */

function makeItem(overrides: Partial<NormalizedItem>): NormalizedItem {
  return {
    raw_name: '',
    name: '',
    brand: null,
    quantity: 1,
    unit: '个',
    package_quantity: null,
    expiry_date: null,
    category_hint: null,
    restock_hint: null,
    confidence: {
      name: 0.95,
      quantity: 0.95,
      category: 0.9,
      unit: 0.95,
      package_quantity: 0.85,
      expiry_date: 0.5,
    },
    ...overrides,
  }
}

const receiptItems: NormalizedItem[] = [
  makeItem({
    raw_name: '可口可乐 330ml',
    name: '可口可乐',
    brand: '可口可乐',
    quantity: 2,
    unit: '罐',
    package_quantity: 1,
    category_hint: '食品饮料', restock_hint: true,
    confidence: { name: 0.96, quantity: 0.95, category: 0.93, unit: 0.92, package_quantity: 0.9, expiry_date: 0.4 },
  }),
  makeItem({
    raw_name: '蒙牛纯牛奶 250ml*12',
    name: '纯牛奶',
    brand: '蒙牛',
    quantity: 1,
    unit: '提',
    package_quantity: 12,
    category_hint: '食品饮料', restock_hint: true,
    confidence: { name: 0.91, quantity: 0.55, category: 0.88, unit: 0.84, package_quantity: 0.92, expiry_date: 0.6 },
  }),
  makeItem({
    raw_name: '心相印抽纸 3层110抽*24包',
    name: '抽纸',
    brand: '心相印',
    quantity: 1,
    unit: '箱',
    package_quantity: 24,
    category_hint: '家居清洁', restock_hint: true,
    confidence: { name: 0.72, quantity: 0.4, category: 0.85, unit: 0.7, package_quantity: 0.88, expiry_date: 0.3 },
  }),
  makeItem({
    raw_name: '康师傅红烧牛肉面 5包入',
    name: '红烧牛肉面',
    brand: '康师傅',
    quantity: 1,
    unit: '袋',
    package_quantity: 5,
    category_hint: '食品饮料', restock_hint: true,
    confidence: { name: 0.94, quantity: 0.7, category: 0.78, unit: 0.82, package_quantity: 0.9, expiry_date: 0.5 },
  }),
  makeItem({
    raw_name: '海天生抽 500ml',
    name: '生抽',
    brand: '海天',
    quantity: 1,
    unit: '瓶',
    package_quantity: 1,
    category_hint: '食品饮料', restock_hint: true,
    expiry_date: '2026-12-30',
    confidence: { name: 0.89, quantity: 0.92, category: 0.86, unit: 0.94, package_quantity: 0.8, expiry_date: 0.88 },
  }),
  makeItem({
    raw_name: '农夫山泉 550ml*24',
    name: '矿泉水',
    brand: '农夫山泉',
    quantity: 1,
    unit: '箱',
    package_quantity: 24,
    category_hint: '食品饮料', restock_hint: true,
    confidence: { name: 0.95, quantity: 0.6, category: 0.92, unit: 0.9, package_quantity: 0.94, expiry_date: 0.4 },
  }),
]

const screenshotItems: NormalizedItem[] = [
  makeItem({
    raw_name: '舒洁厨房纸 80抽*2卷',
    name: '厨房纸',
    brand: '舒洁',
    quantity: 1,
    unit: '提',
    package_quantity: 2,
    category_hint: '家居清洁', restock_hint: true,
    confidence: { name: 0.88, quantity: 0.7, category: 0.86, unit: 0.75, package_quantity: 0.92, expiry_date: 0.2 },
  }),
  makeItem({
    raw_name: '滴露消毒液 1.2L',
    name: '消毒液',
    brand: '滴露',
    quantity: 1,
    unit: '瓶',
    category_hint: '家居清洁', restock_hint: true,
    confidence: { name: 0.83, quantity: 0.95, category: 0.72, unit: 0.96, package_quantity: 0.5, expiry_date: 0.6 },
  }),
  makeItem({
    raw_name: '立白洗洁精 1.2kg',
    name: '洗洁精',
    brand: '立白',
    quantity: 1,
    unit: '瓶',
    category_hint: '家居清洁', restock_hint: true,
    confidence: { name: 0.92, quantity: 0.92, category: 0.8, unit: 0.95, package_quantity: 0.7, expiry_date: 0.4 },
  }),
  makeItem({
    raw_name: '蓝月亮洗衣液 2kg',
    name: '洗衣液',
    brand: '蓝月亮',
    quantity: 1,
    unit: '瓶',
    category_hint: '家居清洁', restock_hint: true,
    confidence: { name: 0.95, quantity: 0.9, category: 0.83, unit: 0.95, package_quantity: 0.6, expiry_date: 0.5 },
  }),
]

const cameraItems: NormalizedItem[] = [
  makeItem({
    raw_name: '高露洁牙膏 120g',
    name: '牙膏',
    brand: '高露洁',
    quantity: 1,
    unit: '支',
    category_hint: '个护美妆', restock_hint: true,
    confidence: { name: 0.74, quantity: 0.45, category: 0.65, unit: 0.82, package_quantity: 0.5, expiry_date: 0.5 },
  }),
  makeItem({
    raw_name: '海飞丝洗发水 200ml',
    name: '洗发水',
    brand: '海飞丝',
    quantity: 1,
    unit: '瓶',
    category_hint: '个护美妆', restock_hint: true,
    confidence: { name: 0.86, quantity: 0.5, category: 0.7, unit: 0.85, package_quantity: 0.6, expiry_date: 0.6 },
  }),
  makeItem({
    raw_name: '洁柔卷纸 140g*10',
    name: '卷纸',
    brand: '洁柔',
    quantity: 1,
    unit: '提',
    package_quantity: 10,
    category_hint: '家居清洁', restock_hint: true,
    confidence: { name: 0.78, quantity: 0.55, category: 0.81, unit: 0.7, package_quantity: 0.88, expiry_date: 0.3 },
  }),
  makeItem({
    raw_name: '未识别物品',
    name: '某种调料',
    brand: null,
    quantity: 1,
    unit: '瓶',
    category_hint: '食品饮料', restock_hint: true,
    confidence: { name: 0.42, quantity: 0.4, category: 0.5, unit: 0.65, package_quantity: 0.3, expiry_date: 0.2 },
  }),
]

export async function mockRecognize(opts: {
  imageUrl: string
  sourceType: 'receipt' | 'screenshot' | 'camera'
}): Promise<RecognitionResult> {
  // 模拟 800ms-2s 的网络延迟
  const delay = 800 + Math.floor(Math.random() * 1200)
  await new Promise((r) => setTimeout(r, delay))

  const t0 = Date.now()
  const pool =
    opts.sourceType === 'receipt'
      ? receiptItems
      : opts.sourceType === 'screenshot'
      ? screenshotItems
      : cameraItems

  // 随机抽 3-N 个
  const n = Math.min(pool.length, 3 + Math.floor(Math.random() * (pool.length - 2)))
  const shuffled = [...pool].sort(() => Math.random() - 0.5)
  const items = shuffled.slice(0, n).map((it) => ({ ...it, raw_name: it.raw_name || it.name }))

  return {
    items,
    model: 'mock-v0.1',
    tokens_used: 0,
    duration_ms: Date.now() - t0,
    raw_text: '这是 MOCK 模式的 AI 响应，不消耗真实 token。',
  }
}
