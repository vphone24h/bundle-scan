import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const { data: { user }, error: userError } = await userClient.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey)

    const { data: tenantData } = await adminClient
      .from('platform_users')
      .select('tenant_id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single()

    if (!tenantData?.tenant_id) {
      return new Response(JSON.stringify({ error: 'Tenant not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: roleData } = await adminClient
      .from('user_roles')
      .select('user_role')
      .eq('user_id', user.id)
      .single()

    if (!roleData || !['super_admin', 'branch_admin'].includes(roleData.user_role || '')) {
      return new Response(JSON.stringify({ error: 'Forbidden: Admin only' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const tenantId = tenantData.tenant_id

    // Parse section from body
    let section = 'all'
    let parentIds: string[] = []
    try {
      const body = await req.json()
      section = body?.section || 'all'
      parentIds = body?.parentIds || []
    } catch { /* no body = fetch all (legacy) */ }

    // Helper to fetch all rows with pagination
    async function fetchAll(table: string, filterCol: string, filterVal: string, select = '*') {
      const allRows: any[] = []
      let from = 0
      const batchSize = 1000
      while (true) {
        const { data, error } = await adminClient
          .from(table)
          .select(select)
          .eq(filterCol, filterVal)
          .range(from, from + batchSize - 1)
        if (error) throw error
        if (!data || data.length === 0) break
        allRows.push(...data)
        if (data.length < batchSize) break
        from += batchSize
      }
      return allRows
    }

    async function fetchByIds(table: string, filterCol: string, ids: string[], select = '*') {
      const allRows: any[] = []
      for (let i = 0; i < ids.length; i += 100) {
        const batch = ids.slice(i, i + 100)
        const { data, error } = await adminClient
          .from(table)
          .select(select)
          .in(filterCol, batch)
        if (error) throw error
        if (data) allRows.push(...data)
      }
      return allRows
    }

    const ok = (data: any) => new Response(JSON.stringify(data), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

    // Section-based export
    switch (section) {
      case 'init': {
        const { data: tenant } = await adminClient
          .from('tenants')
          .select('*')
          .eq('id', tenantId)
          .single()

        const [branches, categories] = await Promise.all([
          fetchAll('branches', 'tenant_id', tenantId),
          fetchAll('categories', 'tenant_id', tenantId),
        ])

        return ok({ tenant, branches, categories })
      }

      case 'suppliers': {
        const data = await fetchAll('suppliers', 'tenant_id', tenantId)
        return ok({ suppliers: data })
      }

      case 'customers': {
        const data = await fetchAll('customers', 'tenant_id', tenantId)
        return ok({ customers: data })
      }

      case 'products': {
        const data = await fetchAll('products', 'tenant_id', tenantId)
        return ok({ products: data })
      }

      case 'import_receipts': {
        const data = await fetchAll('import_receipts', 'tenant_id', tenantId)
        return ok({ import_receipts: data })
      }

      case 'export_receipts': {
        const data = await fetchAll('export_receipts', 'tenant_id', tenantId)
        return ok({ export_receipts: data })
      }

      case 'export_child_records': {
        // parentIds = export receipt IDs
        let items: any[] = []
        let payments: any[] = []
        if (parentIds.length > 0) {
          items = await fetchByIds('export_receipt_items', 'receipt_id', parentIds)
          payments = await fetchByIds('export_receipt_payments', 'receipt_id', parentIds)
        }
        return ok({ export_receipt_items: items, export_receipt_payments: payments })
      }

      case 'imei_histories': {
        // parentIds = product IDs
        let data: any[] = []
        if (parentIds.length > 0) {
          data = await fetchByIds('imei_histories', 'product_id', parentIds)
        }
        return ok({ imei_histories: data })
      }

      case 'cash_debt': {
        const [cashBook, debtPayments] = await Promise.all([
          fetchAll('cash_book', 'tenant_id', tenantId),
          fetchAll('debt_payments', 'tenant_id', tenantId),
        ])
        return ok({ cash_book: cashBook, debt_payments: debtPayments })
      }

      case 'web_config': {
        const { data: landingSettings } = await adminClient
          .from('tenant_landing_settings')
          .select('*')
          .eq('tenant_id', tenantId)
          .maybeSingle()
        return ok({ web_config: landingSettings })
      }

      case 'finalize': {
        // Log the export
        await adminClient.from('audit_logs').insert({
          tenant_id: tenantId,
          user_id: user.id,
          action_type: 'CROSS_PLATFORM_EXPORT',
          table_name: 'ALL',
          description: `Xuất dữ liệu cross-platform JSON v2.0 (chunked)`,
        })
        return ok({ success: true })
      }

      default: {
        // Legacy: fetch all at once (backward compat)
        // Not recommended for large data
        return new Response(JSON.stringify({ error: 'Invalid section. Use: init, suppliers, customers, products, import_receipts, export_receipts, export_child_records, imei_histories, cash_debt, web_config, finalize' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

  } catch (error) {
    console.error('Cross-platform export error:', error)
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
