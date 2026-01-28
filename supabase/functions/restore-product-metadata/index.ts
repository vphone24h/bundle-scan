import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type IncomingRow = {
  imei: string
  name: string
  sku: string
  supplierName?: string | null
  note?: string | null
  importDate?: string | null // dd/mm/yyyy
  status?: string | null
}

function normalize(v: unknown) {
  return String(v ?? '').trim()
}

function parseDDMMYYYY(dateStr: string | null | undefined): number {
  const s = normalize(dateStr)
  // expected dd/mm/yyyy
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!m) return 0
  const dd = Number(m[1])
  const mm = Number(m[2])
  const yyyy = Number(m[3])
  const d = new Date(Date.UTC(yyyy, mm - 1, dd))
  return Number.isFinite(d.getTime()) ? d.getTime() : 0
}

function isEmptyNote(v: unknown) {
  return normalize(v) === ''
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Không có quyền truy cập' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      db: { schema: 'public' },
    })

    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const { data: { user: caller }, error: callerError } = await supabaseClient.auth.getUser()
    if (callerError || !caller) {
      return new Response(JSON.stringify({ error: 'Không thể xác thực người dùng' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body = await req.json()
    const tenantId = normalize(body?.tenantId)
    const fillMode = normalize(body?.fillMode) || 'fill_missing_only'
    const matchRule = normalize(body?.matchRule) || 'imei_name_sku'
    const duplicateRule = normalize(body?.duplicateRule) || 'latest'
    const incomingRows = (body?.rows ?? []) as IncomingRow[]

    if (!tenantId) {
      return new Response(JSON.stringify({ error: 'Thiếu tenantId' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    if (!Array.isArray(incomingRows) || incomingRows.length === 0) {
      return new Response(JSON.stringify({ error: 'Thiếu rows' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    if (matchRule !== 'imei_name_sku') {
      return new Response(JSON.stringify({ error: 'matchRule không hợp lệ' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    if (duplicateRule !== 'latest') {
      return new Response(JSON.stringify({ error: 'duplicateRule không hợp lệ' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Permission: only super_admin or platform_admin, and must belong to tenant
    const { data: userRole } = await supabaseAdmin
      .from('user_roles')
      .select('tenant_id, user_role')
      .eq('user_id', caller.id)
      .eq('tenant_id', tenantId)
      .maybeSingle()

    const { data: platformUser } = await supabaseAdmin
      .from('platform_users')
      .select('tenant_id, platform_role')
      .eq('user_id', caller.id)
      .eq('tenant_id', tenantId)
      .maybeSingle()

    const isSuperAdmin = userRole?.user_role === 'super_admin'
    const isPlatformAdmin = platformUser?.platform_role === 'platform_admin'
    if (!isSuperAdmin && !isPlatformAdmin) {
      return new Response(JSON.stringify({ error: 'Chỉ Super Admin/Platform Admin mới có quyền thực hiện' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Deduplicate by (imei|name|sku) and take latest by importDate
    const dedup = new Map<string, { row: IncomingRow; ts: number }>()
    for (const r of incomingRows) {
      const imei = normalize(r.imei)
      const name = normalize(r.name)
      const sku = normalize(r.sku)
      if (!imei || !name || !sku) continue
      const key = `${imei}|${name}|${sku}`
      const ts = parseDDMMYYYY(r.importDate)
      const current = dedup.get(key)
      if (!current || ts >= current.ts) {
        dedup.set(key, { row: { ...r, imei, name, sku }, ts })
      }
    }

    const rows = Array.from(dedup.values()).map((v) => v.row)
    if (rows.length === 0) {
      return new Response(JSON.stringify({ processed: 0, updated: 0, notFound: 0, supplierCreated: 0 }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Supplier mapping (case-insensitive match, trim)
    const { data: existingSuppliers, error: suppliersError } = await supabaseAdmin
      .from('suppliers')
      .select('id, name')
      .eq('tenant_id', tenantId)

    if (suppliersError) throw suppliersError

    const supplierMap = new Map<string, string>()
    for (const s of existingSuppliers ?? []) {
      supplierMap.set(normalize(s.name).toLowerCase(), s.id)
    }

    const supplierNames = Array.from(
      new Set(
        rows
          .map((r) => normalize(r.supplierName))
          .filter((v) => v !== '')
          .map((v) => v.toLowerCase()),
      ),
    )

    let supplierCreated = 0
    for (const sn of supplierNames) {
      if (supplierMap.has(sn)) continue
      const originalName = rows.find((r) => normalize(r.supplierName).toLowerCase() === sn)?.supplierName
      const { data: created, error: createError } = await supabaseAdmin
        .from('suppliers')
        .insert([{ tenant_id: tenantId, name: normalize(originalName) }])
        .select('id, name')
        .single()
      if (createError) throw createError
      supplierCreated += 1
      supplierMap.set(normalize(created.name).toLowerCase(), created.id)
    }

    // Fetch products by IMEI in batches (PostgREST limit considerations)
    const uniqueImeis = Array.from(new Set(rows.map((r) => normalize(r.imei)).filter(Boolean)))
    const productIndex = new Map<string, { id: string; supplier_id: string | null; note: string | null }>()

    for (const group of chunk(uniqueImeis, 500)) {
      const { data: prods, error: prodErr } = await supabaseAdmin
        .from('products')
        .select('id, imei, name, sku, supplier_id, note')
        .eq('tenant_id', tenantId)
        .in('imei', group)
      if (prodErr) throw prodErr
      for (const p of prods ?? []) {
        const key = `${normalize(p.imei)}|${normalize(p.name)}|${normalize(p.sku)}`
        // If duplicates exist in DB, keep the first one; updates will still be safe (by id)
        if (!productIndex.has(key)) {
          productIndex.set(key, { id: p.id, supplier_id: p.supplier_id ?? null, note: p.note ?? null })
        }
      }
    }

    let updated = 0
    let notFound = 0

    for (const r of rows) {
      const key = `${normalize(r.imei)}|${normalize(r.name)}|${normalize(r.sku)}`
      const p = productIndex.get(key)
      if (!p) {
        notFound += 1
        continue
      }

      const supplierId = normalize(r.supplierName) ? supplierMap.get(normalize(r.supplierName).toLowerCase()) ?? null : null
      const note = normalize(r.note) || null

      const updates: Record<string, unknown> = {}

      if (fillMode === 'fill_missing_only') {
        if (!p.supplier_id && supplierId) updates.supplier_id = supplierId
        if (isEmptyNote(p.note) && note) updates.note = note
      } else {
        // fallback for future
        if (supplierId) updates.supplier_id = supplierId
        updates.note = note
      }

      if (Object.keys(updates).length === 0) continue

      const { error: updErr } = await supabaseAdmin.from('products').update(updates).eq('id', p.id)
      if (updErr) throw updErr
      updated += 1
    }

    await supabaseAdmin.from('audit_logs').insert({
      tenant_id: tenantId,
      user_id: caller.id,
      action_type: 'RESTORE_PRODUCT_METADATA',
      table_name: 'products',
      description: `Phục hồi NCC/Ghi chú từ file cũ: processed=${rows.length}, updated=${updated}, notFound=${notFound}, supplierCreated=${supplierCreated}`,
      new_data: { processed: rows.length, updated, notFound, supplierCreated, matchRule, duplicateRule, fillMode },
    })

    return new Response(JSON.stringify({ processed: rows.length, updated, notFound, supplierCreated }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(JSON.stringify({ error: 'Lỗi hệ thống: ' + (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
