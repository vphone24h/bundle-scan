import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

type StatBucket = { total: number; success: number; skipped: number; error: number }
type RestoreStats = {
  branches: StatBucket
  categories: StatBucket
  suppliers: StatBucket
  customers: StatBucket
  products: StatBucket
  import_receipts: StatBucket
  export_receipts: StatBucket
  export_receipt_items: StatBucket
  export_receipt_payments: StatBucket
  cash_book: StatBucket
  debt_payments: StatBucket
  web_config: StatBucket
}

const CRM_STATUS = new Set(['new', 'caring', 'purchased', 'inactive'])
const MEMBERSHIP_TIER = new Set(['regular', 'silver', 'gold', 'vip'])
const CUSTOMER_STATUS = new Set(['active', 'inactive'])
const PRODUCT_STATUS = new Set(['in_stock', 'sold', 'returned', 'deleted', 'warranty', 'template'])
const RECEIPT_STATUS = new Set(['completed', 'cancelled'])

const createStats = (): RestoreStats => ({
  branches: { total: 0, success: 0, skipped: 0, error: 0 },
  categories: { total: 0, success: 0, skipped: 0, error: 0 },
  suppliers: { total: 0, success: 0, skipped: 0, error: 0 },
  customers: { total: 0, success: 0, skipped: 0, error: 0 },
  products: { total: 0, success: 0, skipped: 0, error: 0 },
  import_receipts: { total: 0, success: 0, skipped: 0, error: 0 },
  export_receipts: { total: 0, success: 0, skipped: 0, error: 0 },
  export_receipt_items: { total: 0, success: 0, skipped: 0, error: 0 },
  export_receipt_payments: { total: 0, success: 0, skipped: 0, error: 0 },
  cash_book: { total: 0, success: 0, skipped: 0, error: 0 },
  debt_payments: { total: 0, success: 0, skipped: 0, error: 0 },
  web_config: { total: 0, success: 0, skipped: 0, error: 0 },
})

const jsonResponse = (status: number, payload: Record<string, unknown>) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

const normalizeText = (value: unknown) =>
  typeof value === 'string' ? value.trim().toLowerCase() : ''

const toNumber = (value: unknown, fallback = 0) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : fallback
  }
  return fallback
}

const toDate = (value: unknown, fallback: string) => {
  if (typeof value !== 'string' || !value) return fallback
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? fallback : d.toISOString()
}

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)

const summarize = (stats: RestoreStats) => ({
  total_records: Object.values(stats).reduce((a, s) => a + s.total, 0),
  total_success: Object.values(stats).reduce((a, s) => a + s.success, 0),
  total_skipped: Object.values(stats).reduce((a, s) => a + s.skipped, 0),
  total_failed: Object.values(stats).reduce((a, s) => a + s.error, 0),
})

const processInBatches = async <T>(
  items: T[],
  batchSize: number,
  worker: (item: T, index: number) => Promise<void>,
) => {
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize)
    await Promise.all(batch.map((item, batchIndex) => worker(item, i + batchIndex)))
  }
}

async function clearTenantData(adminClient: any, tenantId: string, errors: string[]) {
  const [exportRowsRes, importRowsRes, productRowsRes] = await Promise.all([
    adminClient.from('export_receipts').select('id').eq('tenant_id', tenantId),
    adminClient.from('import_receipts').select('id').eq('tenant_id', tenantId),
    adminClient.from('products').select('id').eq('tenant_id', tenantId),
  ])

  if (exportRowsRes.error) errors.push(`Lỗi đọc export_receipts: ${exportRowsRes.error.message}`)
  if (importRowsRes.error) errors.push(`Lỗi đọc import_receipts: ${importRowsRes.error.message}`)
  if (productRowsRes.error) errors.push(`Lỗi đọc products: ${productRowsRes.error.message}`)

  const exportIds: string[] = (exportRowsRes.data || []).map((r: any) => r.id)
  const importIds: string[] = (importRowsRes.data || []).map((r: any) => r.id)
  const productIds: string[] = (productRowsRes.data || []).map((r: any) => r.id)

  const deleteByTenant = async (table: string) => {
    const { error } = await adminClient.from(table).delete().eq('tenant_id', tenantId)
    if (error) errors.push(`Xóa ${table}: ${error.message}`)
  }

  const deleteByIds = async (table: string, column: string, ids: string[]) => {
    if (!ids.length) return
    const batchSize = 500
    for (let i = 0; i < ids.length; i += batchSize) {
      const batch = ids.slice(i, i + batchSize)
      const { error } = await adminClient.from(table).delete().in(column, batch)
      if (error) {
        errors.push(`Xóa ${table}: ${error.message}`)
        break
      }
    }
  }

  await deleteByIds('export_receipt_payments', 'receipt_id', exportIds)
  await deleteByIds('export_receipt_items', 'receipt_id', exportIds)
  await deleteByIds('export_returns', 'export_receipt_id', exportIds)

  await deleteByIds('import_returns', 'import_receipt_id', importIds)
  await deleteByIds('imei_histories', 'product_id', productIds)

  await deleteByTenant('debt_payments')
  await deleteByTenant('cash_book')
  await deleteByTenant('products')
  await deleteByTenant('export_receipts')
  await deleteByTenant('import_receipts')
  await deleteByTenant('customers')
  await deleteByTenant('suppliers')
  await deleteByTenant('categories')
  await deleteByTenant('branches')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return jsonResponse(401, { error: 'Unauthorized' })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const { data: { user }, error: userError } = await userClient.auth.getUser()
    if (userError || !user) {
      return jsonResponse(401, { error: 'Unauthorized' })
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey)

    const { data: tenantData, error: tenantError } = await adminClient
      .from('platform_users')
      .select('tenant_id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle()

    if (tenantError || !tenantData?.tenant_id) {
      return jsonResponse(404, { error: 'Tenant not found' })
    }

    const { data: roleData } = await adminClient
      .from('user_roles')
      .select('user_role')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!roleData || !['super_admin', 'branch_admin'].includes(roleData.user_role || '')) {
      return jsonResponse(403, { error: 'Forbidden: Admin only' })
    }

    let body: any
    try {
      body = await req.json()
    } catch {
      return jsonResponse(400, { error: 'Body JSON không hợp lệ' })
    }

    const importData = body?.importData
    const mode = body?.mode === 'overwrite' ? 'overwrite' : 'merge'
    const tenantId = tenantData.tenant_id

    if (!importData?.version || importData.version !== '1.0') {
      return jsonResponse(400, { error: 'File JSON không hợp lệ hoặc version không hỗ trợ' })
    }

    console.log('Import mode:', mode, 'Keys:', Object.keys(importData || {}))

    const stats = createStats()
    const errors: string[] = []

    if (mode === 'overwrite') {
      console.log('Overwrite: deleting existing data...')
      await clearTenantData(adminClient, tenantId, errors)
    }

    const [
      existingBranchesRes,
      existingCategoriesRes,
      existingSuppliersRes,
      existingCustomersRes,
      existingProductsRes,
      existingImportReceiptsRes,
      existingExportReceiptsRes,
    ] = await Promise.all([
      adminClient.from('branches').select('id,name').eq('tenant_id', tenantId),
      adminClient.from('categories').select('id,name').eq('tenant_id', tenantId),
      adminClient.from('suppliers').select('id,name,phone').eq('tenant_id', tenantId),
      adminClient.from('customers').select('id,phone').eq('tenant_id', tenantId),
      adminClient.from('products').select('id,sku,imei').eq('tenant_id', tenantId),
      adminClient.from('import_receipts').select('id,code').eq('tenant_id', tenantId),
      adminClient.from('export_receipts').select('id,code').eq('tenant_id', tenantId),
    ])

    const preloadErrors = [
      existingBranchesRes.error,
      existingCategoriesRes.error,
      existingSuppliersRes.error,
      existingCustomersRes.error,
      existingProductsRes.error,
      existingImportReceiptsRes.error,
      existingExportReceiptsRes.error,
    ].filter(Boolean)

    if (preloadErrors.length > 0) {
      throw new Error(`Không thể tải dữ liệu hiện tại: ${(preloadErrors[0] as any).message}`)
    }

    const branchByName = new Map<string, string>()
    const categoryByName = new Map<string, string>()
    const supplierByPhone = new Map<string, string>()
    const supplierByName = new Map<string, string>()
    const customerByPhone = new Map<string, string>()
    const productBySku = new Map<string, string>()
    const productByImei = new Map<string, string>()
    const importReceiptByCode = new Map<string, string>()
    const exportReceiptByCode = new Map<string, string>()

    for (const row of existingBranchesRes.data || []) {
      const key = normalizeText(row.name)
      if (key) branchByName.set(key, row.id)
    }
    for (const row of existingCategoriesRes.data || []) {
      const key = normalizeText(row.name)
      if (key) categoryByName.set(key, row.id)
    }
    for (const row of existingSuppliersRes.data || []) {
      const nameKey = normalizeText(row.name)
      const phoneKey = normalizeText(row.phone)
      if (nameKey) supplierByName.set(nameKey, row.id)
      if (phoneKey) supplierByPhone.set(phoneKey, row.id)
    }
    for (const row of existingCustomersRes.data || []) {
      const phoneKey = normalizeText(row.phone)
      if (phoneKey) customerByPhone.set(phoneKey, row.id)
    }
    for (const row of existingProductsRes.data || []) {
      const skuKey = normalizeText(row.sku)
      const imeiKey = normalizeText(row.imei)
      if (skuKey) productBySku.set(skuKey, row.id)
      if (imeiKey) productByImei.set(imeiKey, row.id)
    }
    for (const row of existingImportReceiptsRes.data || []) {
      const codeKey = normalizeText(row.code)
      if (codeKey) importReceiptByCode.set(codeKey, row.id)
    }
    for (const row of existingExportReceiptsRes.data || []) {
      const codeKey = normalizeText(row.code)
      if (codeKey) exportReceiptByCode.set(codeKey, row.id)
    }

    const branchMap: Record<string, string> = {}
    const categoryMap: Record<string, string> = {}
    const supplierMap: Record<string, string> = {}
    const customerMap: Record<string, string> = {}
    const productMap: Record<string, string> = {}
    const importReceiptMap: Record<string, string> = {}
    const exportReceiptMap: Record<string, string> = {}

    const productSnapshotByExternal = new Map<string, { sku: string; salePrice: number; categoryId: string | null }>()

    const mapRef = (extId: unknown, map: Record<string, string>): string | null =>
      typeof extId === 'string' && extId ? (map[extId] || null) : null

    try {
      // 1. Branches
      if (Array.isArray(importData.branches) && importData.branches.length > 0) {
        stats.branches.total = importData.branches.length
        for (const b of importData.branches) {
          const extId = typeof b.external_id === 'string' && b.external_id ? b.external_id : `branch_${stats.branches.total}`
          const name = typeof b.name === 'string' ? b.name.trim() : ''
          if (!name) {
            stats.branches.error++
            errors.push('Chi nhánh thiếu tên')
            continue
          }

          const existingId = branchByName.get(normalizeText(name))
          if (existingId) {
            branchMap[extId] = existingId
            stats.branches.skipped++
            continue
          }

          const { data, error } = await adminClient
            .from('branches')
            .insert({
              tenant_id: tenantId,
              name,
              address: b.address ?? null,
              phone: b.phone ?? null,
              is_default: !!b.is_default,
              note: b.note ?? null,
            })
            .select('id')
            .single()

          if (error) {
            stats.branches.error++
            errors.push(`Chi nhánh "${name}": ${error.message}`)
          } else if (data?.id) {
            branchMap[extId] = data.id
            branchByName.set(normalizeText(name), data.id)
            stats.branches.success++
          }
        }
        console.log('Branches:', JSON.stringify(stats.branches))
      }

      // 2. Categories
      if (Array.isArray(importData.categories) && importData.categories.length > 0) {
        stats.categories.total = importData.categories.length
        const pendingWithParent: any[] = []

        for (const c of importData.categories) {
          if (c.parent_external_id) {
            pendingWithParent.push(c)
            continue
          }

          const extId = typeof c.external_id === 'string' && c.external_id ? c.external_id : `cat_${stats.categories.total}`
          const name = typeof c.name === 'string' ? c.name.trim() : ''
          if (!name) {
            stats.categories.error++
            errors.push('Danh mục thiếu tên')
            continue
          }

          const existingId = categoryByName.get(normalizeText(name))
          if (existingId) {
            categoryMap[extId] = existingId
            stats.categories.skipped++
            continue
          }

          const { data, error } = await adminClient
            .from('categories')
            .insert({ tenant_id: tenantId, name })
            .select('id')
            .single()

          if (error) {
            stats.categories.error++
            errors.push(`Danh mục "${name}": ${error.message}`)
          } else if (data?.id) {
            categoryMap[extId] = data.id
            categoryByName.set(normalizeText(name), data.id)
            stats.categories.success++
          }
        }

        for (const c of pendingWithParent) {
          const extId = typeof c.external_id === 'string' && c.external_id ? c.external_id : `cat_${stats.categories.total}`
          const name = typeof c.name === 'string' ? c.name.trim() : ''
          if (!name) {
            stats.categories.error++
            errors.push('Danh mục thiếu tên')
            continue
          }

          const existingId = categoryByName.get(normalizeText(name))
          if (existingId) {
            categoryMap[extId] = existingId
            stats.categories.skipped++
            continue
          }

          const parentId = mapRef(c.parent_external_id, categoryMap)
          const { data, error } = await adminClient
            .from('categories')
            .insert({ tenant_id: tenantId, name, parent_id: parentId })
            .select('id')
            .single()

          if (error) {
            stats.categories.error++
            errors.push(`Danh mục "${name}": ${error.message}`)
          } else if (data?.id) {
            categoryMap[extId] = data.id
            categoryByName.set(normalizeText(name), data.id)
            stats.categories.success++
          }
        }

        console.log('Categories:', JSON.stringify(stats.categories))
      }

      // 3. Suppliers
      if (Array.isArray(importData.suppliers) && importData.suppliers.length > 0) {
        stats.suppliers.total = importData.suppliers.length

        for (const s of importData.suppliers) {
          const extId = typeof s.external_id === 'string' && s.external_id ? s.external_id : `sup_${stats.suppliers.total}`
          const name = typeof s.name === 'string' ? s.name.trim() : ''
          const phone = typeof s.phone === 'string' ? s.phone.trim() : ''

          if (!name) {
            stats.suppliers.error++
            errors.push('NCC thiếu tên')
            continue
          }

          const existingId = (phone ? supplierByPhone.get(normalizeText(phone)) : null)
            || supplierByName.get(normalizeText(name))

          if (existingId) {
            supplierMap[extId] = existingId
            stats.suppliers.skipped++
            continue
          }

          const { data, error } = await adminClient
            .from('suppliers')
            .insert({
              tenant_id: tenantId,
              name,
              phone: phone || null,
              address: s.address ?? null,
              note: s.note ?? null,
              branch_id: mapRef(s.branch_external_id, branchMap),
              debt_due_days: typeof s.debt_due_days === 'number' ? s.debt_due_days : null,
              entity_code: s.entity_code ?? null,
            })
            .select('id')
            .single()

          if (error) {
            stats.suppliers.error++
            errors.push(`NCC "${name}": ${error.message}`)
          } else if (data?.id) {
            supplierMap[extId] = data.id
            supplierByName.set(normalizeText(name), data.id)
            if (phone) supplierByPhone.set(normalizeText(phone), data.id)
            stats.suppliers.success++
          }
        }

        console.log('Suppliers:', JSON.stringify(stats.suppliers))
      }

      // 4. Customers
      if (Array.isArray(importData.customers) && importData.customers.length > 0) {
        stats.customers.total = importData.customers.length

        await processInBatches<any>(importData.customers as any[], 30, async (c, index) => {
          const extId = typeof c.external_id === 'string' && c.external_id ? c.external_id : `cus_${index + 1}`
          const name = typeof c.name === 'string' ? c.name.trim() : ''
          const phone = typeof c.phone === 'string' ? c.phone.trim() : ''

          if (!name || !phone) {
            stats.customers.error++
            errors.push(`KH thiếu thông tin bắt buộc: tên/số điện thoại`)
            return
          }

          const existingId = customerByPhone.get(normalizeText(phone))
          if (existingId) {
            customerMap[extId] = existingId
            stats.customers.skipped++
            return
          }

          const crmStatus = CRM_STATUS.has(c.crm_status) ? c.crm_status : null
          const membershipTier = MEMBERSHIP_TIER.has(c.membership_tier) ? c.membership_tier : 'regular'
          const customerStatus = CUSTOMER_STATUS.has(c.status) ? c.status : 'active'

          const { data, error } = await adminClient
            .from('customers')
            .insert({
              tenant_id: tenantId,
              name,
              phone,
              email: c.email ?? null,
              address: c.address ?? null,
              birthday: c.birthday ?? null,
              entity_code: c.entity_code ?? null,
              source: c.source ?? null,
              note: c.note ?? null,
              total_spent: toNumber(c.total_spent, 0),
              current_points: toNumber(c.current_points, 0),
              pending_points: toNumber(c.pending_points, 0),
              total_points_earned: toNumber(c.total_points_earned, 0),
              total_points_used: toNumber(c.total_points_used, 0),
              membership_tier: membershipTier,
              status: customerStatus,
              debt_due_days: typeof c.debt_due_days === 'number' ? c.debt_due_days : null,
              last_purchase_date: c.last_purchase_date ?? null,
              preferred_branch_id: mapRef(c.preferred_branch_external_id, branchMap),
              crm_status: crmStatus,
            })
            .select('id')
            .single()

          if (error) {
            stats.customers.error++
            errors.push(`KH "${name}" (${phone}): ${error.message}`)
          } else if (data?.id) {
            customerMap[extId] = data.id
            customerByPhone.set(normalizeText(phone), data.id)
            stats.customers.success++
          }
        })

        console.log('Customers:', JSON.stringify(stats.customers))
      }

      // 5. Products
      if (Array.isArray(importData.products) && importData.products.length > 0) {
        stats.products.total = importData.products.length

        await processInBatches<any>(importData.products as any[], 25, async (p, index) => {
          const extId = typeof p.external_id === 'string' && p.external_id ? p.external_id : `prod_${index + 1}`
          const name = typeof p.name === 'string' ? p.name.trim() : ''
          const sku = typeof p.sku === 'string' && p.sku.trim() ? p.sku.trim() : `AUTO-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
          const imei = typeof p.imei === 'string' && p.imei.trim() ? p.imei.trim() : null

          if (!name) {
            stats.products.error++
            errors.push('Sản phẩm thiếu tên')
            return
          }

          const existingId = productBySku.get(normalizeText(sku)) || (imei ? productByImei.get(normalizeText(imei)) : null)
          if (existingId) {
            productMap[extId] = existingId
            productSnapshotByExternal.set(extId, {
              sku,
              salePrice: toNumber(p.sale_price, 0),
              categoryId: mapRef(p.category_external_id, categoryMap),
            })
            stats.products.skipped++
            return
          }

          const quantity = Math.max(1, toNumber(p.quantity, 1))
          const importPrice = toNumber(p.import_price, 0)
          const salePrice = toNumber(p.sale_price, 0)
          const productStatus = PRODUCT_STATUS.has(p.status) ? p.status : 'in_stock'

          const { data, error } = await adminClient
            .from('products')
            .insert({
              tenant_id: tenantId,
              name,
              sku,
              imei,
              category_id: mapRef(p.category_external_id, categoryMap),
              import_price: importPrice,
              import_date: toDate(p.import_date ?? p.created_at, new Date().toISOString()),
              supplier_id: mapRef(p.supplier_external_id, supplierMap),
              status: productStatus,
              note: p.note ?? null,
              branch_id: mapRef(p.branch_external_id, branchMap),
              quantity,
              total_import_cost: toNumber(p.total_import_cost, importPrice * quantity),
              warranty_note: p.warranty ?? null,
              sale_price: salePrice,
              group_id: p.group_id ?? null,
              variant_1: p.version_name ?? null,
              variant_2: p.version_value ?? null,
              variant_3: p.color ?? null,
            })
            .select('id')
            .single()

          if (error) {
            stats.products.error++
            errors.push(`SP "${name}": ${error.message}`)
          } else if (data?.id) {
            productMap[extId] = data.id
            productBySku.set(normalizeText(sku), data.id)
            if (imei) productByImei.set(normalizeText(imei), data.id)
            productSnapshotByExternal.set(extId, {
              sku,
              salePrice,
              categoryId: mapRef(p.category_external_id, categoryMap),
            })
            stats.products.success++
          }
        })

        console.log('Products:', JSON.stringify(stats.products))
      }

      // 6. Import receipts
      if (Array.isArray(importData.import_receipts) && importData.import_receipts.length > 0) {
        stats.import_receipts.total = importData.import_receipts.length

        await processInBatches<any>(importData.import_receipts as any[], 30, async (r, index) => {
          const extId = typeof r.external_id === 'string' && r.external_id ? r.external_id : `imp_${index + 1}`
          const code = typeof r.code === 'string' ? r.code.trim() : ''

          if (!code) {
            stats.import_receipts.error++
            errors.push('Phiếu nhập thiếu mã')
            return
          }

          const existingId = importReceiptByCode.get(normalizeText(code))
          if (existingId) {
            importReceiptMap[extId] = existingId
            stats.import_receipts.skipped++
            return
          }

          const totalAmount = toNumber(r.total_amount, 0)
          const paidAmount = toNumber(r.paid_amount, 0)
          const debtAmount = Math.max(0, totalAmount - paidAmount)
          const receiptStatus = RECEIPT_STATUS.has(r.status) ? r.status : 'completed'

          const { data, error } = await adminClient
            .from('import_receipts')
            .insert({
              tenant_id: tenantId,
              code,
              supplier_id: mapRef(r.supplier_external_id, supplierMap),
              branch_id: mapRef(r.branch_external_id, branchMap),
              total_amount: totalAmount,
              paid_amount: paidAmount,
              debt_amount: debtAmount,
              original_debt_amount: typeof r.original_debt_amount === 'number' ? r.original_debt_amount : debtAmount,
              import_date: toDate(r.import_date, new Date().toISOString()),
              note: r.note ?? null,
              status: receiptStatus,
            })
            .select('id')
            .single()

          if (error) {
            stats.import_receipts.error++
            errors.push(`PN "${code}": ${error.message}`)
          } else if (data?.id) {
            importReceiptMap[extId] = data.id
            importReceiptByCode.set(normalizeText(code), data.id)
            stats.import_receipts.success++
          }
        })

        console.log('Import receipts:', JSON.stringify(stats.import_receipts))
      }

      // 7. Export receipts
      if (Array.isArray(importData.export_receipts) && importData.export_receipts.length > 0) {
        stats.export_receipts.total = importData.export_receipts.length

        await processInBatches<any>(importData.export_receipts as any[], 30, async (r, index) => {
          const extId = typeof r.external_id === 'string' && r.external_id ? r.external_id : `exp_${index + 1}`
          const code = typeof r.code === 'string' ? r.code.trim() : ''

          if (!code) {
            stats.export_receipts.error++
            errors.push('Phiếu xuất thiếu mã')
            return
          }

          const existingId = exportReceiptByCode.get(normalizeText(code))
          if (existingId) {
            exportReceiptMap[extId] = existingId
            stats.export_receipts.skipped++
            return
          }

          const totalAmount = toNumber(r.total_amount, 0)
          const paidAmount = toNumber(r.paid_amount, 0)
          const debtAmount = Math.max(0, totalAmount - paidAmount)

          const { data, error } = await adminClient
            .from('export_receipts')
            .insert({
              tenant_id: tenantId,
              code,
              customer_id: mapRef(r.customer_external_id, customerMap),
              branch_id: mapRef(r.branch_external_id, branchMap),
              total_amount: totalAmount,
              paid_amount: paidAmount,
              debt_amount: debtAmount,
              original_debt_amount: typeof r.original_debt_amount === 'number' ? r.original_debt_amount : debtAmount,
              voucher_discount: toNumber(r.voucher_discount, 0),
              points_discount: toNumber(r.points_discount, 0),
              export_date: toDate(r.export_date, new Date().toISOString()),
              note: r.note ?? null,
              status: typeof r.status === 'string' && r.status ? r.status : 'completed',
            })
            .select('id')
            .single()

          if (error) {
            stats.export_receipts.error++
            errors.push(`PX "${code}": ${error.message}`)
          } else if (data?.id) {
            exportReceiptMap[extId] = data.id
            exportReceiptByCode.set(normalizeText(code), data.id)
            stats.export_receipts.success++
          }
        })

        console.log('Export receipts:', JSON.stringify(stats.export_receipts))
      }

      // 8. Export receipt items
      if (Array.isArray(importData.export_receipt_items) && importData.export_receipt_items.length > 0) {
        stats.export_receipt_items.total = importData.export_receipt_items.length

        await processInBatches<any>(importData.export_receipt_items as any[], 50, async (item) => {
          const receiptId = mapRef(item.receipt_external_id, exportReceiptMap)
          if (!receiptId) {
            stats.export_receipt_items.skipped++
            return
          }

          const productId = mapRef(item.product_external_id, productMap)
          const snapshot = typeof item.product_external_id === 'string'
            ? productSnapshotByExternal.get(item.product_external_id)
            : undefined

          const sku = typeof item.sku === 'string' && item.sku.trim()
            ? item.sku.trim()
            : (snapshot?.sku || '')
          const salePrice = toNumber(item.sale_price, toNumber(item.unit_price, snapshot?.salePrice ?? 0))
          const categoryId = mapRef(item.category_external_id, categoryMap) || snapshot?.categoryId || null
          const status = PRODUCT_STATUS.has(item.status) ? item.status : 'sold'

          const { error } = await adminClient
            .from('export_receipt_items')
            .insert({
              receipt_id: receiptId,
              product_id: productId,
              product_name: item.product_name || 'Sản phẩm',
              sku,
              imei: item.imei ?? null,
              category_id: categoryId,
              sale_price: salePrice,
              status,
              note: item.note ?? null,
              warranty: item.warranty ?? null,
            })

          if (error) {
            stats.export_receipt_items.error++
            errors.push(`Chi tiết PX "${item.product_name || 'N/A'}": ${error.message}`)
          } else {
            stats.export_receipt_items.success++
          }
        })

        console.log('Export receipt items:', JSON.stringify(stats.export_receipt_items))
      }

      // 9. Export receipt payments
      if (Array.isArray(importData.export_receipt_payments) && importData.export_receipt_payments.length > 0) {
        stats.export_receipt_payments.total = importData.export_receipt_payments.length

        await processInBatches<any>(importData.export_receipt_payments as any[], 50, async (p) => {
          const receiptId = mapRef(p.receipt_external_id, exportReceiptMap)
          if (!receiptId) {
            stats.export_receipt_payments.skipped++
            return
          }

          const paymentType = typeof p.payment_type === 'string' && p.payment_type
            ? p.payment_type
            : (typeof p.payment_source === 'string' && p.payment_source ? p.payment_source : 'cash')

          const { error } = await adminClient
            .from('export_receipt_payments')
            .insert({
              receipt_id: receiptId,
              payment_type: paymentType,
              amount: toNumber(p.amount, 0),
            })

          if (error) {
            stats.export_receipt_payments.error++
            errors.push(`Thanh toán PX: ${error.message}`)
          } else {
            stats.export_receipt_payments.success++
          }
        })

        console.log('Export receipt payments:', JSON.stringify(stats.export_receipt_payments))
      }

      // 10. Cash book
      if (Array.isArray(importData.cash_book) && importData.cash_book.length > 0) {
        stats.cash_book.total = importData.cash_book.length

        await processInBatches<any>(importData.cash_book as any[], 50, async (cb) => {
          const { error } = await adminClient
            .from('cash_book')
            .insert({
              tenant_id: tenantId,
              type: cb.type,
              category: cb.category,
              description: cb.description || 'Giao dịch import',
              amount: toNumber(cb.amount, 0),
              payment_source: cb.payment_source || 'Tiền mặt',
              transaction_date: toDate(cb.transaction_date, new Date().toISOString()),
              note: cb.note ?? null,
              recipient_name: cb.recipient_name ?? null,
              recipient_phone: cb.recipient_phone ?? null,
              reference_type: cb.reference_type ?? null,
              is_business_accounting: typeof cb.is_business_accounting === 'boolean' ? cb.is_business_accounting : true,
              branch_id: mapRef(cb.branch_external_id, branchMap),
              created_by_name: cb.created_by_name ?? null,
            })

          if (error) {
            stats.cash_book.error++
            errors.push(`Sổ quỹ: ${error.message}`)
          } else {
            stats.cash_book.success++
          }
        })

        console.log('Cash book:', JSON.stringify(stats.cash_book))
      }

      // 11. Debt payments
      if (Array.isArray(importData.debt_payments) && importData.debt_payments.length > 0) {
        stats.debt_payments.total = importData.debt_payments.length

        await processInBatches<any>(importData.debt_payments as any[], 50, async (dp) => {
          const entityType = typeof dp.entity_type === 'string' && dp.entity_type ? dp.entity_type : 'customer'
          let entityId: string | null = null

          if (typeof dp.entity_id === 'string' && isUuid(dp.entity_id)) {
            entityId = dp.entity_id
          } else if (typeof dp.entity_id === 'string') {
            if (entityType === 'supplier') entityId = mapRef(dp.entity_id, supplierMap)
            else entityId = mapRef(dp.entity_id, customerMap)
          }

          if (!entityId) {
            stats.debt_payments.skipped++
            errors.push(`Thanh toán nợ bỏ qua: không map được entity_id (${dp.entity_id || 'N/A'})`)
            return
          }

          const { error } = await adminClient
            .from('debt_payments')
            .insert({
              tenant_id: tenantId,
              entity_id: entityId,
              entity_type: entityType,
              payment_type: dp.payment_type || 'payment',
              amount: toNumber(dp.amount, 0),
              allocated_amount: toNumber(dp.allocated_amount, 0),
              balance_after: typeof dp.balance_after === 'number' ? dp.balance_after : null,
              description: dp.description || 'Thanh toán nợ từ import',
              payment_source: dp.payment_source ?? null,
              branch_id: mapRef(dp.branch_external_id, branchMap),
            })

          if (error) {
            stats.debt_payments.error++
            errors.push(`Thanh toán nợ: ${error.message}`)
          } else {
            stats.debt_payments.success++
          }
        })

        console.log('Debt payments:', JSON.stringify(stats.debt_payments))
      }

      // 12. Web config
      if (importData.web_config) {
        stats.web_config.total = 1
        const wc = importData.web_config

        const { error } = await adminClient
          .from('tenant_landing_settings')
          .upsert({
            tenant_id: tenantId,
            store_name: wc.store_name ?? null,
            store_description: wc.store_description ?? null,
            store_phone: wc.store_phone ?? null,
            store_email: wc.store_email ?? null,
            store_address: wc.store_address ?? null,
            additional_addresses: Array.isArray(wc.additional_addresses) ? wc.additional_addresses : null,
            store_logo_url: wc.logo_url ?? wc.store_logo_url ?? null,
            banner_image_url: wc.banner_url ?? wc.banner_image_url ?? null,
            primary_color: wc.primary_color ?? null,
            facebook_url: wc.facebook_url ?? null,
            zalo_url: wc.zalo_url ?? null,
            tiktok_url: wc.tiktok_url ?? null,
          }, { onConflict: 'tenant_id' })

        if (error) {
          stats.web_config.error++
          errors.push(`Web config: ${error.message}`)
        } else {
          stats.web_config.success++
        }
      }
    } catch (innerError) {
      const message = (innerError as Error).message || 'Unknown import error'
      errors.push(`Fatal: ${message}`)
      console.error('Fatal:', message)
    }

    const summary = summarize(stats)
    console.log('Import complete:', JSON.stringify({ summary, stats }))

    try {
      await adminClient.from('audit_logs').insert({
        tenant_id: tenantId,
        user_id: user.id,
        action_type: 'CROSS_PLATFORM_IMPORT',
        table_name: 'ALL',
        description: `Import JSON v1.0 (${mode}). Summary: ${JSON.stringify(summary)}`,
      })
    } catch (auditErr) {
      console.warn('Audit log error:', (auditErr as Error).message)
    }

    return jsonResponse(200, {
      success: summary.total_failed === 0 && errors.length === 0,
      mode,
      summary,
      stats,
      total_errors: errors.length,
      errors: errors.slice(0, 100),
      report: {
        suppliers: stats.suppliers,
        customers: stats.customers,
        orders: {
          import_receipts: stats.import_receipts,
          export_receipts: stats.export_receipts,
        },
      },
    })
  } catch (error) {
    console.error('Import error:', (error as Error).message)
    return jsonResponse(500, {
      success: false,
      error: (error as Error).message,
      summary: {
        total_records: 0,
        total_success: 0,
        total_skipped: 0,
        total_failed: 1,
      },
      stats: createStats(),
      total_errors: 1,
      errors: [(error as Error).message],
    })
  }
})
