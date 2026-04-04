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

    let section = 'all'
    let parentIds: string[] = []
    try {
      const body = await req.json()
      section = body?.section || 'all'
      parentIds = body?.parentIds || []
    } catch { /* no body */ }

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
        const [products, product_groups] = await Promise.all([
          fetchAll('products', 'tenant_id', tenantId),
          fetchAll('product_groups', 'tenant_id', tenantId),
        ])
        return ok({ products, product_groups })
      }

      case 'import_receipts': {
        const import_receipts = await fetchAll('import_receipts', 'tenant_id', tenantId)
        // receipt_payments and product_imports don't have tenant_id, fetch by parent IDs
        const receiptIds = import_receipts.map((r: any) => r.id)
        let receipt_payments: any[] = []
        let product_imports: any[] = []
        if (receiptIds.length > 0) {
          ;[receipt_payments, product_imports] = await Promise.all([
            fetchByIds('receipt_payments', 'receipt_id', receiptIds),
            fetchByIds('product_imports', 'import_receipt_id', receiptIds),
          ])
        }
        return ok({ import_receipts, receipt_payments, product_imports })
      }

      case 'export_receipts': {
        const data = await fetchAll('export_receipts', 'tenant_id', tenantId)
        return ok({ export_receipts: data })
      }

      case 'export_child_records': {
        let items: any[] = []
        let payments: any[] = []
        if (parentIds.length > 0) {
          ;[items, payments] = await Promise.all([
            fetchByIds('export_receipt_items', 'receipt_id', parentIds),
            fetchByIds('export_receipt_payments', 'receipt_id', parentIds),
          ])
        }
        return ok({ export_receipt_items: items, export_receipt_payments: payments })
      }

      case 'returns': {
        const [export_returns, import_returns, return_payments] = await Promise.all([
          fetchAll('export_returns', 'tenant_id', tenantId),
          fetchAll('import_returns', 'tenant_id', tenantId),
          fetchAll('return_payments', 'tenant_id', tenantId),
        ])
        return ok({ export_returns, import_returns, return_payments })
      }

      case 'stock': {
        const [stock_counts, stock_count_items, stock_transfer_requests, stock_transfer_items] = await Promise.all([
          fetchAll('stock_counts', 'tenant_id', tenantId),
          fetchAll('stock_count_items', 'tenant_id', tenantId),
          fetchAll('stock_transfer_requests', 'tenant_id', tenantId),
          fetchAll('stock_transfer_items', 'tenant_id', tenantId),
        ])
        return ok({ stock_counts, stock_count_items, stock_transfer_requests, stock_transfer_items })
      }

      case 'imei_histories': {
        let data: any[] = []
        if (parentIds.length > 0) {
          data = await fetchByIds('imei_histories', 'product_id', parentIds)
        }
        return ok({ imei_histories: data })
      }

      case 'cash_debt': {
        const [cash_book, debt_payments, cash_book_opening_balances, debt_offsets, debt_settings, debt_tags, debt_tag_assignments] = await Promise.all([
          fetchAll('cash_book', 'tenant_id', tenantId),
          fetchAll('debt_payments', 'tenant_id', tenantId),
          fetchAll('cash_book_opening_balances', 'tenant_id', tenantId),
          fetchAll('debt_offsets', 'tenant_id', tenantId),
          fetchAll('debt_settings', 'tenant_id', tenantId),
          fetchAll('debt_tags', 'tenant_id', tenantId),
          fetchAll('debt_tag_assignments', 'tenant_id', tenantId),
        ])
        return ok({ cash_book, debt_payments, cash_book_opening_balances, debt_offsets, debt_settings, debt_tags, debt_tag_assignments })
      }

      case 'crm': {
        const [
          customer_care_schedules, customer_care_logs, care_reminders, care_schedule_types,
          customer_tags, customer_tag_assignments, customer_sources,
          customer_contact_channels, customer_vouchers,
          point_settings, point_transactions, membership_tier_settings,
          crm_notifications,
        ] = await Promise.all([
          fetchAll('customer_care_schedules', 'tenant_id', tenantId),
          fetchAll('customer_care_logs', 'tenant_id', tenantId),
          fetchAll('care_reminders', 'tenant_id', tenantId),
          fetchAll('care_schedule_types', 'tenant_id', tenantId),
          fetchAll('customer_tags', 'tenant_id', tenantId),
          fetchAll('customer_tag_assignments', 'tenant_id', tenantId),
          fetchAll('customer_sources', 'tenant_id', tenantId),
          fetchAll('customer_contact_channels', 'tenant_id', tenantId),
          fetchAll('customer_vouchers', 'tenant_id', tenantId),
          fetchAll('point_settings', 'tenant_id', tenantId),
          fetchAll('point_transactions', 'tenant_id', tenantId),
          fetchAll('membership_tier_settings', 'tenant_id', tenantId),
          fetchAll('crm_notifications', 'tenant_id', tenantId),
        ])
        return ok({
          customer_care_schedules, customer_care_logs, care_reminders, care_schedule_types,
          customer_tags, customer_tag_assignments, customer_sources,
          customer_contact_channels, customer_vouchers,
          point_settings, point_transactions, membership_tier_settings,
          crm_notifications,
        })
      }

      case 'staff': {
        const [staff_reviews, staff_kpi_settings, staff_performance_snapshots] = await Promise.all([
          fetchAll('staff_reviews', 'tenant_id', tenantId),
          fetchAll('staff_kpi_settings', 'tenant_id', tenantId),
          fetchAll('staff_performance_snapshots', 'tenant_id', tenantId),
        ])
        return ok({ staff_reviews, staff_kpi_settings, staff_performance_snapshots })
      }

      case 'settings': {
        const [
          custom_payment_sources, invoice_templates, voucher_templates,
          einvoice_configs, notification_automations, custom_domains,
          user_branch_access, user_roles, security_passwords, payment_config,
        ] = await Promise.all([
          fetchAll('custom_payment_sources', 'tenant_id', tenantId),
          fetchAll('invoice_templates', 'tenant_id', tenantId),
          fetchAll('voucher_templates', 'tenant_id', tenantId),
          fetchAll('einvoice_configs', 'tenant_id', tenantId),
          fetchAll('notification_automations', 'tenant_id', tenantId),
          fetchAll('custom_domains', 'tenant_id', tenantId),
          fetchAll('user_branch_access', 'tenant_id', tenantId),
          fetchAll('user_roles', 'tenant_id', tenantId),
          fetchAll('security_passwords', 'tenant_id', tenantId),
          fetchAll('payment_config', 'tenant_id', tenantId),
        ])
        return ok({
          custom_payment_sources, invoice_templates, voucher_templates,
          einvoice_configs, notification_automations, custom_domains,
          user_branch_access, user_roles_backup: user_roles, security_passwords, payment_config,
        })
      }

      case 'landing': {
        const [
          landing_products, landing_product_categories, landing_orders,
          landing_articles, landing_article_categories,
          landing_product_blocked_dates, landing_order_email_logs,
        ] = await Promise.all([
          fetchAll('landing_products', 'tenant_id', tenantId),
          fetchAll('landing_product_categories', 'tenant_id', tenantId),
          fetchAll('landing_orders', 'tenant_id', tenantId),
          fetchAll('landing_articles', 'tenant_id', tenantId),
          fetchAll('landing_article_categories', 'tenant_id', tenantId),
          fetchAll('landing_product_blocked_dates', 'tenant_id', tenantId),
          fetchAll('landing_order_email_logs', 'tenant_id', tenantId),
        ])
        return ok({
          landing_products, landing_product_categories, landing_orders,
          landing_articles, landing_article_categories,
          landing_product_blocked_dates, landing_order_email_logs,
        })
      }

      case 'shop_ctv': {
        const [shop_collaborators, shop_ctv_orders, shop_ctv_settings, shop_ctv_withdrawals, ctv_product_commissions] = await Promise.all([
          fetchAll('shop_collaborators', 'tenant_id', tenantId),
          fetchAll('shop_ctv_orders', 'tenant_id', tenantId),
          fetchAll('shop_ctv_settings', 'tenant_id', tenantId),
          fetchAll('shop_ctv_withdrawals', 'tenant_id', tenantId),
          fetchAll('ctv_product_commissions', 'tenant_id', tenantId),
        ])
        return ok({ shop_collaborators, shop_ctv_orders, shop_ctv_settings, shop_ctv_withdrawals, ctv_product_commissions })
      }

      case 'email_zalo': {
        const [email_automations, email_automation_blocks, zalo_message_logs, zalo_oa_followers] = await Promise.all([
          fetchAll('email_automations', 'tenant_id', tenantId),
          fetchAll('email_automation_blocks', 'tenant_id', tenantId),
          fetchAll('zalo_message_logs', 'tenant_id', tenantId),
          fetchAll('zalo_oa_followers', 'tenant_id', tenantId),
        ])
        return ok({ email_automations, email_automation_blocks, zalo_message_logs, zalo_oa_followers })
      }

      case 'einvoices': {
        const [einvoices, einvoice_items, einvoice_logs] = await Promise.all([
          fetchAll('einvoices', 'tenant_id', tenantId),
          fetchAll('einvoice_items', 'tenant_id', tenantId),
          fetchAll('einvoice_logs', 'tenant_id', tenantId),
        ])
        return ok({ einvoices, einvoice_items, einvoice_logs })
      }

      case 'misc': {
        const [warehouse_value_snapshots, onboarding_tours] = await Promise.all([
          fetchAll('warehouse_value_snapshots', 'tenant_id', tenantId),
          fetchAll('onboarding_tours', 'tenant_id', tenantId),
        ])
        return ok({ warehouse_value_snapshots, onboarding_tours })
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
        await adminClient.from('audit_logs').insert({
          tenant_id: tenantId,
          user_id: user.id,
          action_type: 'CROSS_PLATFORM_EXPORT',
          table_name: 'ALL',
          description: `Xuất dữ liệu cross-platform JSON v3.0 (full backup)`,
        })
        return ok({ success: true })
      }

      default: {
        return new Response(JSON.stringify({ error: 'Invalid section' }), {
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
