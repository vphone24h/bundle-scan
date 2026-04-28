import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-job-internal-key',
}

const INTERNAL_JOB_HEADER = 'x-job-internal-key'
const DEFAULT_CHUNK_SIZE = 100

// Tables with unique constraints beyond just 'id'
// Map: table_name -> onConflict columns for fallback upsert
const UNIQUE_CONSTRAINT_TABLES: Record<string, string> = {
  customers: 'tenant_id,phone',
  suppliers: 'tenant_id,name',
  categories: 'id', // has complex unique, just use id with ignore
  branches: 'id',
}

type RestoreMode = 'merge' | 'overwrite'
type StatBucket = { total: number; success: number; skipped: number; error: number }
type RestoreSummary = {
  stats: Record<string, StatBucket>
  summary: {
    total_records: number
    total_success: number
    total_skipped: number
    total_failed: number
  }
  errors: string[]
  total_errors: number
}

type RestoreConfig = {
  key: string
  table?: string
  label: string
  chunkSize?: number
  mode?: 'table' | 'web_config'
  skip?: boolean
}

type RestoreOperation = {
  key: string
  table?: string
  label: string
  mode: 'table' | 'web_config'
  chunkIndex: number
  totalChunks: number
  from: number
  to: number
}

const RESTORE_CONFIGS: RestoreConfig[] = [
  { key: 'branches', table: 'branches', label: 'Chi nhánh' },
  { key: 'categories', table: 'categories', label: 'Danh mục' },
  { key: 'suppliers', table: 'suppliers', label: 'Nhà cung cấp' },
  { key: 'customers', table: 'customers', label: 'Khách hàng', chunkSize: 80 },
  { key: 'product_groups', table: 'product_groups', label: 'Nhóm sản phẩm' },
  { key: 'products', table: 'products', label: 'Sản phẩm', chunkSize: 50 },
  { key: 'import_receipts', table: 'import_receipts', label: 'Phiếu nhập', chunkSize: 50 },
  { key: 'receipt_payments', table: 'receipt_payments', label: 'Thanh toán phiếu nhập', chunkSize: 80 },
  { key: 'product_imports', table: 'product_imports', label: 'Lịch sử nhập sản phẩm', chunkSize: 80 },
  { key: 'export_receipts', table: 'export_receipts', label: 'Phiếu xuất', chunkSize: 50 },
  { key: 'export_receipt_items', table: 'export_receipt_items', label: 'Chi tiết phiếu xuất', chunkSize: 60 },
  { key: 'export_receipt_payments', table: 'export_receipt_payments', label: 'Thanh toán phiếu xuất', chunkSize: 80 },
  { key: 'export_returns', table: 'export_returns', label: 'Trả hàng bán', chunkSize: 60 },
  { key: 'import_returns', table: 'import_returns', label: 'Trả hàng nhập', chunkSize: 60 },
  { key: 'return_payments', table: 'return_payments', label: 'Thanh toán trả hàng', chunkSize: 80 },
  { key: 'stock_counts', table: 'stock_counts', label: 'Phiếu kiểm kho', chunkSize: 50 },
  { key: 'stock_count_items', table: 'stock_count_items', label: 'Chi tiết kiểm kho', chunkSize: 60 },
  { key: 'stock_transfer_requests', table: 'stock_transfer_requests', label: 'Phiếu chuyển kho', chunkSize: 50 },
  { key: 'stock_transfer_items', table: 'stock_transfer_items', label: 'Chi tiết chuyển kho', chunkSize: 60 },
  { key: 'imei_histories', table: 'imei_histories', label: 'Lịch sử IMEI', chunkSize: 80 },
  { key: 'cash_book', table: 'cash_book', label: 'Sổ quỹ', chunkSize: 80 },
  { key: 'cash_book_opening_balances', table: 'cash_book_opening_balances', label: 'Số dư đầu kỳ' },
  { key: 'debt_payments', table: 'debt_payments', label: 'Thanh toán công nợ', chunkSize: 80 },
  { key: 'debt_offsets', table: 'debt_offsets', label: 'Bù trừ công nợ', chunkSize: 80 },
  { key: 'debt_settings', table: 'debt_settings', label: 'Cấu hình công nợ' },
  { key: 'debt_tags', table: 'debt_tags', label: 'Nhãn công nợ' },
  { key: 'debt_tag_assignments', table: 'debt_tag_assignments', label: 'Gán nhãn công nợ', chunkSize: 80 },
  { key: 'care_schedule_types', table: 'care_schedule_types', label: 'Loại lịch chăm sóc' },
  { key: 'customer_care_schedules', table: 'customer_care_schedules', label: 'Lịch chăm sóc', chunkSize: 60 },
  { key: 'customer_care_logs', table: 'customer_care_logs', label: 'Nhật ký chăm sóc', chunkSize: 80 },
  { key: 'care_reminders', table: 'care_reminders', label: 'Nhắc lịch chăm sóc', chunkSize: 80 },
  { key: 'customer_tags', table: 'customer_tags', label: 'Tag khách hàng' },
  { key: 'customer_tag_assignments', table: 'customer_tag_assignments', label: 'Gán tag khách hàng', chunkSize: 80 },
  { key: 'customer_sources', table: 'customer_sources', label: 'Nguồn khách hàng' },
  { key: 'customer_contact_channels', table: 'customer_contact_channels', label: 'Kênh liên hệ khách hàng', chunkSize: 80 },
  { key: 'customer_vouchers', table: 'customer_vouchers', label: 'Voucher khách hàng', chunkSize: 60 },
  { key: 'point_settings', table: 'point_settings', label: 'Cấu hình tích điểm' },
  { key: 'point_transactions', table: 'point_transactions', label: 'Lịch sử điểm', chunkSize: 80 },
  { key: 'membership_tier_settings', table: 'membership_tier_settings', label: 'Hạng thành viên' },
  { key: 'crm_notifications', table: 'crm_notifications', label: 'Thông báo CRM', chunkSize: 80 },
  { key: 'staff_reviews', table: 'staff_reviews', label: 'Đánh giá nhân viên', chunkSize: 80 },
  { key: 'staff_kpi_settings', table: 'staff_kpi_settings', label: 'Cấu hình KPI' },
  { key: 'staff_performance_snapshots', table: 'staff_performance_snapshots', label: 'Ảnh chụp KPI', chunkSize: 80 },
  { key: 'custom_payment_sources', table: 'custom_payment_sources', label: 'Nguồn tiền tuỳ chỉnh' },
  { key: 'invoice_templates', table: 'invoice_templates', label: 'Mẫu hoá đơn' },
  { key: 'voucher_templates', table: 'voucher_templates', label: 'Mẫu voucher' },
  { key: 'einvoice_configs', table: 'einvoice_configs', label: 'Cấu hình hoá đơn điện tử' },
  { key: 'custom_domains', table: 'custom_domains', label: 'Tên miền tuỳ chỉnh' },
  { key: 'security_passwords', table: 'security_passwords', label: 'Mật khẩu bảo vệ' },
  { key: 'landing_product_categories', table: 'landing_product_categories', label: 'Danh mục landing' },
  { key: 'landing_products', table: 'landing_products', label: 'Sản phẩm landing', chunkSize: 60 },
  { key: 'landing_articles', table: 'landing_articles', label: 'Bài viết landing', chunkSize: 60 },
  { key: 'landing_article_categories', table: 'landing_article_categories', label: 'Danh mục bài viết landing' },
  { key: 'landing_orders', table: 'landing_orders', label: 'Đơn landing', chunkSize: 60 },
  { key: 'landing_product_blocked_dates', table: 'landing_product_blocked_dates', label: 'Ngày chặn landing', chunkSize: 80 },
  { key: 'landing_order_email_logs', table: 'landing_order_email_logs', label: 'Log email landing', chunkSize: 80 },
  { key: 'shop_collaborators', table: 'shop_collaborators', label: 'Cộng tác viên shop', chunkSize: 60 },
  { key: 'shop_ctv_orders', table: 'shop_ctv_orders', label: 'Đơn CTV', chunkSize: 60 },
  { key: 'shop_ctv_settings', table: 'shop_ctv_settings', label: 'Cấu hình CTV' },
  { key: 'shop_ctv_withdrawals', table: 'shop_ctv_withdrawals', label: 'Rút tiền CTV', chunkSize: 60 },
  { key: 'email_automations', table: 'email_automations', label: 'Tự động email', chunkSize: 60 },
  { key: 'email_automation_blocks', table: 'email_automation_blocks', label: 'Block email', chunkSize: 80 },
  { key: 'zalo_message_logs', table: 'zalo_message_logs', label: 'Log Zalo', chunkSize: 80 },
  { key: 'zalo_oa_followers', table: 'zalo_oa_followers', label: 'Follower Zalo OA', chunkSize: 80 },
  { key: 'einvoices', table: 'einvoices', label: 'Hoá đơn điện tử', chunkSize: 50 },
  { key: 'einvoice_items', table: 'einvoice_items', label: 'Chi tiết hoá đơn điện tử', chunkSize: 80 },
  { key: 'einvoice_logs', table: 'einvoice_logs', label: 'Log hoá đơn điện tử', chunkSize: 80 },
  { key: 'warehouse_value_snapshots', table: 'warehouse_value_snapshots', label: 'Snapshot giá trị kho', chunkSize: 80 },
  { key: 'onboarding_tours', table: 'onboarding_tours', label: 'Hướng dẫn onboarding', chunkSize: 80 },
  { key: 'user_branch_access', label: 'Phân quyền chi nhánh', skip: true },
  { key: 'user_roles_backup', label: 'Vai trò người dùng', skip: true },
  { key: 'notification_automations', label: 'Automation thông báo', skip: true },
  { key: 'web_config', table: 'tenant_landing_settings', label: 'Cấu hình web', mode: 'web_config' },
]

const jsonResponse = (status: number, payload: Record<string, unknown>) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

function createAdminClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

function createBucket(total = 0): StatBucket {
  return { total, success: 0, skipped: 0, error: 0 }
}

function summarize(stats: Record<string, StatBucket>) {
  return {
    total_records: Object.values(stats).reduce((acc, stat) => acc + (stat.total || 0), 0),
    total_success: Object.values(stats).reduce((acc, stat) => acc + (stat.success || 0), 0),
    total_skipped: Object.values(stats).reduce((acc, stat) => acc + (stat.skipped || 0), 0),
    total_failed: Object.values(stats).reduce((acc, stat) => acc + (stat.error || 0), 0),
  }
}

function normalizeMode(value: unknown): RestoreMode {
  return value === 'overwrite' ? 'overwrite' : 'merge'
}

function normalizeBackupVersion(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value.toFixed(1)
  }

  if (typeof value !== 'string') {
    return null
  }

  const normalized = value.trim().replace(/^v/i, '')
  if (/^\d+$/.test(normalized)) {
    return `${normalized}.0`
  }

  return /^\d+\.\d+$/.test(normalized) ? normalized : null
}

function createInitialResult(importData: any): RestoreSummary {
  const stats: Record<string, StatBucket> = {}

  for (const config of RESTORE_CONFIGS) {
    if (config.skip) continue

    const total = config.mode === 'web_config'
      ? (importData?.web_config ? 1 : 0)
      : (Array.isArray(importData?.[config.key]) ? importData[config.key].length : 0)

    if (total > 0) {
      stats[config.key] = createBucket(total)
    }
  }

  return {
    stats,
    summary: summarize(stats),
    errors: [],
    total_errors: 0,
  }
}

function normalizeResult(importData: any, raw: any): RestoreSummary {
  const base = createInitialResult(importData)
  const stats = { ...base.stats, ...(raw?.stats || {}) }
  const errors = Array.isArray(raw?.errors) ? raw.errors.filter((item: unknown) => typeof item === 'string') : []

  return {
    stats,
    errors,
    total_errors: typeof raw?.total_errors === 'number' ? raw.total_errors : errors.length,
    summary: summarize(stats),
  }
}

function buildOperations(importData: any): RestoreOperation[] {
  const operations: RestoreOperation[] = []

  for (const config of RESTORE_CONFIGS) {
    if (config.skip) continue

    if (config.mode === 'web_config') {
      if (importData?.web_config) {
        operations.push({
          key: config.key,
          table: config.table,
          label: config.label,
          mode: 'web_config',
          chunkIndex: 0,
          totalChunks: 1,
          from: 0,
          to: 1,
        })
      }
      continue
    }

    const rows = Array.isArray(importData?.[config.key]) ? importData[config.key] : []
    if (!rows.length || !config.table) continue

    const chunkSize = config.chunkSize || DEFAULT_CHUNK_SIZE
    const totalChunks = Math.ceil(rows.length / chunkSize)

    for (let index = 0; index < rows.length; index += chunkSize) {
      operations.push({
        key: config.key,
        table: config.table,
        label: config.label,
        mode: 'table',
        chunkIndex: Math.floor(index / chunkSize),
        totalChunks,
        from: index,
        to: Math.min(index + chunkSize, rows.length),
      })
    }
  }

  return operations
}

function cloneRow<T>(value: T): T {
  return JSON.parse(JSON.stringify(value))
}

type RestoreContext = {
  adminClient: any
  targetTenantId: string
  sourceTenantId: string | null
  crossTenantClone: boolean
  restoreMode: RestoreMode
  sourceIndexes: Record<string, Map<string, any>>
  resolvedIdCache: Map<string, string | null>
}

function detectSourceTenantId(importData: any): string | null {
  const directCandidates = [importData?.tenant?.id, importData?.tenant_id]
  for (const candidate of directCandidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim()
    }
  }

  for (const value of Object.values(importData || {})) {
    if (Array.isArray(value)) {
      const row = value.find((item) => item && typeof item === 'object' && typeof item.tenant_id === 'string')
      if (row?.tenant_id) {
        return row.tenant_id
      }
    } else if (value && typeof value === 'object' && typeof (value as any).tenant_id === 'string') {
      return (value as any).tenant_id
    }
  }

  return null
}

function buildSourceIndexes(importData: any) {
  const indexes: Record<string, Map<string, any>> = {}

  for (const [key, value] of Object.entries(importData || {})) {
    if (!Array.isArray(value)) continue
    const map = new Map<string, any>()

    for (const row of value) {
      if (row && typeof row === 'object' && typeof row.id === 'string') {
        map.set(row.id, row)
      }
    }

    if (map.size > 0) {
      indexes[key] = map
    }
  }

  return indexes
}

function cyrb128(value: string) {
  let h1 = 1779033703
  let h2 = 3144134277
  let h3 = 1013904242
  let h4 = 2773480762

  for (let index = 0; index < value.length; index++) {
    const code = value.charCodeAt(index)
    h1 = h2 ^ Math.imul(h1 ^ code, 597399067)
    h2 = h3 ^ Math.imul(h2 ^ code, 2869860233)
    h3 = h4 ^ Math.imul(h3 ^ code, 951274213)
    h4 = h1 ^ Math.imul(h4 ^ code, 2716044179)
  }

  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067)
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233)
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213)
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179)

  return [(h1 ^ h2 ^ h3 ^ h4) >>> 0, (h2 ^ h1) >>> 0, (h3 ^ h1) >>> 0, (h4 ^ h1) >>> 0]
}

function deterministicCloneId(targetTenantId: string, tableName: string, sourceId: string) {
  const input = `${targetTenantId}:${tableName}:${sourceId}`
  const hex = cyrb128(input)
    .map((part) => part.toString(16).padStart(8, '0'))
    .join('')
    .slice(0, 32)
    .split('')

  hex[12] = '5'
  hex[16] = ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16)

  return `${hex.slice(0, 8).join('')}-${hex.slice(8, 12).join('')}-${hex.slice(12, 16).join('')}-${hex.slice(16, 20).join('')}-${hex.slice(20, 32).join('')}`
}

function createRestoreContext(adminClient: any, importData: any, targetTenantId: string, restoreMode: RestoreMode): RestoreContext {
  const sourceTenantId = detectSourceTenantId(importData)

  return {
    adminClient,
    targetTenantId,
    sourceTenantId,
    crossTenantClone: !sourceTenantId || sourceTenantId !== targetTenantId,
    restoreMode,
    sourceIndexes: buildSourceIndexes(importData),
    resolvedIdCache: new Map<string, string | null>(),
  }
}

async function queryExistingId(builder: any): Promise<string | null> {
  const { data, error } = await builder.limit(1)
  if (error) throw error
  return Array.isArray(data) && data.length > 0 ? data[0].id : null
}

async function findExistingTargetId(tableName: string, sourceRow: any, context: RestoreContext): Promise<string | null> {
  if (!sourceRow || context.restoreMode !== 'merge') return null

  switch (tableName) {
    case 'branches':
    case 'suppliers':
    case 'customer_tags':
    case 'customer_sources':
    case 'debt_tags':
    case 'care_schedule_types':
    case 'voucher_templates':
    case 'invoice_templates':
    case 'landing_product_categories':
    case 'landing_article_categories': {
      if (!sourceRow.name) return null
      return await queryExistingId(
        context.adminClient.from(tableName).select('id').eq('tenant_id', context.targetTenantId).eq('name', sourceRow.name)
      )
    }

    case 'customers': {
      if (sourceRow.phone) {
        const matchByPhone = await queryExistingId(
          context.adminClient.from('customers').select('id').eq('tenant_id', context.targetTenantId).eq('phone', sourceRow.phone)
        )
        if (matchByPhone) return matchByPhone
      }
      if (sourceRow.entity_code) {
        const matchByCode = await queryExistingId(
          context.adminClient.from('customers').select('id').eq('tenant_id', context.targetTenantId).eq('entity_code', sourceRow.entity_code)
        )
        if (matchByCode) return matchByCode
      }
      if (sourceRow.email) {
        const matchByEmail = await queryExistingId(
          context.adminClient.from('customers').select('id').eq('tenant_id', context.targetTenantId).eq('email', sourceRow.email)
        )
        if (matchByEmail) return matchByEmail
      }
      if (!sourceRow.name) return null
      return await queryExistingId(
        context.adminClient.from('customers').select('id').eq('tenant_id', context.targetTenantId).eq('name', sourceRow.name)
      )
    }

    case 'categories': {
      if (!sourceRow.name) return null
      const resolvedParentId = sourceRow.parent_id
        ? await resolveSourceId('categories', sourceRow.parent_id, context)
        : null
      let query = context.adminClient
        .from('categories')
        .select('id')
        .eq('tenant_id', context.targetTenantId)
        .eq('name', sourceRow.name)
      query = resolvedParentId ? query.eq('parent_id', resolvedParentId) : query.is('parent_id', null)
      return await queryExistingId(query)
    }

    case 'product_groups': {
      if (!sourceRow.name) return null
      let query = context.adminClient
        .from('product_groups')
        .select('id')
        .eq('tenant_id', context.targetTenantId)
        .eq('name', sourceRow.name)
      if (sourceRow.category_id) {
        const categoryId = await resolveSourceId('categories', sourceRow.category_id, context)
        if (categoryId) {
          query = query.eq('category_id', categoryId)
        }
      }
      return await queryExistingId(query)
    }

    case 'products': {
      for (const field of ['sku', 'imei', 'barcode']) {
        if (!sourceRow[field]) continue
        const match = await queryExistingId(
          context.adminClient.from('products').select('id').eq('tenant_id', context.targetTenantId).eq(field, sourceRow[field])
        )
        if (match) return match
      }
      return null
    }

    case 'import_receipts':
    case 'export_receipts':
    case 'export_returns':
    case 'import_returns':
    case 'stock_counts':
    case 'stock_transfer_requests': {
      if (!sourceRow.code) return null
      return await queryExistingId(
        context.adminClient.from(tableName).select('id').eq('tenant_id', context.targetTenantId).eq('code', sourceRow.code)
      )
    }

    case 'debt_settings':
    case 'point_settings':
    case 'shop_ctv_settings':
    case 'security_passwords': {
      return await queryExistingId(
        context.adminClient.from(tableName).select('id').eq('tenant_id', context.targetTenantId)
      )
    }

    case 'custom_payment_sources': {
      if (sourceRow.source_key) {
        const matchByKey = await queryExistingId(
          context.adminClient.from('custom_payment_sources').select('id').eq('tenant_id', context.targetTenantId).eq('source_key', sourceRow.source_key)
        )
        if (matchByKey) return matchByKey
      }
      if (!sourceRow.name) return null
      return await queryExistingId(
        context.adminClient.from('custom_payment_sources').select('id').eq('tenant_id', context.targetTenantId).eq('name', sourceRow.name)
      )
    }

    case 'email_automations': {
      if (!sourceRow.name) return null
      return await queryExistingId(
        context.adminClient.from('email_automations').select('id').eq('tenant_id', context.targetTenantId).eq('name', sourceRow.name)
      )
    }

    case 'einvoice_configs': {
      if (sourceRow.provider_name && sourceRow.tax_code) {
        const match = await queryExistingId(
          context.adminClient.from('einvoice_configs').select('id').eq('tenant_id', context.targetTenantId).eq('provider_name', sourceRow.provider_name).eq('tax_code', sourceRow.tax_code)
        )
        if (match) return match
      }
      return null
    }

    case 'custom_domains': {
      if (!sourceRow.domain) return null
      return await queryExistingId(
        context.adminClient.from('custom_domains').select('id').eq('tenant_id', context.targetTenantId).eq('domain', sourceRow.domain)
      )
    }

    default:
      return null
  }
}

async function resolveSourceId(tableName: string, sourceId: string | null | undefined, context: RestoreContext): Promise<string | null> {
  if (!sourceId) return null

  const cacheKey = `${tableName}:${sourceId}`
  if (context.resolvedIdCache.has(cacheKey)) {
    return context.resolvedIdCache.get(cacheKey) ?? null
  }

  if (!context.crossTenantClone) {
    context.resolvedIdCache.set(cacheKey, sourceId)
    return sourceId
  }

  const sourceRow = context.sourceIndexes[tableName]?.get(sourceId) ?? null
  const existingId = await findExistingTargetId(tableName, sourceRow, context)
  const resolvedId = existingId || deterministicCloneId(context.targetTenantId, tableName, sourceId)
  context.resolvedIdCache.set(cacheKey, resolvedId)
  return resolvedId
}

async function remapIdField(
  row: Record<string, any>,
  field: string,
  refTable: string,
  context: RestoreContext,
  options?: { asText?: boolean },
) {
  const sourceValue = row[field]
  if (!sourceValue) return
  const resolved = await resolveSourceId(refTable, String(sourceValue), context)
  row[field] = options?.asText && resolved ? String(resolved) : resolved
}

async function prepareRows(tableName: string, rows: any[], context: RestoreContext) {
  return await Promise.all(rows.map(async (row) => {
    const next = cloneRow(row)

    if (!next || typeof next !== 'object' || Array.isArray(next)) {
      return next
    }

    if ('tenant_id' in next) {
      next.tenant_id = context.targetTenantId
    }

    if (typeof next.id === 'string') {
      next.id = await resolveSourceId(tableName, next.id, context)
    }

    switch (tableName) {
      case 'categories':
        await remapIdField(next, 'parent_id', 'categories', context)
        break
      case 'customers':
        await remapIdField(next, 'preferred_branch_id', 'branches', context)
        break
      case 'product_groups':
        await remapIdField(next, 'category_id', 'categories', context)
        break
      case 'products':
        await remapIdField(next, 'supplier_id', 'suppliers', context)
        await remapIdField(next, 'category_id', 'categories', context)
        await remapIdField(next, 'branch_id', 'branches', context)
        await remapIdField(next, 'group_id', 'product_groups', context)
        await remapIdField(next, 'import_receipt_id', 'import_receipts', context)
        break
      case 'import_receipts':
        await remapIdField(next, 'supplier_id', 'suppliers', context)
        await remapIdField(next, 'branch_id', 'branches', context)
        break
      case 'receipt_payments':
        await remapIdField(next, 'receipt_id', 'import_receipts', context)
        break
      case 'product_imports':
        await remapIdField(next, 'import_receipt_id', 'import_receipts', context)
        await remapIdField(next, 'product_id', 'products', context)
        await remapIdField(next, 'branch_id', 'branches', context)
        await remapIdField(next, 'supplier_id', 'suppliers', context)
        break
      case 'export_receipts':
        await remapIdField(next, 'customer_id', 'customers', context)
        await remapIdField(next, 'branch_id', 'branches', context)
        break
      case 'export_receipt_items':
        await remapIdField(next, 'receipt_id', 'export_receipts', context)
        await remapIdField(next, 'product_id', 'products', context)
        break
      case 'export_receipt_payments':
        await remapIdField(next, 'receipt_id', 'export_receipts', context)
        break
      case 'export_returns':
        await remapIdField(next, 'receipt_id', 'export_receipts', context)
        await remapIdField(next, 'customer_id', 'customers', context)
        await remapIdField(next, 'branch_id', 'branches', context)
        break
      case 'import_returns':
        await remapIdField(next, 'receipt_id', 'import_receipts', context)
        await remapIdField(next, 'supplier_id', 'suppliers', context)
        await remapIdField(next, 'branch_id', 'branches', context)
        break
      case 'return_payments':
        await remapIdField(next, 'return_id', 'export_returns', context)
        await remapIdField(next, 'export_return_id', 'export_returns', context)
        await remapIdField(next, 'import_return_id', 'import_returns', context)
        break
      case 'stock_counts':
        await remapIdField(next, 'branch_id', 'branches', context)
        break
      case 'stock_count_items':
        await remapIdField(next, 'stock_count_id', 'stock_counts', context)
        await remapIdField(next, 'product_id', 'products', context)
        break
      case 'stock_transfer_requests':
        await remapIdField(next, 'branch_id', 'branches', context)
        await remapIdField(next, 'from_branch_id', 'branches', context)
        await remapIdField(next, 'to_branch_id', 'branches', context)
        break
      case 'stock_transfer_items':
        await remapIdField(next, 'transfer_request_id', 'stock_transfer_requests', context)
        await remapIdField(next, 'product_id', 'products', context)
        await remapIdField(next, 'supplier_id', 'suppliers', context)
        break
      case 'imei_histories':
        await remapIdField(next, 'product_id', 'products', context)
        await remapIdField(next, 'import_receipt_id', 'import_receipts', context)
        await remapIdField(next, 'export_receipt_id', 'export_receipts', context)
        await remapIdField(next, 'branch_id', 'branches', context)
        break
      case 'cash_book':
        await remapIdField(next, 'branch_id', 'branches', context)
        break
      case 'debt_payments':
        if (next.entity_type === 'customer') {
          await remapIdField(next, 'entity_id', 'customers', context)
        } else if (next.entity_type === 'supplier') {
          await remapIdField(next, 'entity_id', 'suppliers', context)
        }
        await remapIdField(next, 'branch_id', 'branches', context)
        break
      case 'debt_offsets':
        await remapIdField(next, 'customer_entity_id', 'customers', context)
        await remapIdField(next, 'supplier_entity_id', 'suppliers', context)
        break
      case 'debt_tag_assignments':
        await remapIdField(next, 'tag_id', 'debt_tags', context)
        if (next.entity_type === 'customer') {
          await remapIdField(next, 'entity_id', 'customers', context, { asText: true })
        } else if (next.entity_type === 'supplier') {
          await remapIdField(next, 'entity_id', 'suppliers', context, { asText: true })
        }
        break
      case 'customer_care_schedules':
        await remapIdField(next, 'customer_id', 'customers', context)
        await remapIdField(next, 'care_type_id', 'care_schedule_types', context)
        break
      case 'customer_care_logs':
        await remapIdField(next, 'customer_id', 'customers', context)
        await remapIdField(next, 'schedule_id', 'customer_care_schedules', context)
        break
      case 'care_reminders':
        await remapIdField(next, 'schedule_id', 'customer_care_schedules', context)
        break
      case 'customer_tag_assignments':
        await remapIdField(next, 'customer_id', 'customers', context)
        await remapIdField(next, 'tag_id', 'customer_tags', context)
        break
      case 'customer_contact_channels':
        await remapIdField(next, 'customer_id', 'customers', context)
        break
      case 'customer_vouchers':
        await remapIdField(next, 'customer_id', 'customers', context)
        await remapIdField(next, 'branch_id', 'branches', context)
        await remapIdField(next, 'voucher_template_id', 'voucher_templates', context)
        break
      case 'point_transactions':
        await remapIdField(next, 'customer_id', 'customers', context)
        break
      case 'landing_products':
        await remapIdField(next, 'category_id', 'landing_product_categories', context)
        break
      case 'landing_articles':
        await remapIdField(next, 'category_id', 'landing_article_categories', context)
        break
      case 'shop_ctv_orders':
        await remapIdField(next, 'collaborator_id', 'shop_collaborators', context)
        break
      case 'shop_ctv_withdrawals':
        await remapIdField(next, 'collaborator_id', 'shop_collaborators', context)
        break
      case 'email_automation_blocks':
        await remapIdField(next, 'automation_id', 'email_automations', context)
        break
      case 'einvoices':
        await remapIdField(next, 'config_id', 'einvoice_configs', context)
        await remapIdField(next, 'branch_id', 'branches', context)
        await remapIdField(next, 'export_receipt_id', 'export_receipts', context)
        await remapIdField(next, 'original_invoice_id', 'einvoices', context)
        break
      case 'einvoice_items':
        await remapIdField(next, 'einvoice_id', 'einvoices', context)
        break
      case 'einvoice_logs':
        await remapIdField(next, 'einvoice_id', 'einvoices', context)
        break
      default:
        break
    }

    return next
  }))
}

async function updateJob(adminClient: any, jobId: string, payload: Record<string, unknown>) {
  const { error } = await adminClient.from('data_management_jobs').update(payload).eq('id', jobId)
  if (error) throw new Error(`Không thể cập nhật job: ${error.message}`)
}

async function triggerNextStep(jobId: string) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  const response = await fetch(`${supabaseUrl}/functions/v1/cross-platform-restore-v3`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      [INTERNAL_JOB_HEADER]: serviceRoleKey,
    },
    body: JSON.stringify({ action: 'process_job', jobId }),
  })

  if (!response.ok) {
    const message = await response.text()
    throw new Error(`Không thể chạy bước kế tiếp của job ${jobId}: ${message}`)
  }
}

async function scheduleNextStep(jobId: string) {
  const backgroundTask = triggerNextStep(jobId)
  const edgeRuntime = (globalThis as any).EdgeRuntime

  if (edgeRuntime?.waitUntil) {
    edgeRuntime.waitUntil(backgroundTask)
    return
  }

  backgroundTask.catch((error: unknown) => {
    console.error('[cross-platform-restore-v3] background task failed:', error)
  })
}

async function processJob(jobId: string) {
  const adminClient = createAdminClient()

  const { data: job, error: jobError } = await adminClient
    .from('data_management_jobs')
    .select('id, tenant_id, status, progress, current_step, source_bucket, source_path, metadata, result_summary')
    .eq('id', jobId)
    .maybeSingle()

  if (jobError || !job) {
    throw new Error(jobError?.message || 'Không tìm thấy job khôi phục')
  }

  if (job.status === 'completed' || job.status === 'failed') {
    return { success: true, finished: true }
  }

  if (!job.source_bucket || !job.source_path) {
    throw new Error('Job chưa có file nguồn để khôi phục')
  }

  const { data: fileData, error: downloadError } = await adminClient.storage
    .from(job.source_bucket)
    .download(job.source_path)

  if (downloadError || !fileData) {
    throw new Error(downloadError?.message || 'Không thể tải file sao lưu')
  }

  const importData = JSON.parse(await fileData.text())
  const backupVersion = normalizeBackupVersion(importData?.version)
  if (backupVersion !== '3.0') {
    throw new Error('Chỉ hỗ trợ file sao lưu v3.0 cho tác vụ này')
  }

  const operations = buildOperations(importData)
  const nextOpIndex = Number(job.metadata?.next_op_index || 0)
  const restoreContext = createRestoreContext(
    adminClient,
    importData,
    job.tenant_id,
    normalizeMode(job.metadata?.restore_mode),
  )
  let result = normalizeResult(importData, job.result_summary)

  if (!operations.length) {
    await updateJob(adminClient, job.id, {
      status: 'failed',
      progress: 100,
      current_step: 'Không có dữ liệu để khôi phục',
      error_message: 'File sao lưu không có dữ liệu hợp lệ',
      completed_at: new Date().toISOString(),
      result_summary: result,
    })
    return { success: false, finished: true }
  }

  if (nextOpIndex >= operations.length) {
    await updateJob(adminClient, job.id, {
      status: 'completed',
      progress: 100,
      current_step: 'Khôi phục hoàn tất',
      completed_at: new Date().toISOString(),
      result_summary: {
        ...result,
        summary: summarize(result.stats),
      },
    })
    return { success: true, finished: true }
  }

  const operation = operations[nextOpIndex]
  const progressBefore = Math.max(1, Math.min(99, Math.round((nextOpIndex / operations.length) * 100)))

  await updateJob(adminClient, job.id, {
    status: 'processing',
    progress: progressBefore,
    current_step: `Đang khôi phục ${operation.label} (${operation.chunkIndex + 1}/${operation.totalChunks})`,
    metadata: {
      ...(job.metadata || {}),
      total_ops: operations.length,
      next_op_index: nextOpIndex,
    },
    result_summary: {
      ...result,
      summary: summarize(result.stats),
    },
  })

  if (operation.mode === 'web_config') {
    const payload = cloneRow(importData.web_config || {})
    payload.tenant_id = job.tenant_id
    delete payload.id

    const { error } = await adminClient
      .from('tenant_landing_settings')
      .upsert(payload, { onConflict: 'tenant_id' })

    if (error) {
      throw new Error(`Cấu hình web: ${error.message}`)
    }

    if (!result.stats[operation.key]) {
      result.stats[operation.key] = createBucket(1)
    }
    result.stats[operation.key].success += 1
  } else {
    const sourceRows = Array.isArray(importData?.[operation.key]) ? importData[operation.key] : []
    const chunkRows = sourceRows.slice(operation.from, operation.to)
    const tableName = operation.table!
    const preparedRows = await prepareRows(tableName, chunkRows, restoreContext)

    // CRITICAL: Deduplicate by id within the chunk to avoid Postgres error
    //   "ON CONFLICT DO UPDATE command cannot affect row a second time"
    // This happens when 2 source rows resolve to the same target id (cross-tenant
    // clone with hash collision, or duplicate ids in the source backup file).
    // Without this, the entire chunk fails and ALL rows are lost.
    const seenIds = new Set<string>()
    const payload: any[] = []
    let dedupSkipped = 0
    for (const row of preparedRows) {
      if (!row || typeof row !== 'object') continue
      const rowId = typeof row.id === 'string' ? row.id : null
      if (rowId) {
        if (seenIds.has(rowId)) {
          dedupSkipped++
          continue
        }
        seenIds.add(rowId)
      }
      payload.push(row)
    }

    if (payload.length > 0) {
      let chunkSuccess = 0
      let chunkSkipped = dedupSkipped
      let chunkError = 0

      // Try batch upsert first
      const { error: batchError } = await adminClient
        .from(tableName)
        .upsert(payload, { onConflict: 'id', ignoreDuplicates: false })

      if (batchError) {
        // Fallback to row-by-row when the batch fails for any recoverable reason
        // (unique constraint, double affect on ON CONFLICT, etc.). Without this
        // the entire chunk would be lost.
        const msg = batchError.message || ''
        const isRecoverable =
          msg.includes('duplicate key value violates unique constraint') ||
          msg.includes('unique constraint') ||
          msg.includes('cannot affect row a second time') ||
          batchError.code === '23505' ||
          batchError.code === '21000'
        if (isRecoverable) {
          console.log(`[restore-v3] ${tableName}: batch failed (${msg}), falling back to row-by-row`)

          for (const row of payload) {
            try {
              // Try upsert by id first
              const { error: rowError } = await adminClient
                .from(tableName)
                .upsert(row, { onConflict: 'id', ignoreDuplicates: true })

              if (rowError) {
                // If still fails (different id, same unique key), try to find & update existing
                if (rowError.message?.includes('unique constraint') ||
                    rowError.message?.includes('cannot affect row a second time') ||
                    rowError.code === '23505') {
                  // Skip this duplicate row - the existing record takes priority
                  chunkSkipped++
                  console.log(`[restore-v3] ${tableName}: skipped duplicate row ${row.id}`)
                } else {
                  chunkError++
                  result.errors.push(`${operation.label}: ${rowError.message} (row ${row.id})`)
                }
              } else {
                chunkSuccess++
              }
            } catch (e) {
              chunkError++
              result.errors.push(`${operation.label}: ${(e as Error).message} (row ${row.id})`)
            }
          }
        } else {
          // Non-unique error: still don't crash the whole job, record and continue
          chunkError += payload.length
          result.errors.push(`${operation.label}: ${batchError.message}`)
          console.error(`[restore-v3] ${tableName}: non-unique batch error: ${batchError.message}`)
        }
      } else {
        chunkSuccess = payload.length
      }

      if (!result.stats[operation.key]) {
        result.stats[operation.key] = createBucket(sourceRows.length)
      }
      result.stats[operation.key].success += chunkSuccess
      result.stats[operation.key].skipped += chunkSkipped
      result.stats[operation.key].error += chunkError
    }
  }

  result.summary = summarize(result.stats)
  result.total_errors = result.errors.length

  const completedOps = nextOpIndex + 1
  const finished = completedOps >= operations.length

  await updateJob(adminClient, job.id, {
    status: finished ? 'completed' : 'processing',
    progress: finished ? 100 : Math.max(1, Math.min(99, Math.round((completedOps / operations.length) * 100))),
    current_step: finished ? 'Khôi phục hoàn tất' : `Đã xong ${operation.label}, đang chuyển bước tiếp theo`,
    completed_at: finished ? new Date().toISOString() : null,
    metadata: {
      ...(job.metadata || {}),
      total_ops: operations.length,
      next_op_index: completedOps,
    },
    result_summary: result,
  })

  if (!finished) {
    await scheduleNextStep(job.id)
  }

  return { success: true, finished }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const internalJobKey = req.headers.get(INTERNAL_JOB_HEADER)

    let body: any = {}
    try {
      body = await req.json()
    } catch {
      body = {}
    }

    const action = body?.action === 'process_job' ? 'process_job' : 'enqueue'

    if (action === 'process_job') {
      if (!internalJobKey || internalJobKey !== serviceRoleKey) {
        return jsonResponse(401, { error: 'Unauthorized internal job request' })
      }

      if (!body?.jobId || typeof body.jobId !== 'string') {
        return jsonResponse(400, { error: 'Thiếu jobId' })
      }

      try {
        const result = await processJob(body.jobId)
        return jsonResponse(200, result)
      } catch (error) {
        const adminClient = createAdminClient()
        const { data: failedJob } = await adminClient
          .from('data_management_jobs')
          .select('id, result_summary')
          .eq('id', body.jobId)
          .maybeSingle()

        const currentResult = failedJob?.result_summary && typeof failedJob.result_summary === 'object'
          ? failedJob.result_summary
          : { stats: {}, summary: { total_records: 0, total_success: 0, total_skipped: 0, total_failed: 1 }, errors: [], total_errors: 0 }

        const nextErrors = Array.isArray(currentResult.errors) ? [...currentResult.errors, (error as Error).message] : [(error as Error).message]

        await updateJob(adminClient, body.jobId, {
          status: 'failed',
          progress: 100,
          current_step: 'Khôi phục thất bại',
          error_message: (error as Error).message,
          completed_at: new Date().toISOString(),
          result_summary: {
            ...currentResult,
            errors: nextErrors.slice(0, 100),
            total_errors: nextErrors.length,
          },
        })

        return jsonResponse(500, { error: (error as Error).message })
      }
    }

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return jsonResponse(401, { error: 'Unauthorized' })
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const adminClient = createAdminClient()

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser()

    if (userError || !user) {
      return jsonResponse(401, { error: 'Unauthorized' })
    }

    const requestedTenantId = typeof body?.tenantId === 'string' && body.tenantId.trim()
      ? body.tenantId.trim()
      : null

    let tenantId = requestedTenantId

    if (requestedTenantId) {
      const { data: membership, error: membershipError } = await adminClient
        .from('platform_users')
        .select('tenant_id')
        .eq('user_id', user.id)
        .eq('tenant_id', requestedTenantId)
        .eq('is_active', true)
        .maybeSingle()

      if (membershipError || !membership?.tenant_id) {
        return jsonResponse(403, { error: 'Bạn không có quyền khôi phục vào cửa hàng hiện tại' })
      }
    } else {
      const { data: tenantData, error: tenantError } = await adminClient
        .from('platform_users')
        .select('tenant_id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle()

      if (tenantError || !tenantData?.tenant_id) {
        return jsonResponse(404, { error: 'Tenant not found' })
      }

      tenantId = tenantData.tenant_id
    }

    const { data: roleData } = await adminClient
      .from('user_roles')
      .select('user_role')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!roleData || !['super_admin', 'branch_admin'].includes(roleData.user_role || '')) {
      return jsonResponse(403, { error: 'Forbidden: Admin only' })
    }

    const restoreMode = normalizeMode(body?.mode)

    // Hỗ trợ 2 cách truyền dữ liệu:
    //   (1) sourcePath: file đã được client upload sẵn lên bucket 'temp-imports' (KHUYẾN NGHỊ - không bị giới hạn body Edge Function)
    //   (2) importData: gửi thẳng JSON trong body (backward-compat, dễ timeout với file lớn)
    let importData: any = body?.importData
    const incomingSourcePath = typeof body?.sourcePath === 'string' && body.sourcePath.trim()
      ? body.sourcePath.trim()
      : null

    if (incomingSourcePath) {
      // Bảo đảm path nằm trong thư mục của tenant này để tránh truy cập chéo
      const expectedPrefix = `${tenantId}/`
      if (!incomingSourcePath.startsWith(expectedPrefix)) {
        return jsonResponse(400, { error: 'sourcePath không thuộc cửa hàng hiện tại' })
      }
      const { data: fileBlob, error: downloadErr } = await adminClient.storage
        .from('temp-imports')
        .download(incomingSourcePath)
      if (downloadErr || !fileBlob) {
        return jsonResponse(400, { error: `Không đọc được file sao lưu đã tải lên: ${downloadErr?.message || 'unknown'}` })
      }
      try {
        importData = JSON.parse(await fileBlob.text())
      } catch (e) {
        return jsonResponse(400, { error: 'File sao lưu không phải JSON hợp lệ' })
      }
    }

    const backupVersion = normalizeBackupVersion(importData?.version)
    if (!backupVersion) {
      return jsonResponse(400, { error: 'File JSON không hợp lệ hoặc version không hỗ trợ' })
    }

    if (backupVersion !== '3.0') {
      return jsonResponse(200, {
        success: false,
        requiresLegacyRestore: true,
        errorCode: 'LEGACY_BACKUP_VERSION',
        version: backupVersion,
        error: 'File sao lưu phiên bản cũ sẽ được xử lý bằng luồng legacy',
      })
    }

    if (importData.version !== backupVersion) {
      importData.version = backupVersion
    }

    const activeStatuses = ['queued', 'processing']
    const { data: activeJob, error: activeJobError } = await adminClient
      .from('data_management_jobs')
      .select('id, status, progress, current_step, job_type, created_at')
      .eq('tenant_id', tenantId)
      .in('status', activeStatuses)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (activeJobError) {
      return jsonResponse(500, { error: activeJobError.message })
    }

    if (activeJob) {
      if (activeJob.job_type === 'cross_platform_restore_v3') {
        return jsonResponse(200, {
          success: true,
          alreadyRunning: true,
          jobId: activeJob.id,
          job: activeJob,
          message: 'Hệ thống đang tiếp tục khôi phục file sao lưu 3.0 trước đó.',
        })
      }

      return jsonResponse(409, { error: 'Hiện đang có tác vụ nền khác chạy trong cửa hàng này. Vui lòng chờ hoàn tất rồi thử lại.' })
    }

    const operations = buildOperations(importData)
    if (!operations.length) {
      return jsonResponse(400, { error: 'File sao lưu không có dữ liệu để khôi phục' })
    }

    const initialResult = createInitialResult(importData)

    const { data: createdJob, error: createJobError } = await adminClient
      .from('data_management_jobs')
      .insert({
         tenant_id: tenantId,
        requested_by: user.id,
        requested_by_email: user.email ?? null,
        delete_mode: restoreMode === 'overwrite' ? 'full' : 'merge',
        status: 'queued',
        progress: 0,
        current_step: 'Đang tải file sao lưu lên hệ thống',
        notify_email: user.email ?? null,
        job_type: 'cross_platform_restore_v3',
        metadata: {
          restore_mode: restoreMode,
          backup_version: '3.0',
          next_op_index: 0,
          total_ops: operations.length,
        },
        result_summary: initialResult,
      })
      .select('id, status, progress, current_step, created_at')
      .single()

    if (createJobError || !createdJob) {
      return jsonResponse(500, { error: createJobError?.message || 'Không thể tạo job khôi phục' })
    }

    let sourcePath = incomingSourcePath
    if (!sourcePath) {
      // Fallback path: client gửi thẳng importData → server tự upload (chỉ phù hợp file nhỏ)
      sourcePath = `${tenantId}/restore-jobs/${createdJob.id}.json`
      const backupBlob = new Blob([JSON.stringify(importData)], { type: 'application/json' })
      const { error: uploadError } = await adminClient.storage
        .from('temp-imports')
        .upload(sourcePath, backupBlob, {
          upsert: true,
          contentType: 'application/json',
        })
      if (uploadError) {
        await updateJob(adminClient, createdJob.id, {
          status: 'failed',
          progress: 100,
          current_step: 'Tải file sao lưu thất bại',
          error_message: uploadError.message,
          completed_at: new Date().toISOString(),
        })
        return jsonResponse(500, { error: `Không thể tải file sao lưu: ${uploadError.message}` })
      }
    }

    await updateJob(adminClient, createdJob.id, {
      source_bucket: 'temp-imports',
      source_path: sourcePath,
      current_step: 'Đã đưa vào hàng chờ khôi phục',
    })

    await scheduleNextStep(createdJob.id)

    return jsonResponse(200, {
      success: true,
      jobId: createdJob.id,
      job: {
        ...createdJob,
        current_step: 'Đã đưa vào hàng chờ khôi phục',
      },
      message: 'Đã bắt đầu khôi phục nền cho file sao lưu 3.0. Hệ thống sẽ tự chạy tiếp và cập nhật tiến độ %.',
    })
  } catch (error) {
    console.error('[cross-platform-restore-v3] unexpected error:', error)
    return jsonResponse(500, { error: (error as Error).message || 'Unexpected error' })
  }
})