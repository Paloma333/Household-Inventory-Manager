import type { AiAdapter, RecognitionResult, NormalizedItem, SourceType, FieldConfidence } from './types'
import { recognitionResultSchema } from './types'

/**
 * Qwen3.6-Flash 适配器（真实模型）
 *
 * 用法：通过 getAiAdapter() 间接取。MOCK 模式 = QWEN_API_KEY 未设置 / MOCK_AI=1
 *
 * API 路径：POST https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions
 *   Authorization: Bearer {DASHSCOPE_API_KEY}
 *   body: { model: "qwen3.6-flash", messages: [...], response_format: {...} }
 *
 * 注意：qwen-vl-plus / qwen-vl-max 已于 2026-07-13 下线，官方推荐替换为
 * Qwen3.6/3.7 系列；本项目选 qwen3.6-flash（原生视觉语言 Flash 档，
 * ¥1.2/百万输入 token，新用户送 100 万 token 免费额度）。
 *
 * 多模态返回是文本，由模型按 JSON 模板生成。解析失败回落 mock 不行，
 * 应该明示失败（user 看到"识别失败"可以重试）。
 */

const DASHSCOPE_URL =
  'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions'

const MODEL = 'qwen3.6-flash'

const SOURCE_HINT: Record<SourceType, string> = {
  receipt: '这是超市购物小票。请识别小票上所有的商品，按行输出。',
  screenshot: '这是电商订单截图或外卖 APP 截图。请识别图上所有商品名 + 数量。',
  camera: '这是手机拍照的家庭实物/食品外包装。请识别图中可见的所有商品。',
}

function buildPrompt(sourceType: SourceType): string {
  return `${SOURCE_HINT[sourceType]}

严格按下面的 JSON schema 输出，不要输出任何额外文字（包括 markdown 包裹符）：
{
  "items": [
    {
      "raw_name": "小票上看到的原始文字",
      "name": "标准化商品名（去掉品牌后缀和规格）",
      "brand": "品牌，没有就 null",
      "quantity": 数字（根据小票行数/规格推断）,
      "unit": "中文量词：包/瓶/罐/提/箱/袋/支/盒/件/个 之一，没有就 null",
      "package_quantity": "包装内单品数（如 1 提 = 12 包 → 12），没有就 null",
      "expiry_date": "YYYY-MM-DD，包装上看到的，没有就 null",
      "category_hint": "从这 8 个里选最接近的一个：'食品饮料'/'生鲜果蔬'/'个护美妆'/'家居清洁'/'健康药品'/'衣物配件'/'数码电器'/'其他'",
      "restock_hint": true 或 false（是否易耗品：会被用完、需要定期补货的填 true，如食品/饮料/纸巾/洗护/清洁用品；耐用品填 false，如电器/衣物/家具/数码）,
      "confidence": {
        "name": 0~1,
        "quantity": 0~1,
        "category": 0~1,
        "unit": 0~1,
        "package_quantity": 0~1,
        "expiry_date": 0~1
      }
    }
  ]
}

规则：
1. 只输出你**确实从图上看到/推出**的字段，不确定就 confidence 调低（0.5 以下）
2. 同一商品出现多次只输出一条，按最大单位计（如提 → 箱优先）
3. 不是商品的内容（如日期、店铺名、二维码）不要输出
4. category_hint 必须严格从上面 8 个枚举值里选，不要自己发明分类
5. 实在看不清的物品，宁可不写也不要编造`
}

interface DashScopeResp {
  choices?: Array<{
    finish_reason: string
    message: { role: string; content: string | Array<{ text: string }> }
  }>
  usage?: {
    total_tokens?: number
    prompt_tokens?: number
    completion_tokens?: number
    input_tokens?: number
    output_tokens?: number
  }
  request_id?: string
}

function extractJsonText(input: DashScopeResp): string {
  const msg = input.choices?.[0]?.message
  if (!msg) return ''
  // OpenAI 兼容模式：content 是字符串；部分场景也可能是分段数组
  if (typeof msg.content === 'string') return msg.content
  if (Array.isArray(msg.content)) return msg.content.map((c) => c.text).join('\n')
  return ''
}

/** 提 JSON — 容错：去除 ```json 包裹、找首个 { ... 末个 } */
function extractJsonBlock(text: string): string {
  let t = text.trim()
  // 去除 markdown ```json ... ```
  t = t.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/, '')
  const first = t.indexOf('{')
  const last = t.lastIndexOf('}')
  if (first === -1 || last === -1 || last <= first) {
    throw new Error('模型返回无有效 JSON')
  }
  return t.slice(first, last + 1)
}

/** 把可能的不严格数字 coerce 成 number */
function coerceNum(v: unknown, fallback = 0): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string') {
    const n = Number(v)
    if (Number.isFinite(n)) return n
  }
  return fallback
}

function coerceConf(v: unknown): FieldConfidence {
  const obj = (typeof v === 'object' && v !== null ? v : {}) as Record<string, unknown>
  return {
    name: Math.min(1, Math.max(0, coerceNum(obj.name, 0.5))),
    quantity: Math.min(1, Math.max(0, coerceNum(obj.quantity, 0.5))),
    category: Math.min(1, Math.max(0, coerceNum(obj.category, 0.5))),
    unit: Math.min(1, Math.max(0, coerceNum(obj.unit, 0.5))),
    package_quantity: Math.min(1, Math.max(0, coerceNum(obj.package_quantity, 0.5))),
    expiry_date: Math.min(1, Math.max(0, coerceNum(obj.expiry_date, 0.5))),
  }
}

function coerceItem(raw: Record<string, unknown>): NormalizedItem {
  return {
    raw_name: typeof raw.raw_name === 'string' ? raw.raw_name : '',
    name: typeof raw.name === 'string' ? raw.name : '',
    brand: typeof raw.brand === 'string' ? raw.brand : null,
    quantity: coerceNum(raw.quantity, 1),
    unit: typeof raw.unit === 'string' ? raw.unit : null,
    package_quantity:
      raw.package_quantity == null
        ? null
        : coerceNum(raw.package_quantity, 1),
    expiry_date:
      typeof raw.expiry_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.expiry_date)
        ? raw.expiry_date
        : null,
    category_hint: typeof raw.category_hint === 'string' ? raw.category_hint : null,
    restock_hint: typeof raw.restock_hint === 'boolean' ? raw.restock_hint : null,
    confidence: coerceConf(raw.confidence),
  }
}

export async function qwenRecognize(opts: {
  apiKey: string
  imageUrl: string
  sourceType: SourceType
}): Promise<RecognitionResult> {
  const t0 = Date.now()

  const body = {
    model: MODEL,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: opts.imageUrl } },
          { type: 'text', text: buildPrompt(opts.sourceType) },
        ],
      },
    ],
    // 强制 JSON 输出
    response_format: { type: 'json_object' },
  }

  const resp = await fetch(DASHSCOPE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${opts.apiKey}`,
    },
    body: JSON.stringify(body),
  })

  if (!resp.ok) {
    const text = await resp.text()
    throw new Error(
      `Qwen3.6-Flash HTTP ${resp.status}: ${text.slice(0, 300)}`
    )
  }

  const json = (await resp.json()) as DashScopeResp
  const text = extractJsonText(json)
  const tokens =
    json.usage?.total_tokens ??
    json.usage?.prompt_tokens ??
    json.usage?.input_tokens ??
    0

  if (!text) {
    throw new Error('Qwen3.6-Flash 返回内容为空')
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(extractJsonBlock(text))
  } catch (e) {
    throw new Error(`解析 Qwen3.6-Flash JSON 失败: ${(e as Error).message}; raw=${text.slice(0, 300)}`)
  }

  const validated = recognitionResultSchema.safeParse(parsed)
  if (!validated.success) {
    throw new Error(
      `Qwen3.6-Flash 返回 JSON 不符合 schema: ${validated.error.issues
        .slice(0, 3)
        .map((i) => i.path.join('.') + ': ' + i.message)
        .join('; ')}`
    )
  }

  const items: NormalizedItem[] = validated.data.items.map((it) =>
    coerceItem(it as unknown as Record<string, unknown>)
  )

  return {
    items,
    model: MODEL,
    tokens_used: tokens,
    duration_ms: Date.now() - t0,
    raw_text: text,
  }
}

/**
 * 取阿里云百炼 API Key（兼容两个变量名）：
 * - DASHSCOPE_API_KEY（阿里云官方命名，.env.example 推荐）
 * - QWEN_API_KEY（旧命名，兼容历史配置）
 */
export function getDashScopeKey(): string | undefined {
  return process.env.DASHSCOPE_API_KEY ?? process.env.QWEN_API_KEY
}

export const qwenAdapter: AiAdapter = {
  recognize: (opts) => {
    const key = getDashScopeKey()
    if (!key) {
      throw new Error('DASHSCOPE_API_KEY 未配置；getAiAdapter 应已 fallback 到 mock')
    }
    return qwenRecognize({ ...opts, apiKey: key })
  },
}
