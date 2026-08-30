import { NextResponse, type NextRequest } from 'next/server'
import {
  createSupabaseServerClient,
  getServiceRoleClient,
} from '@/lib/supabase/server'
import { getSignedImageUrl } from '@/lib/supabase/storage'
import { checkDuplicate } from '@/lib/recognition/duplicate'

/**
 * /api/recognition/[id] — 读识别任务详情（含所有 items + 重复状态）
 *
 * GET 用于刷新确认页 / 重新选 category
 */

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params

  const supabase = await createSupabaseServerClient() as any
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const service = getServiceRoleClient() as any

  const { data: task, error: taskErr } = await service
    .from('recognition_tasks')
    .select('*')
    .eq('recognition_id', id)
    .maybeSingle()

  if (taskErr || !task) {
    return NextResponse.json({ error: 'task 不存在' }, { status: 404 })
  }
  // 隔离：household_id 校验
  if (task.household_id !== user.id) {
    // 用当前用户的 household_id 再校一次
    const { data: hh } = await service
      .from('households')
      .select('household_id')
      .eq('owner_id', user.id)
      .limit(1)
      .maybeSingle()
    if (!hh || hh.household_id !== task.household_id) {
      return NextResponse.json({ error: '无权限访问该任务' }, { status: 403 })
    }
  }

  const { data: items } = await service
    .from('recognition_items')
    .select('*')
    .eq('recognition_id', id)
    .order('created_at', { ascending: true })

  // 重新跑重复检测（用户可能编辑过字段名/品牌）
  const itemsWithDup = await Promise.all(
    (items ?? []).map(async (row: any) => {
      const finalName = row.final_name ?? row.predicted_name ?? ''
      const dup = await checkDuplicate({
        householdId: task.household_id,
        candidateName: finalName,
        candidateBrand: row.final_name ? null : null, // brand 暂不存
      })
      return {
        ...row,
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

  // 取临时签名 URL，前端用来预览（多图批次把每张都签出来）
  const paths: string[] =
    Array.isArray(task.image_paths) && task.image_paths.length > 0
      ? task.image_paths
      : task.image_url
        ? [task.image_url]
        : []
  const signedList = await Promise.all(
    paths.map((p) => getSignedImageUrl(p, 60 * 10))
  )
  const imageUrls = signedList
    .map((s) => s.url)
    .filter((u): u is string => typeof u === 'string')
  const imageUrl = imageUrls[0] ?? null

  return NextResponse.json({
    task: {
      ...task,
      image_url_preview: imageUrl,
      image_urls_preview: imageUrls,
    },
    items: itemsWithDup,
  })
}
