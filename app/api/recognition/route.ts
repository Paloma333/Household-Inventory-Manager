import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import {
  createSupabaseServerClient,
  getServiceRoleClient,
} from '@/lib/supabase/server'
import {
  uploadRecognitionImage,
  getSignedImageUrl,
} from '@/lib/supabase/storage'
import { shouldUseMock, recognizeWithLog } from '@/lib/ai'
import { checkQuota, logUsage } from '@/lib/ai/quota'
import { checkDuplicate } from '@/lib/recognition/duplicate'

/**
 * /api/recognition — 上传图片 → 调 AI → 落库 → 返回 batch + 候选项
 *
 * POST: multipart/form-data
 *   - file: 图片文件
 *   - sourceType: 'receipt' | 'screenshot' | 'camera'
 *
 * 响应：{
 *   ok: true,
 *   task: { recognition_id, status, source_type, image_url, model, processing_time_ms },
 *   items: [{
 *     recognition_item_id, name, brand, quantity, unit, package_quantity, expiry_date,
 *     category_hint, confidence,
 *     duplicate: { status, matched_item_id?, matched_name?, matched_quantity?, matched_brand? }
 *   }]
 * }
 *
 * 错误：
 *   401 未登录
 *   400 文件缺失 / 类型不对
 *   413 文件过大
 *   429 配额用完
 *   500 服务端问题
 */

const MAX_DURATION_LABEL_MS = 20_000 // 超过给前端显示"超时"

const SourceSchema = z.enum(['receipt', 'screenshot', 'camera'])

export async function POST(request: NextRequest) {
  const supabase = (await createSupabaseServerClient()) as any
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  // 取 household_id
  const { data: household } = await supabase
    .from('households')
    .select('household_id')
    .eq('owner_id', user.id)
    .limit(1)
    .maybeSingle()

  if (!household) {
    return NextResponse.json({ error: 'household_not_ready' }, { status: 400 })
  }

  // 解析 multipart form
  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return NextResponse.json({ error: 'invalid_form' }, { status: 400 })
  }

  const file = form.get('file')
  const sourceTypeRaw = form.get('sourceType')

  const sourceParsed = SourceSchema.safeParse(sourceTypeRaw)
  if (!sourceParsed.success) {
    return NextResponse.json(
      { error: 'sourceType 必须为 receipt/screenshot/camera' },
      { status: 400 }
    )
  }
  const sourceType = sourceParsed.data

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'file 字段缺失或类型不对' }, { status: 400 })
  }

  // 转 Buffer
  const arrayBuf = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuf)
  const mimeType = file.type || 'image/jpeg'

  // ── 配额闸门 ──
  const quota = await checkQuota(household.household_id)
  if (!quota.allowed) {
    await logUsage({
      userId: user.id,
      householdId: household.household_id,
      kind: 'recognition',
      tokens_used: 0,
      status: 'blocked_quota',
      metadata: { reason: quota.reason, source_type: sourceType },
    })
    return NextResponse.json(
      {
        error: 'quota_exceeded',
        reason: quota.reason,
        quota,
      },
      { status: 429 }
    )
  }

  // ── 上传 Supabase Storage ──
  const upload = await uploadRecognitionImage({
    userId: user.id,
    householdId: household.household_id,
    buffer,
    mimeType,
  })

  if (upload.error || !upload.path) {
    return NextResponse.json(
      { error: upload.error || '上传失败' },
      { status: 500 }
    )
  }

  // ── 取短期签名 URL 给 AI 用 ──
  const signed = await getSignedImageUrl(upload.path, 60 * 10) // 10 分钟足够
  if (signed.error || !signed.url) {
    return NextResponse.json(
      { error: `签名 URL 失败：${signed.error}` },
      { status: 500 }
    )
  }

  // ── 落 recognition_tasks，先记 pending ──
  const service = getServiceRoleClient() as any
  const { data: task, error: taskErr } = await service
    .from('recognition_tasks')
    .insert({
      user_id: user.id,
      household_id: household.household_id,
      source_type: sourceType,
      image_url: upload.path, // 存原始 path，不是 signed URL
      status: 'processing',
      model: shouldUseMock() ? 'mock-v0.1' : 'qwen-vl-plus',
      // 暂时不写 processing_time_ms
    })
    .select('recognition_id')
    .single()

  if (taskErr || !task) {
    return NextResponse.json(
      { error: taskErr?.message ?? 'task 创建失败' },
      { status: 500 }
    )
  }

  // ── 调 AI ──
  let aiResult
  try {
    aiResult = await recognizeWithLog({
      imageUrl: signed.url,
      sourceType,
    })
  } catch (e) {
    // 失败：更新 task 状态 / 写一行 failed log
    await service
      .from('recognition_tasks')
      .update({
        status: 'failed',
        error_message: (e as Error).message,
      })
      .eq('recognition_id', task.recognition_id)
    await logUsage({
      userId: user.id,
      householdId: household.household_id,
      kind: 'recognition',
      tokens_used: 0,
      status: 'failed',
      metadata: { error: (e as Error).message, recognition_id: task.recognition_id },
    })
    return NextResponse.json(
      { error: `识别失败：${(e as Error).message}` },
      { status: 500 }
    )
  }

  // ── 落 recognition_items ──
  const itemRows = aiResult.items.map((it) => ({
    recognition_id: task.recognition_id,
    raw_name: it.raw_name,
    predicted_name: it.name,
    predicted_quantity: it.quantity,
    predicted_unit: it.unit,
    predicted_package_quantity: it.package_quantity,
    confidence_json: it.confidence,
  }))

  const { data: items, error: itemsErr } = await service
    .from('recognition_items')
    .insert(itemRows)
    .select(
      'recognition_item_id, raw_name, predicted_name, predicted_quantity, predicted_unit, predicted_package_quantity, confidence_json'
    )

  if (itemsErr || !items) {
    return NextResponse.json(
      { error: itemsErr?.message ?? 'items 写入失败' },
      { status: 500 }
    )
  }

  // ── 更新 task 状态 ──
  await service
    .from('recognition_tasks')
    .update({
      status: 'succeeded',
      processing_time_ms: aiResult.duration_ms,
    })
    .eq('recognition_id', task.recognition_id)

  // ── 写 usage_log ──
  await logUsage({
    userId: user.id,
    householdId: household.household_id,
    kind: 'recognition',
    tokens_used: aiResult.tokens_used,
    status: shouldUseMock() ? 'mock' : 'success',
    metadata: {
      recognition_id: task.recognition_id,
      source_type: sourceType,
      item_count: aiResult.items.length,
      model: aiResult.model,
      duration_ms: aiResult.duration_ms,
    },
  })

  // ── 重复检测（每个 item 都查一次） ──
  const itemsWithDup = await Promise.all(
    items.map(async (row: any) => {
      const dup = await checkDuplicate({
        householdId: household.household_id,
        candidateName: row.predicted_name ?? '',
        candidateBrand: extractBrandFromRaw(row.raw_name), // 简化：从 raw 提取
      })
      return {
        recognition_item_id: row.recognition_item_id,
        name: row.predicted_name,
        brand: extractBrandFromRaw(row.raw_name),
        quantity: row.predicted_quantity,
        unit: row.predicted_unit,
        package_quantity: row.predicted_package_quantity,
        confidence: row.confidence_json,
        raw_name: row.raw_name,
        category_hint: extractCategoryFromConfidence(row.confidence_json),
        duplicate: {
          status: dup.status,
          score: dup.score,
          matched: dup.matched
            ? {
                item_id: dup.matched.item_id,
                canonical_name: dup.matched.canonical_name,
                quantity: dup.matched.quantity,
              }
            : null,
        },
      }
    })
  )

  return NextResponse.json({
    ok: true,
    task: {
      recognition_id: task.recognition_id,
      status: 'succeeded',
      source_type: sourceType,
      image_url: signed.url,
      model: aiResult.model,
      duration_ms: aiResult.duration_ms,
    },
    quota,
    items: itemsWithDup,
  })
}

/** 把品牌从 raw_name 提取（用 conf 不够稳，留空更简单） */
function extractBrandFromRaw(raw: string | null | undefined): string | null {
  if (!raw) return null
  return null
}

/** 粗略从 predicted name 推到分类 hint — 实际 UI 端让用户选 */
function extractCategoryFromConfidence(_conf: unknown): string | null {
  return null
}
