import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import {
  createSupabaseServerClient,
  getServiceRoleClient,
} from '@/lib/supabase/server'

/**
 * /api/recognition/[id]/draft — 确认页「暂存为草稿」（PRD §3.10）
 *
 * POST { decisions: [...] } — 把确认页当前编辑状态快照存到 task.draft_json，
 *                             task.status 置为 'draft'，saved_at 更新时间。
 * 恢复：打开 /confirm/[id] 时若 task.status === 'draft'，前端用 draft_json 初始化。
 */

const DraftDecisionSchema = z.object({
  recognition_item_id: z.string().uuid(),
  action: z.enum(['skip', 'keep_separate', 'merge']),
  final_name: z.string().trim().min(1).max(80),
  final_quantity: z.number().finite().min(0).max(9999),
  final_unit: z.string().trim().max(8).nullable().optional(),
  final_brand: z.string().trim().max(40).nullable().optional(),
  final_category_id: z.string().uuid().nullable().optional(),
  final_package_quantity: z.number().finite().positive().nullable().optional(),
  final_expiry_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  matched_item_id: z.string().uuid().nullable().optional(),
  restock_alert: z.boolean().optional(),
  corrected: z.boolean().optional(),
})

const BodySchema = z.object({
  decisions: z.array(DraftDecisionSchema).min(1).max(100),
})

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const recognitionId = params.id

  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  const parsed = BodySchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'decisions 字段不合法', issues: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const service = getServiceRoleClient()

  const { data: task, error: taskErr } = await service
    .from('recognition_tasks')
    .select('recognition_id, household_id, status')
    .eq('recognition_id', recognitionId)
    .maybeSingle()

  if (taskErr || !task) {
    return NextResponse.json({ error: 'task 不存在' }, { status: 404 })
  }

  const { data: household } = await supabase
    .from('households')
    .select('household_id')
    .eq('owner_id', user.id)
    .limit(1)
    .maybeSingle()

  if (!household || household.household_id !== task.household_id) {
    return NextResponse.json({ error: '无权限' }, { status: 403 })
  }

  if (task.status === 'confirmed') {
    return NextResponse.json({ error: '该批次已入库，不能暂存' }, { status: 409 })
  }

  const { error } = await service
    .from('recognition_tasks')
    .update({
      status: 'draft',
      draft_json: { decisions: parsed.data.decisions },
      saved_at: new Date().toISOString(),
    })
    .eq('recognition_id', recognitionId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
