import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Create client with user's token to verify identity
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const { data: { user }, error: userError } = await userClient.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Get user's tenant
    const adminClient = createClient(supabaseUrl, serviceRoleKey)

    const { data: tenantData } = await adminClient
      .from('platform_users')
      .select('tenant_id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single()

    if (!tenantData?.tenant_id) {
      return new Response(JSON.stringify({ error: 'Tenant not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Check if user is admin
    const { data: roleData } = await adminClient
      .from('user_roles')
      .select('user_role')
      .eq('user_id', user.id)
      .single()

    if (!roleData || !['super_admin', 'branch_admin'].includes(roleData.user_role || '')) {
      return new Response(JSON.stringify({ error: 'Forbidden: Admin only' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const tenantId = tenantData.tenant_id
    const exportData: Record<string, any[]> = {}

    // Helper to fetch all rows (handling 1000 limit)
    async function fetchAll(table: string, filter: { column: string; value: string }, select = '*') {
      const allRows: any[] = []
      let from = 0
      const batchSize = 1000
      while (true) {
        const { data, error } = await adminClient
          .from(table)
          .select(select)
          .eq(filter.column, filter.value)
          .range(from, from + batchSize - 1)
        if (error) {
          console.error(`Error fetching ${table}:`, error.message)
          break
        }
        if (!data || data.length === 0) break
        allRows.push(...data)
        if (data.length < batchSize) break
        from += batchSize
      }
      return allRows
    }

    // Helper for tables filtered by tenant_id
    async function fetchTenantData(table: string, select = '*') {
      return fetchAll(table, { column: 'tenant_id', value: tenantId }, select)
    }

    // 1. Core tables with tenant_id
    const tenantTables = [
      'branches',
      'categories',
      'suppliers',
      'customers',
      'products',
      'import_receipts',
      'export_receipts',
      'cash_book',
      'cash_book_opening_balances',
      'debt_payments',
      'debt_settings',
      'customer_tags',
      'customer_sources',
      'customer_care_schedules',
      'customer_care_logs',
      'customer_vouchers',
      'care_reminders',
      'care_schedule_types',
      'export_returns',
      'import_returns',
      'return_payments',
      'invoice_templates',
      'stock_counts',
      'stock_transfer_items',
      'stock_transfer_requests',
      'landing_products',
      'landing_product_categories',
      'landing_orders',
      'voucher_templates',
      'custom_payment_sources',
      'staff_reviews',
      'staff_kpi_settings',
      'staff_performance_snapshots',
      'crm_notifications',
      'audit_logs',
      'einvoice_configs',
      'einvoices',
      'einvoice_logs',
      'tax_policy_articles',
      'custom_domains',
      'user_branch_access',
      'point_settings',
      'membership_tier_settings',
      'onboarding_tours',
      'push_subscriptions',
      'profiles',
      'email_queue',
      'onboarding_email_logs',
      'warranty_lookup_logs',
    ]

    for (const table of tenantTables) {
      try {
        exportData[table] = await fetchTenantData(table)
      } catch (e) {
        console.error(`Skipping ${table}:`, e)
        exportData[table] = []
      }
    }

    // 2. Tables without tenant_id - fetch via parent IDs
    // product_imports (linked to import_receipts)
    const importReceiptIds = (exportData['import_receipts'] || []).map((r: any) => r.id)
    if (importReceiptIds.length > 0) {
      const allProductImports: any[] = []
      for (let i = 0; i < importReceiptIds.length; i += 50) {
        const batch = importReceiptIds.slice(i, i + 50)
        const { data } = await adminClient
          .from('product_imports')
          .select('*')
          .in('import_receipt_id', batch)
        if (data) allProductImports.push(...data)
      }
      exportData['product_imports'] = allProductImports
    }

    // receipt_payments (linked to import_receipts)
    if (importReceiptIds.length > 0) {
      const allReceiptPayments: any[] = []
      for (let i = 0; i < importReceiptIds.length; i += 50) {
        const batch = importReceiptIds.slice(i, i + 50)
        const { data } = await adminClient
          .from('receipt_payments')
          .select('*')
          .in('receipt_id', batch)
        if (data) allReceiptPayments.push(...data)
      }
      exportData['receipt_payments'] = allReceiptPayments
    }

    // export_receipt_items (linked to export_receipts)
    const exportReceiptIds = (exportData['export_receipts'] || []).map((r: any) => r.id)
    if (exportReceiptIds.length > 0) {
      const allExportItems: any[] = []
      for (let i = 0; i < exportReceiptIds.length; i += 50) {
        const batch = exportReceiptIds.slice(i, i + 50)
        const { data } = await adminClient
          .from('export_receipt_items')
          .select('*')
          .in('receipt_id', batch)
        if (data) allExportItems.push(...data)
      }
      exportData['export_receipt_items'] = allExportItems
    }

    // export_receipt_payments (linked to export_receipts)
    if (exportReceiptIds.length > 0) {
      const allExportPayments: any[] = []
      for (let i = 0; i < exportReceiptIds.length; i += 50) {
        const batch = exportReceiptIds.slice(i, i + 50)
        const { data } = await adminClient
          .from('export_receipt_payments')
          .select('*')
          .in('receipt_id', batch)
        if (data) allExportPayments.push(...data)
      }
      exportData['export_receipt_payments'] = allExportPayments
    }

    // einvoice_items (linked to einvoices)
    const einvoiceIds = (exportData['einvoices'] || []).map((r: any) => r.id)
    if (einvoiceIds.length > 0) {
      const allEinvoiceItems: any[] = []
      for (let i = 0; i < einvoiceIds.length; i += 50) {
        const batch = einvoiceIds.slice(i, i + 50)
        const { data } = await adminClient
          .from('einvoice_items')
          .select('*')
          .in('einvoice_id', batch)
        if (data) allEinvoiceItems.push(...data)
      }
      exportData['einvoice_items'] = allEinvoiceItems
    }

    // stock_count_items (linked to stock_counts)
    const stockCountIds = (exportData['stock_counts'] || []).map((r: any) => r.id)
    if (stockCountIds.length > 0) {
      const allStockCountItems: any[] = []
      for (let i = 0; i < stockCountIds.length; i += 50) {
        const batch = stockCountIds.slice(i, i + 50)
        const { data } = await adminClient
          .from('stock_count_items')
          .select('*')
          .in('stock_count_id', batch)
        if (data) allStockCountItems.push(...data)
      }
      exportData['stock_count_items'] = allStockCountItems
    }

    // customer_tag_assignments (linked to customers)
    const customerIds = (exportData['customers'] || []).map((r: any) => r.id)
    if (customerIds.length > 0) {
      const allTagAssignments: any[] = []
      for (let i = 0; i < customerIds.length; i += 50) {
        const batch = customerIds.slice(i, i + 50)
        const { data } = await adminClient
          .from('customer_tag_assignments')
          .select('*')
          .in('customer_id', batch)
        if (data) allTagAssignments.push(...data)
      }
      exportData['customer_tag_assignments'] = allTagAssignments
    }

    // customer_contact_channels (linked to customers)
    if (customerIds.length > 0) {
      const allChannels: any[] = []
      for (let i = 0; i < customerIds.length; i += 50) {
        const batch = customerIds.slice(i, i + 50)
        const { data } = await adminClient
          .from('customer_contact_channels')
          .select('*')
          .in('customer_id', batch)
        if (data) allChannels.push(...data)
      }
      exportData['customer_contact_channels'] = allChannels
    }

    // debt_tag_assignments & debt_tags (linked to debt_payments entity_id)
    exportData['debt_tags'] = await fetchTenantData('debt_tags') || []

    // imei_histories (linked to products)
    const productIds = (exportData['products'] || []).map((r: any) => r.id)
    if (productIds.length > 0) {
      const allImeiHistories: any[] = []
      for (let i = 0; i < productIds.length; i += 50) {
        const batch = productIds.slice(i, i + 50)
        const { data } = await adminClient
          .from('imei_histories')
          .select('*')
          .in('product_id', batch)
        if (data) allImeiHistories.push(...data)
      }
      exportData['imei_histories'] = allImeiHistories
    }

    // user_roles for this tenant
    exportData['user_roles'] = await fetchTenantData('user_roles')

    // platform_users for this tenant
    exportData['platform_users'] = await fetchTenantData('platform_users')

    // tenant_landing_settings
    exportData['tenant_landing_settings'] = await fetchTenantData('tenant_landing_settings')

    // point_transactions (linked to customers)
    if (customerIds.length > 0) {
      const allPointTx: any[] = []
      for (let i = 0; i < customerIds.length; i += 50) {
        const batch = customerIds.slice(i, i + 50)
        const { data } = await adminClient
          .from('point_transactions')
          .select('*')
          .in('customer_id', batch)
        if (data) allPointTx.push(...data)
      }
      exportData['point_transactions'] = allPointTx
    }

    // Summary
    const summary: Record<string, number> = {}
    let totalRows = 0
    for (const [table, rows] of Object.entries(exportData)) {
      summary[table] = rows.length
      totalRows += rows.length
    }

    const result = {
      _metadata: {
        tenant_id: tenantId,
        exported_at: new Date().toISOString(),
        total_tables: Object.keys(exportData).length,
        total_rows: totalRows,
        summary,
      },
      data: exportData,
    }

    return new Response(JSON.stringify(result), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="tenant_export_${tenantId}_${new Date().toISOString().slice(0, 10)}.json"`,
      },
    })
  } catch (error) {
    console.error('Export error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
