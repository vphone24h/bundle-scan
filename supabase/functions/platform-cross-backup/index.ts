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

    // Only platform admin
    const { data: platformUser } = await adminClient
      .from('platform_users')
      .select('platform_role')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single()

    if (!platformUser || platformUser.platform_role !== 'platform_admin') {
      return new Response(JSON.stringify({ error: 'Forbidden: Platform admin only' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Parse request body for optional tenantId filter
    let targetTenantId: string | null = null
    try {
      const body = await req.json()
      targetTenantId = body?.tenantId || null
    } catch {
      // No body = export all
    }

    // Helper to fetch all rows
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

    // Get all tenants or specific one
    let tenants: any[] = []
    if (targetTenantId) {
      const { data } = await adminClient.from('tenants').select('*').eq('id', targetTenantId).single()
      if (data) tenants = [data]
    } else {
      const { data } = await adminClient.from('tenants').select('*')
      if (data) tenants = data
    }

    if (tenants.length === 0) {
      return new Response(JSON.stringify({ error: 'No tenants found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const mapRef = (id: string | null, map: Record<string, string>) => id ? (map[id] || null) : null

    // Process each tenant
    const allShopsData: any[] = []

    for (const tenant of tenants) {
      const tenantId = tenant.id

      const [suppliers, customers, categories, branches, products, importReceipts, exportReceipts, cashBook, debtPayments] = await Promise.all([
        fetchAll('suppliers', 'tenant_id', tenantId),
        fetchAll('customers', 'tenant_id', tenantId),
        fetchAll('categories', 'tenant_id', tenantId),
        fetchAll('branches', 'tenant_id', tenantId),
        fetchAll('products', 'tenant_id', tenantId),
        fetchAll('import_receipts', 'tenant_id', tenantId),
        fetchAll('export_receipts', 'tenant_id', tenantId),
        fetchAll('cash_book', 'tenant_id', tenantId),
        fetchAll('debt_payments', 'tenant_id', tenantId),
      ])

      // Fetch child records
      const exportReceiptIds = exportReceipts.map((r: any) => r.id)
      const productIds = products.map((p: any) => p.id)

      let exportReceiptItems: any[] = []
      let exportReceiptPayments: any[] = []
      let imeiHistories: any[] = []

      if (exportReceiptIds.length > 0) {
        for (let i = 0; i < exportReceiptIds.length; i += 100) {
          const batch = exportReceiptIds.slice(i, i + 100)
          const { data: items } = await adminClient.from('export_receipt_items').select('*').in('receipt_id', batch)
          if (items) exportReceiptItems.push(...items)
          const { data: payments } = await adminClient.from('export_receipt_payments').select('*').in('receipt_id', batch)
          if (payments) exportReceiptPayments.push(...payments)
        }
      }

      if (productIds.length > 0) {
        for (let i = 0; i < productIds.length; i += 100) {
          const batch = productIds.slice(i, i + 100)
          const { data } = await adminClient.from('imei_histories').select('*').in('product_id', batch)
          if (data) imeiHistories.push(...data)
        }
      }

      // Landing settings
      const { data: landingSettings } = await adminClient
        .from('tenant_landing_settings')
        .select('*')
        .eq('tenant_id', tenantId)
        .maybeSingle()

      // Build ID maps
      const supplierIdMap: Record<string, string> = {}
      const customerIdMap: Record<string, string> = {}
      const categoryIdMap: Record<string, string> = {}
      const branchIdMap: Record<string, string> = {}
      const productIdMap: Record<string, string> = {}
      const importReceiptIdMap: Record<string, string> = {}
      const exportReceiptIdMap: Record<string, string> = {}

      suppliers.forEach((s: any, i: number) => { supplierIdMap[s.id] = `sup_${String(i + 1).padStart(4, '0')}` })
      customers.forEach((c: any, i: number) => { customerIdMap[c.id] = `cus_${String(i + 1).padStart(4, '0')}` })
      categories.forEach((c: any, i: number) => { categoryIdMap[c.id] = `cat_${String(i + 1).padStart(4, '0')}` })
      branches.forEach((b: any, i: number) => { branchIdMap[b.id] = `br_${String(i + 1).padStart(4, '0')}` })
      products.forEach((p: any, i: number) => { productIdMap[p.id] = `prod_${String(i + 1).padStart(4, '0')}` })
      importReceipts.forEach((r: any, i: number) => { importReceiptIdMap[r.id] = `imp_${String(i + 1).padStart(4, '0')}` })
      exportReceipts.forEach((r: any, i: number) => { exportReceiptIdMap[r.id] = `exp_${String(i + 1).padStart(4, '0')}` })

      const shopData = {
        tenant_info: {
          store_name: tenant.store_name,
          business_name: tenant.business_name,
          subdomain: tenant.subdomain,
          business_type: tenant.business_type,
          phone: tenant.phone,
          address: tenant.address,
          logo_url: tenant.logo_url,
          status: tenant.status,
        },

        branches: branches.map((b: any) => ({
          external_id: branchIdMap[b.id],
          name: b.name, address: b.address, phone: b.phone, is_default: b.is_default, note: b.note, created_at: b.created_at,
        })),

        categories: categories.map((c: any) => ({
          external_id: categoryIdMap[c.id],
          name: c.name, parent_external_id: mapRef(c.parent_id, categoryIdMap), created_at: c.created_at,
        })),

        suppliers: suppliers.map((s: any) => ({
          external_id: supplierIdMap[s.id],
          name: s.name, phone: s.phone, email: s.email, address: s.address,
          tax_code: s.tax_code, debt_amount: s.debt_amount, note: s.note, entity_code: s.entity_code, created_at: s.created_at,
        })),

        customers: customers.map((c: any) => ({
          external_id: customerIdMap[c.id],
          name: c.name, phone: c.phone, email: c.email, address: c.address, birthday: c.birthday,
          entity_code: c.entity_code, source: c.source, note: c.note,
          total_spent: c.total_spent, current_points: c.current_points, pending_points: c.pending_points,
          total_points_earned: c.total_points_earned, total_points_used: c.total_points_used,
          membership_tier: c.membership_tier, status: c.status, debt_due_days: c.debt_due_days,
          last_purchase_date: c.last_purchase_date,
          preferred_branch_external_id: mapRef(c.preferred_branch_id, branchIdMap),
          created_at: c.created_at,
        })),

        products: products.map((p: any) => ({
          external_id: productIdMap[p.id],
          name: p.name, sku: p.sku, imei: p.imei, barcode: p.barcode,
          import_price: p.import_price, sale_price: p.sale_price, quantity: p.quantity, status: p.status,
          warranty: p.warranty, warranty_package: p.warranty_package,
          warranty_start_date: p.warranty_start_date, warranty_end_date: p.warranty_end_date,
          note: p.note, image_url: p.image_url, supplier_name: p.supplier_name,
          supplier_external_id: mapRef(p.supplier_id, supplierIdMap),
          category_external_id: mapRef(p.category_id, categoryIdMap),
          branch_external_id: mapRef(p.branch_id, branchIdMap),
          group_id: p.group_id, version_name: p.version_name, version_value: p.version_value,
          color: p.color, created_at: p.created_at,
        })),

        import_receipts: importReceipts.map((r: any) => ({
          external_id: importReceiptIdMap[r.id],
          code: r.code, supplier_external_id: mapRef(r.supplier_id, supplierIdMap),
          branch_external_id: mapRef(r.branch_id, branchIdMap),
          total_amount: r.total_amount, paid_amount: r.paid_amount, payment_source: r.payment_source,
          import_date: r.import_date, note: r.note, status: r.status, created_at: r.created_at,
        })),

        export_receipts: exportReceipts.map((r: any) => ({
          external_id: exportReceiptIdMap[r.id],
          code: r.code, customer_external_id: mapRef(r.customer_id, customerIdMap),
          branch_external_id: mapRef(r.branch_id, branchIdMap),
          total_amount: r.total_amount, paid_amount: r.paid_amount,
          discount_amount: r.discount_amount, voucher_discount: r.voucher_discount, points_discount: r.points_discount,
          payment_source: r.payment_source, export_date: r.export_date, note: r.note, status: r.status,
          customer_name: r.customer_name, customer_phone: r.customer_phone, created_by_name: r.created_by_name,
          created_at: r.created_at,
        })),

        export_receipt_items: exportReceiptItems.map((item: any) => ({
          receipt_external_id: mapRef(item.receipt_id, exportReceiptIdMap),
          product_external_id: mapRef(item.product_id, productIdMap),
          product_name: item.product_name, imei: item.imei, quantity: item.quantity,
          unit_price: item.unit_price, total_price: item.total_price,
          warranty: item.warranty, warranty_package: item.warranty_package,
        })),

        export_receipt_payments: exportReceiptPayments.map((p: any) => ({
          receipt_external_id: mapRef(p.receipt_id, exportReceiptIdMap),
          amount: p.amount, payment_source: p.payment_source, payment_date: p.payment_date, note: p.note,
        })),

        cash_book: cashBook.map((cb: any) => ({
          type: cb.type, category: cb.category, description: cb.description, amount: cb.amount,
          payment_source: cb.payment_source, transaction_date: cb.transaction_date, note: cb.note,
          recipient_name: cb.recipient_name, recipient_phone: cb.recipient_phone,
          reference_type: cb.reference_type, is_business_accounting: cb.is_business_accounting,
          branch_external_id: mapRef(cb.branch_id, branchIdMap),
          created_by_name: cb.created_by_name, created_at: cb.created_at,
        })),

        debt_payments: debtPayments.map((dp: any) => ({
          entity_id: dp.entity_id, entity_type: dp.entity_type, payment_type: dp.payment_type,
          amount: dp.amount, allocated_amount: dp.allocated_amount, balance_after: dp.balance_after,
          description: dp.description, payment_source: dp.payment_source,
          branch_external_id: mapRef(dp.branch_id, branchIdMap), created_at: dp.created_at,
        })),

        imei_histories: imeiHistories.map((h: any) => ({
          product_external_id: mapRef(h.product_id, productIdMap),
          action: h.action, old_imei: h.old_imei, new_imei: h.new_imei, note: h.note, created_at: h.created_at,
        })),

        web_config: landingSettings ? {
          store_name: landingSettings.store_name, store_description: landingSettings.store_description,
          store_phone: landingSettings.store_phone, store_email: landingSettings.store_email,
          store_address: landingSettings.store_address, additional_addresses: landingSettings.additional_addresses,
          logo_url: landingSettings.logo_url, banner_url: landingSettings.banner_url,
          primary_color: landingSettings.primary_color, secondary_color: landingSettings.secondary_color,
          facebook_url: landingSettings.facebook_url, zalo_url: landingSettings.zalo_url,
          youtube_url: landingSettings.youtube_url, tiktok_url: landingSettings.tiktok_url,
        } : null,

        _metadata: {
          total_suppliers: suppliers.length, total_customers: customers.length,
          total_categories: categories.length, total_branches: branches.length,
          total_products: products.length, total_import_receipts: importReceipts.length,
          total_export_receipts: exportReceipts.length, total_export_receipt_items: exportReceiptItems.length,
          total_cash_book: cashBook.length, total_debt_payments: debtPayments.length,
        },
      }

      allShopsData.push(shopData)
    }

    const exportJson = {
      version: '1.0',
      exported_at: new Date().toISOString(),
      exported_by: 'platform_admin',
      total_shops: allShopsData.length,
      shops: allShopsData,
    }

    // Log
    await adminClient.from('audit_logs').insert({
      user_id: user.id,
      action_type: 'PLATFORM_CROSS_PLATFORM_EXPORT',
      table_name: 'ALL',
      description: `Platform Admin xuất cross-platform JSON v1.0 - ${allShopsData.length} shop(s)`,
    })

    return new Response(JSON.stringify(exportJson), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('Platform cross-platform export error:', error)
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
