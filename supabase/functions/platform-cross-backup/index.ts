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
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    let targetTenantId: string | null = null
    try {
      const body = await req.json()
      targetTenantId = body?.tenantId || null
    } catch {
      // No body = export all
    }

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

    async function fetchByIds(table: string, col: string, ids: string[]) {
      const allRows: any[] = []
      for (let i = 0; i < ids.length; i += 100) {
        const batch = ids.slice(i, i + 100)
        const { data } = await adminClient.from(table).select('*').in(col, batch)
        if (data) allRows.push(...data)
      }
      return allRows
    }

    let tenants: any[] = []
    if (targetTenantId) {
      const { data } = await adminClient.from('tenants').select('*').eq('id', targetTenantId).single()
      if (data) tenants = [data]
      // Company admin scope check
      if (isCompanyAdmin && platformUser.company_id && tenants[0]?.company_id !== platformUser.company_id) {
        return new Response(JSON.stringify({ error: 'Không có quyền xuất dữ liệu shop này' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    } else if (isCompanyAdmin && platformUser.company_id) {
      const { data } = await adminClient.from('tenants').select('*').eq('company_id', platformUser.company_id)
      if (data) tenants = data
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

    const allShopsData: any[] = []

    for (const tenant of tenants) {
      const tenantId = tenant.id

      // Fetch all tenant-level data in parallel
      const [
        suppliers, customers, categories, branches, products,
        importReceipts, exportReceipts, cashBook, debtPayments,
        exportReturns, importReturns, returnPayments,
        stockCounts, stockTransferRequests,
        customerCareLogs, customerCareSchedules, careScheduleTypes,
        customerTags, customerTagAssignments, customerVouchers,
        customerContactChannels, customerSources,
        debtOffsets, debtTags, debtTagAssignments,
        pointTransactions, productGroups, voucherTemplates,
        customPaymentSources,
      ] = await Promise.all([
        fetchAll('suppliers', 'tenant_id', tenantId),
        fetchAll('customers', 'tenant_id', tenantId),
        fetchAll('categories', 'tenant_id', tenantId),
        fetchAll('branches', 'tenant_id', tenantId),
        fetchAll('products', 'tenant_id', tenantId),
        fetchAll('import_receipts', 'tenant_id', tenantId),
        fetchAll('export_receipts', 'tenant_id', tenantId),
        fetchAll('cash_book', 'tenant_id', tenantId),
        fetchAll('debt_payments', 'tenant_id', tenantId),
        fetchAll('export_returns', 'tenant_id', tenantId),
        fetchAll('import_returns', 'tenant_id', tenantId),
        fetchAll('return_payments', 'tenant_id', tenantId),
        fetchAll('stock_counts', 'tenant_id', tenantId),
        fetchAll('stock_transfer_requests', 'tenant_id', tenantId),
        fetchAll('customer_care_logs', 'tenant_id', tenantId),
        fetchAll('customer_care_schedules', 'tenant_id', tenantId),
        fetchAll('care_schedule_types', 'tenant_id', tenantId),
        fetchAll('customer_tags', 'tenant_id', tenantId),
        fetchAll('customer_tag_assignments', 'tenant_id', tenantId).catch(() => []),
        fetchAll('customer_vouchers', 'tenant_id', tenantId),
        fetchAll('customer_contact_channels', 'tenant_id', tenantId).catch(() => []),
        fetchAll('customer_sources', 'tenant_id', tenantId),
        fetchAll('debt_offsets', 'tenant_id', tenantId),
        fetchAll('debt_tags', 'tenant_id', tenantId),
        fetchAll('debt_tag_assignments', 'tenant_id', tenantId),
        fetchAll('point_transactions', 'tenant_id', tenantId).catch(() => []),
        fetchAll('product_groups', 'tenant_id', tenantId),
        fetchAll('voucher_templates', 'tenant_id', tenantId),
        fetchAll('custom_payment_sources', 'tenant_id', tenantId),
      ])

      // Fetch child records by parent IDs
      const exportReceiptIds = exportReceipts.map((r: any) => r.id)
      const importReceiptIds = importReceipts.map((r: any) => r.id)
      const productIds = products.map((p: any) => p.id)
      const customerIds = customers.map((c: any) => c.id)
      const stockCountIds = stockCounts.map((s: any) => s.id)
      const transferRequestIds = stockTransferRequests.map((t: any) => t.id)

      const [
        exportReceiptItems, exportReceiptPayments,
        receiptPayments, imeiHistories,
        stockCountItems, stockTransferItems,
      ] = await Promise.all([
        exportReceiptIds.length > 0 ? fetchByIds('export_receipt_items', 'receipt_id', exportReceiptIds) : [],
        exportReceiptIds.length > 0 ? fetchByIds('export_receipt_payments', 'receipt_id', exportReceiptIds) : [],
        importReceiptIds.length > 0 ? fetchByIds('receipt_payments', 'receipt_id', importReceiptIds) : [],
        productIds.length > 0 ? fetchByIds('imei_histories', 'product_id', productIds) : [],
        stockCountIds.length > 0 ? fetchByIds('stock_count_items', 'stock_count_id', stockCountIds) : [],
        transferRequestIds.length > 0 ? fetchByIds('stock_transfer_items', 'transfer_request_id', transferRequestIds) : [],
      ])

      // Point transactions by customer_id (no tenant_id column)
      let pointTxns = pointTransactions
      if (pointTxns.length === 0 && customerIds.length > 0) {
        pointTxns = await fetchByIds('point_transactions', 'customer_id', customerIds)
      }

      // Customer contact channels by customer_id  
      let contactChannels = customerContactChannels
      if (contactChannels.length === 0 && customerIds.length > 0) {
        contactChannels = await fetchByIds('customer_contact_channels', 'customer_id', customerIds)
      }

      // Customer tag assignments by customer_id
      let tagAssignments = customerTagAssignments
      if (tagAssignments.length === 0 && customerIds.length > 0) {
        tagAssignments = await fetchByIds('customer_tag_assignments', 'customer_id', customerIds)
      }

      const { data: landingSettings } = await adminClient
        .from('tenant_landing_settings')
        .select('*')
        .eq('tenant_id', tenantId)
        .maybeSingle()

      const { data: debtSettingsData } = await adminClient
        .from('debt_settings')
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
      const exportReturnIdMap: Record<string, string> = {}
      const importReturnIdMap: Record<string, string> = {}
      const stockCountIdMap: Record<string, string> = {}
      const transferRequestIdMap: Record<string, string> = {}
      const customerTagIdMap: Record<string, string> = {}
      const productGroupIdMap: Record<string, string> = {}
      const voucherTemplateIdMap: Record<string, string> = {}

      suppliers.forEach((s: any, i: number) => { supplierIdMap[s.id] = `sup_${String(i + 1).padStart(4, '0')}` })
      customers.forEach((c: any, i: number) => { customerIdMap[c.id] = `cus_${String(i + 1).padStart(4, '0')}` })
      categories.forEach((c: any, i: number) => { categoryIdMap[c.id] = `cat_${String(i + 1).padStart(4, '0')}` })
      branches.forEach((b: any, i: number) => { branchIdMap[b.id] = `br_${String(i + 1).padStart(4, '0')}` })
      products.forEach((p: any, i: number) => { productIdMap[p.id] = `prod_${String(i + 1).padStart(4, '0')}` })
      importReceipts.forEach((r: any, i: number) => { importReceiptIdMap[r.id] = `imp_${String(i + 1).padStart(4, '0')}` })
      exportReceipts.forEach((r: any, i: number) => { exportReceiptIdMap[r.id] = `exp_${String(i + 1).padStart(4, '0')}` })
      exportReturns.forEach((r: any, i: number) => { exportReturnIdMap[r.id] = `exret_${String(i + 1).padStart(4, '0')}` })
      importReturns.forEach((r: any, i: number) => { importReturnIdMap[r.id] = `imret_${String(i + 1).padStart(4, '0')}` })
      stockCounts.forEach((s: any, i: number) => { stockCountIdMap[s.id] = `sc_${String(i + 1).padStart(4, '0')}` })
      stockTransferRequests.forEach((t: any, i: number) => { transferRequestIdMap[t.id] = `tr_${String(i + 1).padStart(4, '0')}` })
      customerTags.forEach((t: any, i: number) => { customerTagIdMap[t.id] = `ctag_${String(i + 1).padStart(4, '0')}` })
      productGroups.forEach((g: any, i: number) => { productGroupIdMap[g.id] = `pg_${String(i + 1).padStart(4, '0')}` })
      voucherTemplates.forEach((v: any, i: number) => { voucherTemplateIdMap[v.id] = `vt_${String(i + 1).padStart(4, '0')}` })

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
          last_purchase_date: c.last_purchase_date, last_care_date: c.last_care_date,
          crm_status: c.crm_status, assigned_staff_id: c.assigned_staff_id,
          preferred_branch_external_id: mapRef(c.preferred_branch_id, branchIdMap),
          created_at: c.created_at,
        })),

        product_groups: productGroups.map((g: any) => ({
          external_id: productGroupIdMap[g.id],
          name: g.name, sku_prefix: g.sku_prefix,
          category_external_id: mapRef(g.category_id, categoryIdMap),
          variant_1_label: g.variant_1_label, variant_2_label: g.variant_2_label, variant_3_label: g.variant_3_label,
          variant_1_values: g.variant_1_values, variant_2_values: g.variant_2_values, variant_3_values: g.variant_3_values,
          created_at: g.created_at,
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
          group_external_id: mapRef(p.group_id, productGroupIdMap),
          version_name: p.version_name, version_value: p.version_value,
          color: p.color, created_at: p.created_at,
        })),

        import_receipts: importReceipts.map((r: any) => ({
          external_id: importReceiptIdMap[r.id],
          code: r.code, supplier_external_id: mapRef(r.supplier_id, supplierIdMap),
          branch_external_id: mapRef(r.branch_id, branchIdMap),
          total_amount: r.total_amount, paid_amount: r.paid_amount, payment_source: r.payment_source,
          import_date: r.import_date, note: r.note, status: r.status, created_at: r.created_at,
        })),

        receipt_payments: receiptPayments.map((p: any) => ({
          receipt_external_id: mapRef(p.receipt_id, importReceiptIdMap),
          payment_type: p.payment_type, amount: p.amount, created_at: p.created_at,
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

        // === RETURNS ===
        export_returns: exportReturns.map((r: any) => ({
          external_id: exportReturnIdMap[r.id],
          code: r.code, return_date: r.return_date,
          product_external_id: mapRef(r.product_id, productIdMap),
          export_receipt_external_id: mapRef(r.export_receipt_id, exportReceiptIdMap),
          customer_external_id: mapRef(r.customer_id, customerIdMap),
          branch_external_id: mapRef(r.branch_id, branchIdMap),
          product_name: r.product_name, sku: r.sku, imei: r.imei,
          import_price: r.import_price, sale_price: r.sale_price,
          original_sale_date: r.original_sale_date,
          fee_type: r.fee_type, fee_percentage: r.fee_percentage, fee_amount: r.fee_amount,
          refund_amount: r.refund_amount, store_keep_amount: r.store_keep_amount,
          is_business_accounting: r.is_business_accounting, quantity: r.quantity,
          note: r.note, created_at: r.created_at,
        })),

        import_returns: importReturns.map((r: any) => ({
          external_id: importReturnIdMap[r.id],
          code: r.code, return_date: r.return_date,
          product_external_id: mapRef(r.product_id, productIdMap),
          import_receipt_external_id: mapRef(r.import_receipt_id, importReceiptIdMap),
          supplier_external_id: mapRef(r.supplier_id, supplierIdMap),
          branch_external_id: mapRef(r.branch_id, branchIdMap),
          product_name: r.product_name, sku: r.sku, imei: r.imei,
          import_price: r.import_price, original_import_date: r.original_import_date,
          total_refund_amount: r.total_refund_amount,
          fee_type: r.fee_type, fee_percentage: r.fee_percentage, fee_amount: r.fee_amount,
          quantity: r.quantity, note: r.note, created_at: r.created_at,
        })),

        return_payments: returnPayments.map((p: any) => ({
          return_external_id: p.return_type === 'export_return' ? mapRef(p.return_id, exportReturnIdMap) : mapRef(p.return_id, importReturnIdMap),
          return_type: p.return_type, payment_source: p.payment_source, amount: p.amount, created_at: p.created_at,
        })),

        // === STOCK COUNTS ===
        stock_counts: stockCounts.map((s: any) => ({
          external_id: stockCountIdMap[s.id],
          branch_external_id: mapRef(s.branch_id, branchIdMap),
          scope: s.scope, scope_category_external_id: mapRef(s.scope_category_id, categoryIdMap),
          status: s.status, note: s.note,
          total_actual_quantity: s.total_actual_quantity, total_system_quantity: s.total_system_quantity,
          total_difference: s.total_difference,
          created_by_name: s.created_by_name, confirmed_by_name: s.confirmed_by_name,
          confirmed_at: s.confirmed_at, created_at: s.created_at,
        })),

        stock_count_items: stockCountItems.map((item: any) => ({
          stock_count_external_id: mapRef(item.stock_count_id, stockCountIdMap),
          product_external_id: mapRef(item.product_id, productIdMap),
          product_name: item.product_name, sku: item.sku,
          system_quantity: item.system_quantity, actual_quantity: item.actual_quantity,
          difference: item.difference, status: item.status, note: item.note,
        })),

        // === STOCK TRANSFERS ===
        stock_transfer_requests: stockTransferRequests.map((t: any) => ({
          external_id: transferRequestIdMap[t.id],
          from_branch_external_id: mapRef(t.from_branch_id, branchIdMap),
          to_branch_external_id: mapRef(t.to_branch_id, branchIdMap),
          status: t.status, note: t.note,
          approved_at: t.approved_at, rejected_at: t.rejected_at, reject_reason: t.reject_reason,
          created_at: t.created_at,
        })),

        stock_transfer_items: stockTransferItems.map((item: any) => ({
          transfer_request_external_id: mapRef(item.transfer_request_id, transferRequestIdMap),
          product_external_id: mapRef(item.product_id, productIdMap),
          product_name: item.product_name, sku: item.sku, imei: item.imei,
          quantity: item.quantity, import_price: item.import_price,
          supplier_external_id: mapRef(item.supplier_id, supplierIdMap),
          supplier_name: item.supplier_name, note: item.note,
        })),

        // === CASH BOOK ===
        cash_book: cashBook.map((cb: any) => ({
          type: cb.type, category: cb.category, description: cb.description, amount: cb.amount,
          payment_source: cb.payment_source, transaction_date: cb.transaction_date, note: cb.note,
          recipient_name: cb.recipient_name, recipient_phone: cb.recipient_phone,
          reference_type: cb.reference_type, is_business_accounting: cb.is_business_accounting,
          branch_external_id: mapRef(cb.branch_id, branchIdMap),
          created_by_name: cb.created_by_name, created_at: cb.created_at,
        })),

        // === DEBT ===
        debt_payments: debtPayments.map((dp: any) => ({
          entity_id: dp.entity_id, entity_type: dp.entity_type, payment_type: dp.payment_type,
          amount: dp.amount, allocated_amount: dp.allocated_amount, balance_after: dp.balance_after,
          description: dp.description, payment_source: dp.payment_source,
          branch_external_id: mapRef(dp.branch_id, branchIdMap), created_at: dp.created_at,
        })),

        debt_offsets: debtOffsets.map((d: any) => ({
          supplier_entity_id: d.supplier_entity_id, supplier_name: d.supplier_name,
          customer_entity_id: d.customer_entity_id, customer_name: d.customer_name,
          offset_amount: d.offset_amount,
          supplier_debt_before: d.supplier_debt_before, supplier_debt_after: d.supplier_debt_after,
          customer_debt_before: d.customer_debt_before, customer_debt_after: d.customer_debt_after,
          note: d.note, created_at: d.created_at,
        })),

        debt_tags: debtTags.map((t: any) => ({
          external_id: `dtag_${t.id.slice(0, 8)}`,
          name: t.name, color: t.color, created_at: t.created_at,
        })),

        debt_tag_assignments: debtTagAssignments.map((a: any) => ({
          entity_id: a.entity_id, entity_type: a.entity_type,
          tag_name: debtTags.find((t: any) => t.id === a.tag_id)?.name || null,
          created_at: a.created_at,
        })),

        debt_settings: debtSettingsData ? {
          overdue_days: debtSettingsData.overdue_days,
        } : null,

        // === CRM ===
        customer_sources: customerSources.map((s: any) => ({
          name: s.name, display_order: s.display_order, is_default: s.is_default, created_at: s.created_at,
        })),

        customer_tags: customerTags.map((t: any) => ({
          external_id: customerTagIdMap[t.id],
          name: t.name, color: t.color, description: t.description, created_at: t.created_at,
        })),

        customer_tag_assignments: tagAssignments.map((a: any) => ({
          customer_external_id: mapRef(a.customer_id, customerIdMap),
          tag_external_id: mapRef(a.tag_id, customerTagIdMap),
          assigned_at: a.assigned_at,
        })),

        customer_contact_channels: contactChannels.map((ch: any) => ({
          customer_external_id: mapRef(ch.customer_id, customerIdMap),
          channel_type: ch.channel_type, channel_url: ch.channel_url, note: ch.note, created_at: ch.created_at,
        })),

        customer_vouchers: customerVouchers.map((v: any) => ({
          code: v.code, voucher_name: v.voucher_name,
          customer_external_id: mapRef(v.customer_id, customerIdMap),
          customer_name: v.customer_name, customer_phone: v.customer_phone, customer_email: v.customer_email,
          discount_type: v.discount_type, discount_value: v.discount_value,
          source: v.source, status: v.status,
          branch_external_id: mapRef(v.branch_id, branchIdMap),
          used_at: v.used_at, created_at: v.created_at,
        })),

        care_schedule_types: careScheduleTypes.map((t: any) => ({
          name: t.name, display_order: t.display_order, is_default: t.is_default, created_at: t.created_at,
        })),

        customer_care_schedules: customerCareSchedules.map((s: any) => ({
          customer_external_id: mapRef(s.customer_id, customerIdMap),
          care_type_name: s.care_type_name, scheduled_date: s.scheduled_date, scheduled_time: s.scheduled_time,
          status: s.status, note: s.note, reminder_days: s.reminder_days,
          completed_at: s.completed_at, created_at: s.created_at,
        })),

        customer_care_logs: customerCareLogs.map((l: any) => ({
          customer_external_id: mapRef(l.customer_id, customerIdMap),
          action_type: l.action_type, content: l.content, result: l.result,
          staff_name: l.staff_name, created_at: l.created_at,
        })),

        point_transactions: pointTxns.map((pt: any) => ({
          customer_external_id: mapRef(pt.customer_id, customerIdMap),
          transaction_type: pt.transaction_type, points: pt.points, balance_after: pt.balance_after,
          status: pt.status, reference_type: pt.reference_type,
          description: pt.description, note: pt.note,
          branch_external_id: mapRef(pt.branch_id, branchIdMap),
          created_at: pt.created_at,
        })),

        voucher_templates: voucherTemplates.map((v: any) => ({
          external_id: voucherTemplateIdMap[v.id],
          name: v.name, discount_type: v.discount_type, discount_value: v.discount_value,
          description: v.description, conditions: v.conditions, is_active: v.is_active,
          min_order_value: v.min_order_value, created_at: v.created_at,
        })),

        custom_payment_sources: customPaymentSources.map((s: any) => ({
          name: s.name, source_key: s.source_key, created_at: s.created_at,
        })),

        // === IMEI & MISC ===
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
          total_products: products.length, total_product_groups: productGroups.length,
          total_import_receipts: importReceipts.length, total_export_receipts: exportReceipts.length,
          total_export_receipt_items: exportReceiptItems.length,
          total_receipt_payments: receiptPayments.length,
          total_export_returns: exportReturns.length, total_import_returns: importReturns.length,
          total_return_payments: returnPayments.length,
          total_stock_counts: stockCounts.length, total_stock_count_items: stockCountItems.length,
          total_stock_transfers: stockTransferRequests.length, total_stock_transfer_items: stockTransferItems.length,
          total_cash_book: cashBook.length, total_debt_payments: debtPayments.length,
          total_debt_offsets: debtOffsets.length,
          total_customer_care_schedules: customerCareSchedules.length,
          total_customer_care_logs: customerCareLogs.length,
          total_customer_tags: customerTags.length,
          total_customer_vouchers: customerVouchers.length,
          total_point_transactions: pointTxns.length,
          total_voucher_templates: voucherTemplates.length,
          total_imei_histories: imeiHistories.length,
        },
      }

      allShopsData.push(shopData)
    }

    const exportJson = {
      version: '2.0',
      exported_at: new Date().toISOString(),
      exported_by: 'platform_admin',
      total_shops: allShopsData.length,
      shops: allShopsData,
    }

    await adminClient.from('audit_logs').insert({
      user_id: user.id,
      action_type: 'PLATFORM_CROSS_PLATFORM_EXPORT',
      table_name: 'ALL',
      description: `Platform Admin xuất cross-platform JSON v2.0 - ${allShopsData.length} shop(s)`,
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
