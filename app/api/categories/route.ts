import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

/**
 * /api/categories — 分类字典（Sprint 1 给手动添加表单用）
 *
 * 返回系统预设分类（顶层 + 子分类）以及当前 household 用户自定义分类。
 * 树形结构：{ category_id, name, parent_id }
 */

interface CatRow {
  category_id: string
  name: string
  parent_id: string | null
  is_system: boolean
  sort_order: number
}

export async function GET() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { data: household } = await supabase
    .from('households')
    .select('household_id')
    .eq('owner_id', user.id)
    .limit(1)
    .maybeSingle()

  // 拿系统分类 + 当前 household 自定义分类
  const { data, error } = await supabase
    .from('categories')
    .select('category_id, name, parent_id, is_system, sort_order')
    .or(
      household
        ? `is_system.eq.true,household_id.eq.${household.household_id}`
        : 'is_system.eq.true'
    )
    .order('sort_order', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const flat: CatRow[] = data ?? []

  // 拼树
  const byId = new Map<string, CatRow & { children: CatRow[] }>()
  flat.forEach((c) => byId.set(c.category_id, { ...c, children: [] }))
  const tree: (CatRow & { children: CatRow[] })[] = []
  byId.forEach((c) => {
    if (c.parent_id && byId.has(c.parent_id)) {
      byId.get(c.parent_id)!.children.push(c)
    } else {
      tree.push(c)
    }
  })

  return NextResponse.json({ categories: tree })
}
