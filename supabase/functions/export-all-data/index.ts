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

    // Only platform admins can export all data
    const adminClient = createClient(supabaseUrl, serviceRoleKey)

    const { data: platformUser } = await adminClient
      .from('platform_users')
      .select('platform_role')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single()

    if (!platformUser || platformUser.platform_role !== 'platform_admin') {
      return new Response(JSON.stringify({ error: 'Forbidden: Platform admin only' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const exportData: Record<string, any[]> = {}

    // Helper to fetch all rows (handling 1000 limit)
    async function fetchAll(table: string, select = '*', filter?: { column: string; value: string }) {
      const allRows: any[] = []
      let from = 0
      const batchSize = 1000
      while (true) {
        let query = adminClient.from(table).select(select).range(from, from + batchSize - 1)
        if (filter) {
          query = query.eq(filter.column, filter.value)
        }
        const { data, error } = await query
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

    // All tables to export (no tenant filter - export everything)
    const allTables = [
      'tenants',
      'branches',
      'categories',
      'suppliers',
      'customers',
      'products',
      'product_imports',
      'import_receipts',
      'receipt_payments',
      'export_receipts',
      'export_receipt_items',
      'export_receipt_payments',
      'cash_book',
      'cash_book_opening_balances',
      'debt_payments',
      'debt_settings',
      'debt_tags',
      'customer_tags',
      'customer_tag_assignments',
      'customer_sources',
      'customer_care_schedules',
      'customer_care_logs',
      'customer_contact_channels',
      'customer_vouchers',
      'care_reminders',
      'care_schedule_types',
      'export_returns',
      'import_returns',
      'return_payments',
      'invoice_templates',
      'stock_counts',
      'stock_count_items',
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
      'einvoice_items',
      'einvoice_logs',
      'tax_policy_articles',
      'custom_domains',
      'user_branch_access',
      'user_roles',
      'platform_users',
      'profiles',
      'point_settings',
      'point_transactions',
      'membership_tier_settings',
      'onboarding_tours',
      'push_subscriptions',
      'email_queue',
      'onboarding_email_logs',
      'warranty_lookup_logs',
      'imei_histories',
      'tenant_landing_settings',
      'subscription_plans',
      'payment_requests',
      'advertisements',
      'ad_gate_settings',
      'bank_accounts',
      'affiliates',
      'affiliate_referrals',
      'affiliate_commissions',
      'affiliate_clicks',
      'affiliate_withdrawals',
      'affiliate_settings',
      'affiliate_commission_rates',
      'notification_automations',
      'automation_execution_logs',
      'system_notifications',
      'system_notification_reads',
    ]

    for (const table of allTables) {
      try {
        exportData[table] = await fetchAll(table)
      } catch (e) {
        console.error(`Skipping ${table}:`, e)
        exportData[table] = []
      }
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
        export_type: 'full_project',
        exported_at: new Date().toISOString(),
        exported_by: user.email,
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
        'Content-Disposition': `attachment; filename="full_project_export_${new Date().toISOString().slice(0, 10)}.json"`,
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
