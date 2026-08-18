import type { AiAdapter, RecognitionResult, NormalizedItem, SourceType, FieldConfidence } from './types'
import { recognitionResultSchema } from './types'

/**
 * Qwen-VL-Plus 适配器（真实模型）
 *
 * 用法：通过 getAiAdapter() 间接取。MOCK 模式 = QWEN_API_KEY 未设置 / MOCK_AI=1
 *
 * API 路径：POST https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation
 *   Authorization: Bearer {QWEN_API_KEY}
 *   body: { model: "qwen-vl-plus", input: { messages: [...] }, parameters: { ... } }
 *
 * 多模态返回是文本，由模型按 JSON 模板生成。解析失败回落 mock 不行，
 * 应该明示失败（user 看到"识别失败"可以重试）。
 */

const DASHSCOPE_URL =
  'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation'

const MODEL = 'qwen-vl-plus'

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
      "category_hint": "商品所属一级分类，如 '饮料'/'纸品'/'调味品'/'个护'/'清洁用品'/'乳制品'/'速食'/'药品'/'其他'",
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
4. 实在看不清的物品，宁可不写也不要编造`
}

interface DashScopeResp {
  output?: {
    text?: string
    choices?: Array<{
      finish_reason: string
      message: { role: string; content: Array<{ text: string }> }
    }>
  }
  usage?: { total_tokens?: number; input_tokens?: number; output_tokens?: number }
  request_id?: string
}

function extractJsonText(input: DashScopeResp): string {
  const out = input.output
  if (!out) return ''
  if (out.text) return out.text
  if (out.choices?.[0]?.message?.content) {
    return out.choices[0].message.content.map((c) => c.text).join('\n')
  }
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
    input: {
      messages: [
        {
          role: 'user',
          content: [
            { image: opts.imageUrl },
            { text: buildPrompt(opts.sourceType) },
          ],
        },
      ],
    },
    parameters: {
      result_format: 'message',
      // 强制 JSON 输出
      response_format: { type: 'json_object' },
    },
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
      `Qwen-VL-Plus HTTP ${resp.status}: ${text.slice(0, 300)}`
    )
  }

  const json = (await resp.json()) as DashScopeResp
  const text = extractJsonText(json)
  const tokens = json.usage?.total_tokens ?? 0

  if (!text) {
    throw new Error('Qwen-VL-Plus 返回内容为空')
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(extractJsonBlock(text))
  } catch (e) {
    throw new Error(`解析 Qwen-VL-Plus JSON 失败: ${(e as Error).message}; raw=${text.slice(0, 300)}`)
  }

  const validated = recognitionResultSchema.safeParse(parsed)
  if (!validated.success) {
    throw new Error(
      `Qwen-VL-Plus 返回 JSON 不符合 schema: ${validated.error.issues
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

export const qwenAdapter: AiAdapter = {
  recognize: (opts) => {
    const key = process.env.QWEN_API_KEY
    if (!key) {
      throw new Error('QWEN_API_KEY 未配置；getAiAdapter 应已 fallback 到 mock')
    }
    return qwenRecognize({ ...opts, apiKey: key })
  },
}
