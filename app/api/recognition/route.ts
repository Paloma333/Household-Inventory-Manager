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
 * /api/recognition — 上传图片（1~5 张）→ 调 AI → 落库 → 返回 batch + 候选项
 *
 * POST: multipart/form-data
 *   - file: 图片文件（可重复出现，最多 5 张，多张归入同一个批次）
 *   - sourceType: 'receipt' | 'screenshot' | 'camera'
 *
 * 响应：{
 *   ok: true,
 *   task: { recognition_id, status, source_type, image_url, image_urls, model, processing_time_ms },
 *   items: [{
 *     recognition_item_id, name, brand, quantity, unit, package_quantity, expiry_date,
 *     category_hint, confidence,
 *     duplicate: { status, matched_item_id?, matched_name?, matched_quantity?, matched_brand? }
 *   }]
 * }
 *
 * 错误：
 *   401 未登录
 *   400 文件缺失 / 类型不对 / 张数超限
 *   413 文件过大
 *   429 配额用完
 *   500 服务端问题
 */

const MAX_IMAGES = 5

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

  const files = form
    .getAll('file')
    .filter((f): f is File => f instanceof File)
  const sourceTypeRaw = form.get('sourceType')

  const sourceParsed = SourceSchema.safeParse(sourceTypeRaw)
  if (!sourceParsed.success) {
    return NextResponse.json(
      { error: 'sourceType 必须为 receipt/screenshot/camera' },
      { status: 400 }
    )
  }
  const sourceType = sourceParsed.data

  if (files.length === 0) {
    return NextResponse.json({ error: 'file 字段缺失或类型不对' }, { status: 400 })
  }
  if (files.length > MAX_IMAGES) {
    return NextResponse.json(
      { error: `一次最多 ${MAX_IMAGES} 张图片` },
      { status: 400 }
    )
  }
  const badFile = files.find((f) => !f.type.startsWith('image/'))
  if (badFile) {
    return NextResponse.json(
      { error: `「${badFile.name.slice(0, 30)}」不是图片` },
      { status: 400 }
    )
  }
  const oversized = files.find((f) => f.size > 10 * 1024 * 1024)
  if (oversized) {
    return NextResponse.json(
      { error: `「${oversized.name.slice(0, 30)}」太大（>10MB）` },
      { status: 413 }
    )
  }

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

  // ── 上传 Supabase Storage（多张并行） ──
  const uploadResults = await Promise.all(
    files.map(async (file) => {
      const arrayBuf = await file.arrayBuffer()
      return uploadRecognitionImage({
        userId: user.id,
        householdId: household.household_id,
        buffer: Buffer.from(arrayBuf),
        mimeType: file.type || 'image/jpeg',
      })
    })
  )

  const failedUpload = uploadResults.find((u) => u.error || !u.path)
  if (failedUpload) {
    return NextResponse.json(
      { error: failedUpload.error || '上传失败' },
      { status: 500 }
    )
  }
  const paths = uploadResults.map((u) => u.path!) // 上面已校验非空

  // ── 取短期签名 URL 给 AI 用（10 分钟足够） ──
  const signedUrls: string[] = []
  for (const path of paths) {
    const signed = await getSignedImageUrl(path, 60 * 10)
    if (signed.error || !signed.url) {
      return NextResponse.json(
        { error: `签名 URL 失败：${signed.error}` },
        { status: 500 }
      )
    }
    signedUrls.push(signed.url)
  }

  // ── 落 recognition_tasks，先记 pending ──
  const service = getServiceRoleClient() as any
  const { data: task, error: taskErr } = await service
    .from('recognition_tasks')
    .insert({
      user_id: user.id,
      household_id: household.household_id,
      source_type: sourceType,
      image_url: paths[0], // 存原始 path，不是 signed URL（首图，兼容旧字段）
      image_paths: paths, // 全部图片 path（多图批次）
      status: 'processing',
      model: shouldUseMock() ? 'mock-v0.1' : 'qwen3.6-flash',
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

  // ── 调 AI（每张图一次调用，并行；部分失败不算整批失败） ──
  const aiSettled = await Promise.allSettled(
    signedUrls.map((imageUrl) => recognizeWithLog({ imageUrl, sourceType }))
  )

  const aiResults = aiSettled
    .filter(
      (r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof recognizeWithLog>>> =>
        r.status === 'fulfilled'
    )
    .map((r) => r.value)
  const aiFailures = aiSettled
    .filter((r) => r.status === 'rejected')
    .map((r) => (r as PromiseRejectedResult).reason as Error)

  if (aiResults.length === 0) {
    // 全军覆没：更新 task 状态 / 写一行 failed log
    const msg = aiFailures[0]?.message ?? '识别失败'
    await service
      .from('recognition_tasks')
      .update({
        status: 'failed',
        error_message: msg,
      })
      .eq('recognition_id', task.recognition_id)
    await logUsage({
      userId: user.id,
      householdId: household.household_id,
      kind: 'recognition',
      tokens_used: 0,
      status: 'failed',
      metadata: { error: msg, recognition_id: task.recognition_id },
    })
    return NextResponse.json(
      { error: `识别失败：${msg}` },
      { status: 500 }
    )
  }

  const aiResult = {
    items: aiResults.flatMap((r) => r.items),
    tokens_used: aiResults.reduce((sum, r) => sum + r.tokens_used, 0),
    duration_ms: Math.max(...aiResults.map((r) => r.duration_ms)),
    model: aiResults[0].model,
    failed_images: aiFailures.length,
  }

  // ── 落 recognition_items ──
  const itemRows = aiResult.items.map((it) => ({
    recognition_id: task.recognition_id,
    raw_name: it.raw_name,
    predicted_name: it.name,
    predicted_quantity: it.quantity,
    predicted_unit: it.unit,
    predicted_package_quantity: it.package_quantity,
    predicted_brand: it.brand,
    predicted_expiry_date: it.expiry_date,
    category_hint: it.category_hint,
    restock_hint: it.restock_hint,
    confidence_json: it.confidence,
  }))

  const { data: items, error: itemsErr } = await service
    .from('recognition_items')
    .insert(itemRows)
    .select(
      'recognition_item_id, raw_name, predicted_name, predicted_quantity, predicted_unit, predicted_package_quantity, predicted_brand, predicted_expiry_date, category_hint, restock_hint, confidence_json'
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
      image_count: signedUrls.length,
      failed_images: aiResult.failed_images,
    },
  })

  // ── 重复检测（每个 item 都查一次） ──
  const itemsWithDup = await Promise.all(
    items.map(async (row: any) => {
      const dup = await checkDuplicate({
        householdId: household.household_id,
        candidateName: row.predicted_name ?? '',
        candidateBrand: row.predicted_brand ?? null,
      })
      return {
        recognition_item_id: row.recognition_item_id,
        name: row.predicted_name,
        brand: row.predicted_brand ?? null,
        quantity: row.predicted_quantity,
        unit: row.predicted_unit,
        package_quantity: row.predicted_package_quantity,
        expiry_date: row.predicted_expiry_date ?? null,
        confidence: row.confidence_json,
        raw_name: row.raw_name,
        category_hint: row.category_hint ?? null,
        restock_hint: row.restock_hint ?? null,
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
      image_url: signedUrls[0],
      image_urls: signedUrls,
      model: aiResult.model,
      duration_ms: aiResult.duration_ms,
    },
    quota,
    items: itemsWithDup,
  })
}

/** @deprecated 品牌/分类现在直接由 AI 返回并落库，不再从 raw 文本猜 */
