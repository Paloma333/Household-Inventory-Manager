import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

/**
 * /api/export — 导出我的库存（PRD §3.8）
 *
 * GET ?format=csv|json
 *  - csv  : items.csv，UTF-8 BOM（Excel 打开中文不乱码）
 *  - json : 完整快照 { exported_at, items, events }
 */

export async function GET(request: NextRequest) {
  const format = request.nextUrl.searchParams.get('format') ?? 'csv'
  if (format !== 'csv' && format !== 'json') {
    return NextResponse.json({ error: 'format 只支持 csv / json' }, { status: 400 })
  }

  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { data: household } = await supabase
    .from('households')
    .select('household_id, name')
    .eq('owner_id', user.id)
    .limit(1)
    .maybeSingle()

  if (!household) {
    return NextResponse.json({ error: '家还没建好' }, { status: 404 })
  }

  const { data: items, error: itemErr } = await supabase
    .from('items')
    .select(
      `
      item_id, canonical_name, raw_name, brand, quantity, unit,
      package_quantity, expiry_date, deleted_at, created_at, updated_at,
      categories:category_id ( name )
    `
    )
    .eq('household_id', household.household_id)
    .order('created_at', { ascending: false })

  if (itemErr) {
    return NextResponse.json({ error: itemErr.message }, { status: 500 })
  }

  const fileName = `小家库存-${new Date().toISOString().slice(0, 10)}`

  if (format === 'json') {
    const { data: events } = await supabase
      .from('inventory_events')
      .select('*')
      .eq('household_id', household.household_id)
      .order('created_at', { ascending: false })
      .limit(2000)

    const snapshot = {
      exported_at: new Date().toISOString(),
      household: household.name,
      items: items ?? [],
      events: events ?? [],
    }
    return new NextResponse(JSON.stringify(snapshot, null, 2), {
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'content-disposition': `attachment; filename="${fileName}.json"`,
      },
    })
  }

  // CSV：BOM + RFC 4180 转义
  const esc = (v: unknown) => {
    if (v === null || v === undefined) return ''
    const s = String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }

  const header = [
    '名称', '品牌', '数量', '单位', '包装数量', '过期日', '分类',
    '创建时间', '更新时间', '状态',
  ]
  const rows = (items ?? []).map((it: any) => [
    it.canonical_name,
    it.brand ?? '',
    it.quantity,
    it.unit ?? '',
    it.package_quantity ?? '',
    it.expiry_date ?? '',
    it.categories?.name ?? '',
    it.created_at,
    it.updated_at,
    it.deleted_at ? '已删除' : '在库',
  ])

  const csv =
    '\uFEFF' +
    [header, ...rows].map((r) => r.map(esc).join(',')).join('\n')

  return new NextResponse(csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${fileName}.csv"`,
    },
  })
}
