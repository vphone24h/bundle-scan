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
      .select('platform_role, company_id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single()

    const isPlatformAdmin = platformUser?.platform_role === 'platform_admin'
    const isCompanyAdmin = platformUser?.platform_role === 'company_admin'

    if (!platformUser || (!isPlatformAdmin && !isCompanyAdmin)) {
      return new Response(JSON.stringify({ error: 'Forbidden: Admin only' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // For company admin, get tenant IDs in their company
    let companyTenantIds: string[] | null = null
    if (isCompanyAdmin && platformUser.company_id) {
      const { data: companyTenants } = await adminClient
        .from('tenants')
        .select('id')
        .eq('company_id', platformUser.company_id)
      companyTenantIds = (companyTenants || []).map((t: any) => t.id)
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
      // For company admin, filter rows by tenant_id
      if (companyTenantIds && allRows.length > 0 && allRows[0]?.tenant_id !== undefined) {
        return allRows.filter(r => companyTenantIds!.includes(r.tenant_id))
      }
      // For tenants table, filter by company_id
      if (companyTenantIds && table === 'tenants') {
        return allRows.filter(r => companyTenantIds!.includes(r.id))
      }
      return allRows
    }

    // ===== COMPLETE LIST OF ALL PUBLIC TABLES =====
    const allTables = [
      // Core / Tenant
      'tenants',
      'companies',
      'company_settings',
      'company_email_config',
      'branches',
      'categories',
      'product_groups',
      'suppliers',
      'customers',
      'profiles',
      'platform_users',
      'user_roles',
      'user_branch_access',
      'user_custom_permissions',
      'security_passwords',
      'platform_settings',

      // Products & Inventory
      'products',
      'product_imports',
      'import_receipts',
      'receipt_payments',
      'export_receipts',
      'export_receipt_items',
      'export_receipt_payments',
      'export_returns',
      'import_returns',
      'return_payments',
      'stock_counts',
      'stock_count_items',
      'stock_transfer_items',
      'stock_transfer_requests',
      'imei_histories',

      // Backup tables
      'products_backup',
      'import_receipts_backup',
      'export_receipts_backup',
      'cash_book_backup',
      'daily_backups',

      // Finance
      'cash_book',
      'cash_book_categories',
      'cash_book_opening_balances',
      'debt_payments',
      'debt_settings',
      'debt_tags',
      'debt_tag_assignments',
      'debt_offsets',
      'custom_payment_sources',
      'payment_config',

      // Customer CRM
      'customer_tags',
      'customer_tag_assignments',
      'customer_sources',
      'customer_care_schedules',
      'customer_care_logs',
      'customer_contact_channels',
      'customer_vouchers',
      'care_reminders',
      'care_schedule_types',
      'point_settings',
      'point_transactions',
      'membership_tier_settings',
      'voucher_templates',

      // Staff & HR
      'commission_rules',
      'staff_reviews',
      'staff_kpi_settings',
      'staff_performance_snapshots',
      'salary_templates',
      'salary_template_allowances',
      'salary_template_bonuses',
      'salary_template_commissions',
      'salary_template_holidays',
      'salary_template_overtimes',
      'salary_template_penalties',
      'salary_advances',
      'employee_salary_configs',
      'payroll_periods',
      'payroll_records',
      'absence_reviews',
      'overtime_requests',

      // Attendance
      'attendance_locations',
      'attendance_records',
      'attendance_corrections',
      'attendance_correction_requests',
      'attendance_locks',
      'work_shifts',
      'shift_assignments',
      'trusted_devices',

      // Repair / Warranty
      'repair_orders',
      'repair_order_items',
      'repair_request_types',
      'repair_status_history',
      'warranty_lookup_logs',

      // Landing page & Orders
      'landing_products',
      'landing_product_categories',
      'landing_product_blocked_dates',
      'landing_orders',
      'landing_order_email_logs',
      'landing_articles',
      'landing_article_categories',
      'tenant_landing_settings',
      'custom_domains',

      // E-Invoice
      'invoice_templates',
      'einvoice_configs',
      'einvoices',
      'einvoice_items',
      'einvoice_logs',
      'tax_policy_articles',

      // Chat & Social
      'conversations',
      'conversation_members',
      'chat_messages',
      'social_profiles',
      'social_posts',
      'social_comments',
      'social_likes',
      'social_follows',
      'social_notifications',
      'friend_requests',
      'stories',
      'story_views',

      // Shop CTV
      'shop_ctv_settings',
      'shop_collaborators',
      'shop_ctv_orders',
      'shop_ctv_withdrawals',
      'ctv_product_commissions',

      // Email & Notifications
      'email_automations',
      'email_automation_blocks',
      'email_automation_logs',
      'email_history',
      'email_opens',
      'email_queue',
      'onboarding_email_logs',
      'notification_automations',
      'automation_execution_logs',
      'crm_notifications',
      'system_notifications',
      'system_notification_reads',
      'system_notification_dismissals',
      'push_subscriptions',
      'push_vapid_keys',

      // Platform-level email automations
      'platform_email_automations',
      'platform_email_automation_logs',
      'platform_articles',
      'platform_article_categories',

      // Affiliate
      'affiliates',
      'affiliate_referrals',
      'affiliate_commissions',
      'affiliate_clicks',
      'affiliate_withdrawals',
      'affiliate_settings',
      'affiliate_commission_rates',

      // Subscription & Ads
      'subscription_plans',
      'subscription_history',
      'payment_requests',
      'advertisements',
      'ad_gate_settings',
      'bank_accounts',

      // Misc / System
      'audit_logs',
      'onboarding_tours',
      'daily_stats',
      'data_management_jobs',
      'edge_function_rate_limits',
    ]

    // Fetch all public tables in parallel batches of 10
    const batchSize = 10
    for (let i = 0; i < allTables.length; i += batchSize) {
      const batch = allTables.slice(i, i + batchSize)
      const results = await Promise.allSettled(
        batch.map(async (table) => {
          try {
            return { table, rows: await fetchAll(table) }
          } catch (e) {
            console.error(`Skipping ${table}:`, e)
            return { table, rows: [] }
          }
        })
      )
      for (const result of results) {
        if (result.status === 'fulfilled') {
          exportData[result.value.table] = result.value.rows
        }
      }
    }

    // ===== EXPORT auth.users (critical for self-hosting migration) =====
    // Uses service role to query auth.users via admin API
    let authUsers: any[] = []
    try {
      let page = 1
      const perPage = 1000
      while (true) {
        const { data: { users }, error } = await adminClient.auth.admin.listUsers({
          page,
          perPage,
        })
        if (error) {
          console.error('Error fetching auth users:', error.message)
          break
        }
        if (!users || users.length === 0) break
        authUsers.push(...users)
        if (users.length < perPage) break
        page++
      }
      // For company admin, filter users by their tenant user IDs
      if (companyTenantIds) {
        const tenantUserIds = new Set<string>()
        for (const table of ['platform_users', 'user_roles']) {
          const rows = exportData[table] || []
          rows.forEach((r: any) => tenantUserIds.add(r.user_id))
        }
        authUsers = authUsers.filter(u => tenantUserIds.has(u.id))
      }
    } catch (e) {
      console.error('Failed to export auth.users:', e)
    }

    // Summary
    const summary: Record<string, number> = {}
    let totalRows = 0
    for (const [table, rows] of Object.entries(exportData)) {
      summary[table] = rows.length
      totalRows += rows.length
    }
    summary['auth.users'] = authUsers.length
    totalRows += authUsers.length

    const result = {
      _metadata: {
        export_type: 'full_project_selfhost',
        exported_at: new Date().toISOString(),
        exported_by: user.email,
        total_tables: Object.keys(exportData).length + 1, // +1 for auth.users
        total_rows: totalRows,
        summary,
        notes: 'Includes auth.users for self-hosting migration. Import auth.users first, then public tables in order.',
      },
      auth_users: authUsers,
      data: exportData,
    }

    return new Response(JSON.stringify(result), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="full_selfhost_export_${new Date().toISOString().slice(0, 10)}.json"`,
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
