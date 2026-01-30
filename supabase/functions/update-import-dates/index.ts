import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type IncomingRow = {
  imei: string
  importDate: string // dd/mm/yyyy
}

function normalize(v: unknown) {
  return String(v ?? '').trim()
}

function parseDDMMYYYY(dateStr: string | null | undefined): Date | null {
  const s = normalize(dateStr)
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!m) return null
  const dd = Number(m[1])
  const mm = Number(m[2])
  const yyyy = Number(m[3])
  const d = new Date(Date.UTC(yyyy, mm - 1, dd, 12, 0, 0))
  return Number.isFinite(d.getTime()) ? d : null
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
    const incomingRows = (body?.rows ?? []) as IncomingRow[]
    const dryRun = body?.dryRun === true

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

    // Permission check
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
      .maybeSingle()

    const isSuperAdmin = userRole?.user_role === 'super_admin'
    const isBranchAdmin = userRole?.user_role === 'branch_admin'
    const isPlatformAdmin = platformUser?.platform_role === 'platform_admin'
    if (!isSuperAdmin && !isBranchAdmin && !isPlatformAdmin) {
      return new Response(JSON.stringify({ error: 'Chỉ Super Admin/Branch Admin/Platform Admin mới có quyền thực hiện' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Build IMEI -> date map
    const imeiDateMap = new Map<string, Date>()
    for (const r of incomingRows) {
      const imei = normalize(r.imei)
      if (!imei) continue
      const date = parseDDMMYYYY(r.importDate)
      if (!date) continue
      const existing = imeiDateMap.get(imei)
      if (!existing || date.getTime() > existing.getTime()) {
        imeiDateMap.set(imei, date)
      }
    }

    if (imeiDateMap.size === 0) {
      return new Response(JSON.stringify({ processed: 0, updated: 0, notFound: 0 }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Fetch products by IMEI
    const uniqueImeis = Array.from(imeiDateMap.keys())
    const productList: { id: string; imei: string; import_date: string }[] = []

    for (const group of chunk(uniqueImeis, 500)) {
      const { data: prods, error: prodErr } = await supabaseAdmin
        .from('products')
        .select('id, imei, import_date')
        .eq('tenant_id', tenantId)
        .in('imei', group)
      if (prodErr) throw prodErr
      productList.push(...(prods ?? []))
    }

    // Build imei -> product id map
    const imeiProductMap = new Map<string, string>()
    for (const p of productList) {
      if (p.imei) {
        imeiProductMap.set(normalize(p.imei), p.id)
      }
    }

    let notFound = 0
    const updates: { productId: string; newDate: Date }[] = []

    for (const [imei, newDate] of imeiDateMap.entries()) {
      const productId = imeiProductMap.get(imei)
      if (!productId) {
        notFound += 1
        continue
      }
      updates.push({ productId, newDate })
    }

    if (!dryRun) {
      for (const batch of chunk(updates, 50)) {
        await Promise.all(
          batch.map(async ({ productId, newDate }) => {
            const { error } = await supabaseAdmin
              .from('products')
              .update({ import_date: newDate.toISOString() })
              .eq('id', productId)
            if (error) throw error
          })
        )
      }
    }

    const updated = updates.length

    if (!dryRun) {
      await supabaseAdmin.from('audit_logs').insert({
        tenant_id: tenantId,
        user_id: caller.id,
        action_type: 'UPDATE_IMPORT_DATES',
        table_name: 'products',
        description: `Cập nhật ngày nhập từ file cũ: processed=${imeiDateMap.size}, updated=${updated}, notFound=${notFound}`,
        new_data: { processed: imeiDateMap.size, updated, notFound },
      })
    }

    return new Response(JSON.stringify({ 
      processed: imeiDateMap.size, 
      updated, 
      notFound,
      dryRun
    }), {
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
