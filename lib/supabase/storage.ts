import 'server-only'
import { getServiceRoleClient } from '@/lib/supabase/server'

/**
 * Supabase Storage helper — 专门处理 AI 识别图片
 *
 * 用法只发生在服务端 API route，不暴露给浏览器
 *
 * Bucket 名：`recognition-images`
 *   - private（不能 list，需要 signed URL）
 *   - 30 天自动删除（管理 API 配置 lifecycle）
 *   - 路径：`{user_id}/{household_id}/{ts}-{rand}.{ext}`
 *
 * 创建/配置 bucket（首次部署时）：
 *   POST /v1/projects/{REF}/storage/buckets
 *   { "name": "recognition-images", "public": false, "file_size_limit": 10485760 }
 *   然后 lifecycle policy 30d delete via management API 或 SQL 函数
 */

const BUCKET = 'recognition-images'
const MAX_SIZE_BYTES = 10 * 1024 * 1024 // 10MB
const SIGNED_URL_TTL_S = 60 * 60 // 1 小时

const ALLOWED_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
}

/**
 * 上传识别图片到 Storage
 * 返回 { path, mime, size, error }
 */
export async function uploadRecognitionImage(opts: {
  userId: string
  householdId: string
  buffer: Buffer
  mimeType: string
}) {
  const { userId, householdId, buffer, mimeType } = opts

  const ext = ALLOWED_TYPES[mimeType]
  if (!ext) {
    return {
      path: null,
      mime: mimeType,
      size: buffer.length,
      error: `不支持的图片类型 ${mimeType}（仅 jpg/png/webp/heic）`,
    }
  }
  if (buffer.length > MAX_SIZE_BYTES) {
    return {
      path: null,
      mime: mimeType,
      size: buffer.length,
      error: `图片太大 ${(buffer.length / 1024 / 1024).toFixed(1)}MB > 10MB`,
    }
  }

  const supabase = getServiceRoleClient()
  const ts = Date.now()
  const rand = Math.random().toString(36).slice(2, 8)
  const path = `${userId}/${householdId}/${ts}-${rand}.${ext}`

  const { error } = await supabase.storage.from(BUCKET).upload(path, buffer, {
    contentType: mimeType,
    upsert: false,
    cacheControl: '3600',
  })

  if (error) {
    // 常见错误：bucket 不存在 / RLS 拒
    return {
      path: null,
      mime: mimeType,
      size: buffer.length,
      error: `上传失败：${error.message}。如果提示 bucket 不存在，请先在 Supabase Dashboard 创建 ${BUCKET}（private, 10MB 限制）。`,
    }
  }

  return { path, mime: mimeType, size: buffer.length, error: null }
}

/**
 * 短期签名 URL（默认 1 小时，用于 AI 模型调用与前端预览）
 */
export async function getSignedImageUrl(path: string, ttlS = SIGNED_URL_TTL_S) {
  const supabase = getServiceRoleClient()
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, ttlS)

  if (error) {
    return { url: null, error: error.message }
  }
  return { url: data.signedUrl, error: null }
}

/**
 * 删除图片（清理失败 / 用户撤销时）
 */
export async function deleteRecognitionImage(path: string) {
  const supabase = getServiceRoleClient()
  const { error } = await supabase.storage.from(BUCKET).remove([path])
  return { error: error?.message ?? null }
}

export const RECOGNITION_BUCKET = BUCKET
export const RECOGNITION_MAX_SIZE = MAX_SIZE_BYTES
