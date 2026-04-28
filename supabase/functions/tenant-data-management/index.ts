import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import nodemailer from 'https://esm.sh/nodemailer@6.9.10'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const jsonHeaders = {
  ...corsHeaders,
  'Content-Type': 'application/json',
}

const MAX_REQUESTS_PER_HOUR = 30
const RATE_LIMIT_WINDOW_MINUTES = 60
const DELETE_BATCH_SIZE = 50
const LARGE_DELETE_BATCH_SIZE = 200
const FETCH_PAGE_SIZE = 1000
const IN_CLAUSE_BATCH_SIZE = 200
const ACTIVE_JOB_STALE_MINUTES = 10
const INTERNAL_CONTINUATION_RETRIES = 3
const INTERNAL_CONTINUATION_RETRY_DELAY_MS = 1500

const FULL_DELETE_PHASES = [
  'product_history',
  'stock_and_einvoice',
  'returns_and_exports',
  'imports_and_transfers',
  'products_and_cash_book',
  'debts_and_customers',
  'final_reports',
] as const

const KEEP_TEMPLATES_PHASES = [
  'history_and_returns',
  'exports',
  'imports',
  'products_reset',
  'remaining_cleanup',
] as const

type DeleteMode = 'full' | 'keep_templates'
type RestoreOption = 'delete' | 'restore'
type ProgressReporter = (progress: number, step: string) => Promise<void>
type DeletePhase =
  | (typeof FULL_DELETE_PHASES)[number]
  | (typeof KEEP_TEMPLATES_PHASES)[number]
  | 'restore'
  | 'finalize'
  | 'done'

type DeleteJobMetadata = {
  restore_option?: RestoreOption
  requested_action?: string
  delete_phase?: DeletePhase
}

type BackgroundJobParams = {
  jobId: string
  tenantId: string
  deleteMode: DeleteMode
  restoreOption: RestoreOption
  requestedBy: string
  requestedByEmail: string | null
}

function createAdminClient(supabaseUrl: string, serviceKey: string) {
  return createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    db: { schema: 'public' },
  })
}

function jsonResponse(payload: Record<string, unknown>) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: jsonHeaders,
  })
}

function toErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  return String(error)
}

function normalizeConfirmText(value: unknown) {
  return String(value ?? '').normalize('NFC').toLowerCase().trim()
}

function normalizeDeleteMode(value: unknown): DeleteMode {
  return value === 'keep_templates' ? 'keep_templates' : 'full'
}

function normalizeRestoreOption(value: unknown): RestoreOption {
  return value === 'restore' ? 'restore' : 'delete'
}

function normalizeJobMetadata(value: unknown): DeleteJobMetadata {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {}
  }

  const metadata = value as Record<string, unknown>

  return {
    restore_option: normalizeRestoreOption(metadata.restore_option),
    requested_action: typeof metadata.requested_action === 'string' ? metadata.requested_action : undefined,
    delete_phase: typeof metadata.delete_phase === 'string' ? (metadata.delete_phase as DeletePhase) : undefined,
  }
}

function getPhaseSequence(deleteMode: DeleteMode) {
  return deleteMode === 'keep_templates' ? KEEP_TEMPLATES_PHASES : FULL_DELETE_PHASES
}

function getInitialDeletePhase(deleteMode: DeleteMode): DeletePhase {
  return getPhaseSequence(deleteMode)[0]
}

function getNextDeletePhase(deleteMode: DeleteMode, currentPhase: DeletePhase): DeletePhase | null {
  const phases = getPhaseSequence(deleteMode)
  const currentIndex = phases.indexOf(currentPhase as any)

  if (currentIndex === -1) return null
  return phases[currentIndex + 1] ?? null
}

async function delay(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

async function triggerJobContinuation(supabaseUrl: string, serviceKey: string, jobId: string) {
  let lastError: string | null = null

  for (let attempt = 1; attempt <= INTERNAL_CONTINUATION_RETRIES; attempt += 1) {
    try {
      const response = await fetch(`${supabaseUrl}/functions/v1/tenant-data-management`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${serviceKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'continue_job',
          jobId,
        }),
      })

      const payload = await response.json().catch(() => null)

      if (response.ok && !payload?.error) {
        return
      }

      lastError = payload?.error || `HTTP ${response.status}`
    } catch (error) {
      lastError = toErrorMessage(error)
    }

    if (attempt < INTERNAL_CONTINUATION_RETRIES) {
      await delay(INTERNAL_CONTINUATION_RETRY_DELAY_MS * attempt)
    }
  }

  throw new Error(lastError || 'Không thể tiếp tục tác vụ xoá dữ liệu')
}

function scheduleJobContinuation(supabaseUrl: string, serviceKey: string, jobId: string) {
  const continuationTask = triggerJobContinuation(supabaseUrl, serviceKey, jobId)
  const edgeRuntime = (globalThis as any).EdgeRuntime

  if (edgeRuntime?.waitUntil) {
    edgeRuntime.waitUntil(continuationTask)
    return
  }

  continuationTask.catch((error: unknown) => {
    console.error('[tenant-data-management] scheduleJobContinuation failed:', error)
  })
}

function isMissingTableError(error: any) {
  const message = String(error?.message || '').toLowerCase()
  return message.includes('could not find the table') || (message.includes('relation') && message.includes('does not exist'))
}

async function assertMutation(label: string, operation: Promise<any>) {
  const { error } = await operation
  if (!error) return
  console.error(`[tenant-data-management] ${label} failed:`, error)
  throw new Error(`${label}: ${error.message}`)
}

async function assertOptionalMutation(label: string, operation: Promise<any>) {
  const { error } = await operation
  if (!error) return
  if (isMissingTableError(error)) {
    console.warn(`[tenant-data-management] ${label} skipped:`, error.message)
    return
  }
  console.error(`[tenant-data-management] ${label} failed:`, error)
  throw new Error(`${label}: ${error.message}`)
}

async function tryMutation(label: string, operation: Promise<any>) {
  const { error } = await operation
  if (!error) return
  console.warn(`[tenant-data-management] ${label} skipped:`, error.message)
}

async function updateJob(supabaseAdmin: any, jobId: string, payload: Record<string, unknown>) {
  await assertMutation('Cập nhật tiến trình job', supabaseAdmin.from('data_management_jobs').update(payload).eq('id', jobId))
}

async function safeUpdateJob(supabaseAdmin: any, jobId: string, payload: Record<string, unknown>) {
  try {
    await updateJob(supabaseAdmin, jobId, payload)
  } catch (error) {
    console.error('[tenant-data-management] safeUpdateJob failed:', error)
  }
}

async function fetchIdsByTenant(supabaseAdmin: any, table: string, tenantId: string) {
  const ids: string[] = []

  for (let from = 0; ; from += FETCH_PAGE_SIZE) {
    const to = from + FETCH_PAGE_SIZE - 1
    const { data, error } = await supabaseAdmin
      .from(table)
      .select('id')
      .eq('tenant_id', tenantId)
      .order('id')
      .range(from, to)

    if (error) {
      console.error(`[tenant-data-management] fetch ${table} failed:`, error)
      throw new Error(`Không thể tải danh sách ${table}: ${error.message}`)
    }

    const batch = (data || []).map((row: any) => row.id)
    ids.push(...batch)

    if (batch.length < FETCH_PAGE_SIZE) break
  }

  return ids
}

async function fetchRowsByParent(
  supabaseAdmin: any,
  table: string,
  selectClause: string,
  parentColumn: string,
  parentIds: string[],
) {
  if (parentIds.length === 0) return []
  const rows: any[] = []

  for (let i = 0; i < parentIds.length; i += IN_CLAUSE_BATCH_SIZE) {
    const parentBatch = parentIds.slice(i, i + IN_CLAUSE_BATCH_SIZE)
    for (let from = 0; ; from += FETCH_PAGE_SIZE) {
      const to = from + FETCH_PAGE_SIZE - 1
      const { data, error } = await supabaseAdmin
        .from(table)
        .select(selectClause)
        .in(parentColumn, parentBatch)
        .order('id')
        .range(from, to)

      if (error) {
        if (isMissingTableError(error)) return rows
        console.error(`[tenant-data-management] fetch ${table} by ${parentColumn} failed:`, error)
        throw new Error(`Không thể tải danh sách ${table}: ${error.message}`)
      }

      const batch = data || []
      rows.push(...batch)

      if (batch.length < FETCH_PAGE_SIZE) break
    }
  }

  return rows
}

// Fetch IDs from a child table by parent column (for tables without tenant_id)
async function fetchIdsByParent(supabaseAdmin: any, table: string, parentColumn: string, parentIds: string[]) {
  const rows = await fetchRowsByParent(supabaseAdmin, table, 'id', parentColumn, parentIds)
  return rows.map((row: any) => row.id)
}

function uniqueIds(values: Array<string | null | undefined>) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))]
}

async function cleanupOrphanExportDataByProducts(supabaseAdmin: any, productIds: string[]) {
  if (productIds.length === 0) return

  const orphanExportItems = await fetchRowsByParent(
    supabaseAdmin,
    'export_receipt_items',
    'id, receipt_id',
    'product_id',
    productIds,
  )

  const orphanExportItemIds = orphanExportItems.map((item: any) => item.id)
  const orphanExportReceiptIds = uniqueIds(orphanExportItems.map((item: any) => item.receipt_id))

  if (orphanExportItemIds.length > 0) {
    await deleteByIdsInBatches(supabaseAdmin, 'export_returns', 'export_receipt_item_id', orphanExportItemIds, 'Xoá trả hàng còn sót theo item_id', true)
    await deleteByIdsInBatches(supabaseAdmin, 'export_receipt_items', 'id', orphanExportItemIds, 'Xoá chi tiết PX còn sót', true)
  }

  if (orphanExportReceiptIds.length > 0) {
    await deleteByIdsInBatches(supabaseAdmin, 'export_receipt_payments', 'receipt_id', orphanExportReceiptIds, 'Xoá thanh toán PX còn sót theo receipt_id', true)
    await deleteByIdsInBatches(supabaseAdmin, 'export_receipts', 'id', orphanExportReceiptIds, 'Xoá phiếu xuất còn sót theo receipt_id', true)
  }
}

async function cleanupStockCountData(
  supabaseAdmin: any,
  tenantId: string,
  productIds: string[],
  stockCountIds: string[],
) {
  if (stockCountIds.length > 0) {
    await deleteByIdsInBatches(supabaseAdmin, 'stock_count_items', 'stock_count_id', stockCountIds, 'Xoá chi tiết kiểm kho theo phiếu', true)
  }

  if (productIds.length > 0) {
    await deleteByIdsInBatches(supabaseAdmin, 'stock_count_items', 'product_id', productIds, 'Xoá chi tiết kiểm kho theo sản phẩm', true)

    const residualStockCountItemIds = await fetchIdsByParent(supabaseAdmin, 'stock_count_items', 'product_id', productIds)
    if (residualStockCountItemIds.length > 0) {
      await deleteByIdsInBatches(supabaseAdmin, 'stock_count_items', 'id', residualStockCountItemIds, 'Xoá chi tiết kiểm kho còn sót', true)
    }
  }

  await assertOptionalMutation('Xoá phiếu kiểm kho', supabaseAdmin.from('stock_counts').delete().eq('tenant_id', tenantId))
}

async function cleanupDirectProductReferences(supabaseAdmin: any, productIds: string[]) {
  if (productIds.length === 0) return

  await cleanupOrphanExportDataByProducts(supabaseAdmin, productIds)
  await deleteByIdsInBatches(supabaseAdmin, 'export_returns', 'product_id', productIds, 'Xoá trả hàng bán theo sản phẩm', true)
  await deleteByIdsInBatches(supabaseAdmin, 'import_returns', 'product_id', productIds, 'Xoá trả hàng nhập theo sản phẩm', true)
  await deleteByIdsInBatches(supabaseAdmin, 'stock_transfer_items', 'product_id', productIds, 'Xoá liên kết chuyển kho theo sản phẩm', true)
  await deleteByIdsInBatches(supabaseAdmin, 'imei_histories', 'product_id', productIds, 'Xoá lịch sử IMEI còn sót', true)
  await deleteByIdsInBatches(supabaseAdmin, 'product_imports', 'product_id', productIds, 'Xoá lịch sử nhập sản phẩm còn sót', true)
  await deleteByIdsInBatches(supabaseAdmin, 'repair_order_items', 'product_id', productIds, 'Xoá linh kiện đơn sửa chữa theo sản phẩm', true)
  await deleteByIdsInBatches(supabaseAdmin, 'export_receipt_items', 'product_id', productIds, 'Xoá chi tiết phiếu xuất theo sản phẩm', true)
  await deleteByIdsInBatches(supabaseAdmin, 'stock_count_items', 'product_id', productIds, 'Xoá chi tiết kiểm kho theo sản phẩm', true)
}

async function deleteByIdsInBatches(
  supabaseAdmin: any,
  table: string,
  column: string,
  ids: string[],
  label: string,
  optional = false,
  batchSize = DELETE_BATCH_SIZE,
) {
  const effectiveBatch = Math.min(batchSize, IN_CLAUSE_BATCH_SIZE)
  for (let index = 0; index < ids.length; index += effectiveBatch) {
    const batch = ids.slice(index, index + effectiveBatch)
    const operation = supabaseAdmin.from(table).delete().in(column, batch)

    if (optional) {
      await assertOptionalMutation(label, operation)
    } else {
      await assertMutation(label, operation)
    }
  }
}

async function deleteByIdsBestEffort(
  supabaseAdmin: any,
  table: string,
  column: string,
  ids: string[],
  label: string,
  batchSize = DELETE_BATCH_SIZE,
) {
  const effectiveBatch = Math.min(batchSize, IN_CLAUSE_BATCH_SIZE)
  for (let index = 0; index < ids.length; index += effectiveBatch) {
    const batch = ids.slice(index, index + effectiveBatch)
    const { error } = await supabaseAdmin.from(table).delete().in(column, batch)

    if (!error) continue

    console.warn(
      `[tenant-data-management] ${label} skipped batch ${index / effectiveBatch + 1}:`,
      error.message,
    )
  }
}

function isStaleTimestamp(value: string | null | undefined) {
  if (!value) return false
  const timestamp = new Date(value).getTime()
  if (Number.isNaN(timestamp)) return false
  return Date.now() - timestamp > ACTIVE_JOB_STALE_MINUTES * 60 * 1000
}

async function markStaleDeleteJobsAsFailed(supabaseAdmin: any, tenantId: string) {
  const { data, error } = await supabaseAdmin
    .from('data_management_jobs')
    .select('id, created_at, updated_at')
    .eq('tenant_id', tenantId)
    .in('status', ['queued', 'processing'])

  if (error) {
    throw new Error(`Không thể kiểm tra tác vụ xoá dữ liệu cũ: ${error.message}`)
  }

  const staleJobIds = (data || [])
    .filter((job: any) => isStaleTimestamp(job.updated_at || job.created_at))
    .map((job: any) => job.id)

  if (staleJobIds.length === 0) return

  await assertMutation(
    'Đánh dấu tác vụ xoá dữ liệu bị treo',
    supabaseAdmin
      .from('data_management_jobs')
      .update({
        status: 'failed',
        current_step: 'Thất bại',
        completed_at: new Date().toISOString(),
        error_message: `Tác vụ cũ đã bị treo quá ${ACTIVE_JOB_STALE_MINUTES} phút. Vui lòng bấm xoá lại để tiếp tục.`,
      })
      .in('id', staleJobIds),
  )
}

async function verifyCallerPassword(supabaseAdmin: any, email: string | undefined, password: string | undefined) {
  if (!password) return 'Vui lòng nhập mật khẩu'
  if (!email) return 'Tài khoản quản trị chưa có email để xác minh mật khẩu'

  const { error } = await supabaseAdmin.auth.signInWithPassword({
    email,
    password,
  })

  return error ? 'Sai mật khẩu' : null
}

async function getActiveDeleteJob(supabaseAdmin: any, tenantId: string) {
  await markStaleDeleteJobsAsFailed(supabaseAdmin, tenantId)

  const { data, error } = await supabaseAdmin
    .from('data_management_jobs')
    .select('id, status, progress, current_step, delete_mode, notify_email, created_at, updated_at')
    .eq('tenant_id', tenantId)
    .in('status', ['queued', 'processing'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    throw new Error(`Không thể kiểm tra tiến trình xoá dữ liệu: ${error.message}`)
  }

  return data
}

async function sendDataManagementEmail(params: {
  jobId: string
  toEmail: string | null
  deleteMode: DeleteMode
  status: 'completed' | 'failed'
  errorMessage?: string | null
}) {
  const smtpUser = Deno.env.get('SMTP_USER')
  const smtpPassword = Deno.env.get('SMTP_PASSWORD')

  if (!params.toEmail || !smtpUser || !smtpPassword) {
    return
  }

  try {
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        user: smtpUser,
        pass: smtpPassword,
      },
    })

    const actionLabel = params.deleteMode === 'keep_templates' ? 'xoá lịch sử, giữ sản phẩm mẫu' : 'xoá toàn bộ dữ liệu'
    const subject =
      params.status === 'completed'
        ? `✅ ${actionLabel} đã hoàn tất – VKHO`
        : `⚠️ ${actionLabel} thất bại – VKHO`

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0f172a;line-height:1.6">
        <h2 style="margin:0 0 16px;font-size:22px;color:#111827">
          ${params.status === 'completed' ? 'Xoá dữ liệu đã hoàn tất' : 'Xoá dữ liệu bị lỗi'}
        </h2>
        <p style="margin:0 0 12px">Loại tác vụ: <strong>${actionLabel}</strong></p>
        <p style="margin:0 0 12px">Mã job: <strong>${params.jobId}</strong></p>
        <p style="margin:0 0 12px">Thời gian: <strong>${new Date().toLocaleString('vi-VN')}</strong></p>
        ${
          params.status === 'completed'
            ? '<p style="margin:16px 0 0">Hệ thống đã xử lý xong yêu cầu xoá dữ liệu ở nền. Bạn có thể mở lại ứng dụng để kiểm tra dữ liệu mới nhất.</p>'
            : `<p style="margin:16px 0 0;color:#b91c1c">Lý do lỗi: ${params.errorMessage || 'Không xác định'}</p>`
        }
      </div>
    `

    await transporter.sendMail({
      from: `"VKHO" <${smtpUser}>`,
      to: params.toEmail,
      subject,
      html,
    })
  } catch (error) {
    console.error('[tenant-data-management] sendDataManagementEmail failed:', error)
  }
}

async function clearBackupTables(supabaseAdmin: any, tenantId: string) {
  await assertOptionalMutation('Xoá backup sản phẩm', supabaseAdmin.from('products_backup').delete().eq('tenant_id', tenantId))
  await assertOptionalMutation('Xoá backup phiếu nhập', supabaseAdmin.from('import_receipts_backup').delete().eq('tenant_id', tenantId))
  await assertOptionalMutation('Xoá backup phiếu xuất', supabaseAdmin.from('export_receipts_backup').delete().eq('tenant_id', tenantId))
  await assertOptionalMutation('Xoá backup sổ quỹ', supabaseAdmin.from('cash_book_backup').delete().eq('tenant_id', tenantId))
}

async function restoreDataFromBackup(supabaseAdmin: any, tenantId: string, reportProgress?: ProgressReporter) {
  await reportProgress?.(68, 'Đang khôi phục sản phẩm từ backup')
  const { data: productsBackup, error: productsBackupError } = await supabaseAdmin
    .from('products_backup')
    .select('data')
    .eq('tenant_id', tenantId)
    .order('backup_date', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (productsBackupError) throw new Error(`Không thể đọc backup sản phẩm: ${productsBackupError.message}`)

  if (productsBackup?.data) {
    for (const product of productsBackup.data as any[]) {
      await assertMutation('Khôi phục sản phẩm', supabaseAdmin.from('products').insert(product))
    }
  }

  await reportProgress?.(76, 'Đang khôi phục phiếu nhập từ backup')
  const { data: importBackup, error: importBackupError } = await supabaseAdmin
    .from('import_receipts_backup')
    .select('data')
    .eq('tenant_id', tenantId)
    .order('backup_date', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (importBackupError) throw new Error(`Không thể đọc backup phiếu nhập: ${importBackupError.message}`)

  if (importBackup?.data) {
    for (const receipt of importBackup.data as any[]) {
      await assertMutation('Khôi phục phiếu nhập', supabaseAdmin.from('import_receipts').insert(receipt))
    }
  }

  await reportProgress?.(82, 'Đang khôi phục phiếu xuất từ backup')
  const { data: exportBackup, error: exportBackupError } = await supabaseAdmin
    .from('export_receipts_backup')
    .select('data')
    .eq('tenant_id', tenantId)
    .order('backup_date', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (exportBackupError) throw new Error(`Không thể đọc backup phiếu xuất: ${exportBackupError.message}`)

  if (exportBackup?.data) {
    for (const receipt of exportBackup.data as any[]) {
      await assertMutation('Khôi phục phiếu xuất', supabaseAdmin.from('export_receipts').insert(receipt))
    }
  }

  await reportProgress?.(88, 'Đang khôi phục sổ quỹ từ backup')
  const { data: cashBackup, error: cashBackupError } = await supabaseAdmin
    .from('cash_book_backup')
    .select('data')
    .eq('tenant_id', tenantId)
    .order('backup_date', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (cashBackupError) throw new Error(`Không thể đọc backup sổ quỹ: ${cashBackupError.message}`)

  if (cashBackup?.data) {
    for (const entry of cashBackup.data as any[]) {
      await assertMutation('Khôi phục sổ quỹ', supabaseAdmin.from('cash_book').insert(entry))
    }
  }
}

async function finalizeDataManagementJob(
  supabaseAdmin: any,
  params: BackgroundJobParams,
  reportProgress?: ProgressReporter,
) {
  await reportProgress?.(94, 'Đang dọn dẹp dữ liệu backup')
  await clearBackupTables(supabaseAdmin, params.tenantId)

  await reportProgress?.(97, 'Đang cập nhật trạng thái cửa hàng')
  await assertMutation(
    'Cập nhật trạng thái cửa hàng',
    supabaseAdmin
      .from('tenants')
      .update({ is_data_hidden: false, has_data_backup: false })
      .eq('id', params.tenantId),
  )

  await reportProgress?.(99, 'Đang ghi nhật ký thao tác')
  await assertOptionalMutation(
    'Ghi nhật ký thao tác',
    supabaseAdmin.from('audit_logs').insert({
      tenant_id: params.tenantId,
      user_id: params.requestedBy,
      action_type: params.deleteMode === 'keep_templates' ? 'DELETE_KEEP_TEMPLATES_JOB_COMPLETED' : 'DELETE_ALL_DATA_JOB_COMPLETED',
      table_name: 'data_management_jobs',
      description:
        params.deleteMode === 'keep_templates'
          ? `Job ${params.jobId} đã hoàn tất: xoá lịch sử, giữ sản phẩm mẫu`
          : `Job ${params.jobId} đã hoàn tất: xoá toàn bộ dữ liệu`,
    }),
  )
}

async function runFullDeletePhase(
  supabaseAdmin: any,
  tenantId: string,
  phase: DeletePhase,
  reportProgress?: ProgressReporter,
) {
  switch (phase) {
    case 'product_history': {
      await reportProgress?.(8, 'Đang tải danh sách dữ liệu cần xoá')
      const productIds = await fetchIdsByTenant(supabaseAdmin, 'products', tenantId)

      await reportProgress?.(18, 'Đang xoá IMEI và lịch sử nhập sản phẩm')
      if (productIds.length > 0) {
        await deleteByIdsInBatches(supabaseAdmin, 'imei_histories', 'product_id', productIds, 'Xoá lịch sử IMEI')
        await deleteByIdsInBatches(supabaseAdmin, 'product_imports', 'product_id', productIds, 'Xoá lịch sử nhập sản phẩm')
      }
      return
    }

    case 'stock_and_einvoice': {
      const [productIds, stockCountIds, einvoiceIds] = await Promise.all([
        fetchIdsByTenant(supabaseAdmin, 'products', tenantId),
        fetchIdsByTenant(supabaseAdmin, 'stock_counts', tenantId),
        fetchIdsByTenant(supabaseAdmin, 'einvoices', tenantId),
      ])

      await reportProgress?.(28, 'Đang xoá kiểm kho và hoá đơn điện tử')
      await cleanupStockCountData(supabaseAdmin, tenantId, productIds, stockCountIds)

      if (einvoiceIds.length > 0) {
        await deleteByIdsInBatches(supabaseAdmin, 'einvoice_items', 'einvoice_id', einvoiceIds, 'Xoá chi tiết hoá đơn điện tử', true)
      }
      await assertOptionalMutation('Xoá log hoá đơn điện tử', supabaseAdmin.from('einvoice_logs').delete().eq('tenant_id', tenantId))
      await assertOptionalMutation('Xoá hoá đơn điện tử', supabaseAdmin.from('einvoices').delete().eq('tenant_id', tenantId))
      return
    }

    case 'returns_and_exports': {
      const exportReceiptIds = await fetchIdsByTenant(supabaseAdmin, 'export_receipts', tenantId)

      await reportProgress?.(38, 'Đang xoá trả hàng và phiếu xuất')
      await assertMutation('Xoá phiếu trả hàng bán', supabaseAdmin.from('export_returns').delete().eq('tenant_id', tenantId))
      await assertMutation('Xoá phiếu trả hàng nhập', supabaseAdmin.from('import_returns').delete().eq('tenant_id', tenantId))
      await assertOptionalMutation('Xoá thanh toán trả hàng', supabaseAdmin.from('return_payments').delete().eq('tenant_id', tenantId))

      if (exportReceiptIds.length > 0) {
        await deleteByIdsInBatches(supabaseAdmin, 'export_receipt_items', 'receipt_id', exportReceiptIds, 'Xoá chi tiết phiếu xuất')
        await deleteByIdsInBatches(supabaseAdmin, 'export_receipt_payments', 'receipt_id', exportReceiptIds, 'Xoá thanh toán phiếu xuất')
      }
      await assertMutation('Xoá phiếu xuất', supabaseAdmin.from('export_receipts').delete().eq('tenant_id', tenantId))
      return
    }

    case 'imports_and_transfers': {
      const [productIds, supplierIds, importReceiptIds, stockTransferIds] = await Promise.all([
        fetchIdsByTenant(supabaseAdmin, 'products', tenantId),
        fetchIdsByTenant(supabaseAdmin, 'suppliers', tenantId),
        fetchIdsByTenant(supabaseAdmin, 'import_receipts', tenantId),
        fetchIdsByTenant(supabaseAdmin, 'stock_transfer_requests', tenantId),
      ])

      await reportProgress?.(50, 'Đang xoá phiếu nhập và điều chuyển kho')
      if (importReceiptIds.length > 0) {
        await deleteByIdsInBatches(supabaseAdmin, 'receipt_payments', 'receipt_id', importReceiptIds, 'Xoá thanh toán phiếu nhập', true)
        await deleteByIdsInBatches(supabaseAdmin, 'import_receipt_payments', 'receipt_id', importReceiptIds, 'Xoá thanh toán phiếu nhập cũ', true)
      }
      await assertMutation('Xoá phiếu nhập', supabaseAdmin.from('import_receipts').delete().eq('tenant_id', tenantId))

      if (stockTransferIds.length > 0) {
        await deleteByIdsInBatches(supabaseAdmin, 'stock_transfer_items', 'transfer_request_id', stockTransferIds, 'Xoá chi tiết chuyển kho')
      }
      if (productIds.length > 0) {
        await deleteByIdsInBatches(supabaseAdmin, 'stock_transfer_items', 'product_id', productIds, 'Xoá liên kết chuyển kho theo sản phẩm', true)
      }
      if (supplierIds.length > 0) {
        await deleteByIdsInBatches(supabaseAdmin, 'stock_transfer_items', 'supplier_id', supplierIds, 'Xoá liên kết chuyển kho theo nhà cung cấp', true)
      }
      await assertOptionalMutation('Xoá phiếu chuyển kho', supabaseAdmin.from('stock_transfer_requests').delete().eq('tenant_id', tenantId))
      return
    }

    case 'products_and_cash_book': {
      const productIds = await fetchIdsByTenant(supabaseAdmin, 'products', tenantId)

      await reportProgress?.(62, 'Đang xoá sản phẩm và sổ quỹ')

      try {
        await cleanupDirectProductReferences(supabaseAdmin, productIds)
      } catch (error) {
        console.warn('[tenant-data-management] cleanupDirectProductReferences skipped:', toErrorMessage(error))
      }

      try {
        await cleanupStockCountData(supabaseAdmin, tenantId, productIds, [])
      } catch (error) {
        console.warn('[tenant-data-management] cleanupStockCountData skipped:', toErrorMessage(error))
      }

      try {
        await assertOptionalMutation('Xoá phiếu xuất còn sót', supabaseAdmin.from('export_receipts').delete().eq('tenant_id', tenantId))
      } catch (error) {
        console.warn('[tenant-data-management] export_receipts cleanup skipped:', toErrorMessage(error))
      }

      try {
        await assertOptionalMutation('Xoá phiếu nhập còn sót', supabaseAdmin.from('import_receipts').delete().eq('tenant_id', tenantId))
      } catch (error) {
        console.warn('[tenant-data-management] import_receipts cleanup skipped:', toErrorMessage(error))
      }

      await deleteByIdsBestEffort(supabaseAdmin, 'products', 'id', productIds, 'Xoá sản phẩm', LARGE_DELETE_BATCH_SIZE)
      await assertOptionalMutation('Xoá nhóm sản phẩm', supabaseAdmin.from('product_groups').delete().eq('tenant_id', tenantId))

      const cashBookIds = await fetchIdsByTenant(supabaseAdmin, 'cash_book', tenantId)
      await deleteByIdsBestEffort(supabaseAdmin, 'cash_book', 'id', cashBookIds, 'Xoá sổ quỹ', LARGE_DELETE_BATCH_SIZE)
      await assertOptionalMutation('Xoá số dư đầu kỳ', supabaseAdmin.from('cash_book_opening_balances').delete().eq('tenant_id', tenantId))
      return
    }

    case 'debts_and_customers': {
      const customerIds = await fetchIdsByTenant(supabaseAdmin, 'customers', tenantId)

      await reportProgress?.(74, 'Đang xoá công nợ và dữ liệu khách hàng')
      const debtPaymentIds = await fetchIdsByTenant(supabaseAdmin, 'debt_payments', tenantId)
      await deleteByIdsBestEffort(supabaseAdmin, 'debt_payments', 'id', debtPaymentIds, 'Xoá thanh toán công nợ', LARGE_DELETE_BATCH_SIZE)
      await assertOptionalMutation('Xoá bù trừ công nợ', supabaseAdmin.from('debt_offsets').delete().eq('tenant_id', tenantId))
      await assertOptionalMutation('Xoá gán nhãn công nợ', supabaseAdmin.from('debt_tag_assignments').delete().eq('tenant_id', tenantId))
      await assertOptionalMutation('Xoá nhãn công nợ', supabaseAdmin.from('debt_tags').delete().eq('tenant_id', tenantId))

      if (customerIds.length > 0) {
        await deleteByIdsInBatches(supabaseAdmin, 'customer_tag_assignments', 'customer_id', customerIds, 'Xoá gán tag khách hàng', true)
        await deleteByIdsInBatches(supabaseAdmin, 'customer_contact_channels', 'customer_id', customerIds, 'Xoá kênh liên hệ khách hàng', true)
        await deleteByIdsInBatches(supabaseAdmin, 'point_transactions', 'customer_id', customerIds, 'Xoá lịch sử điểm', true)
        await deleteByIdsInBatches(supabaseAdmin, 'email_automation_logs', 'customer_id', customerIds, 'Xoá log email khách hàng', true)

        await assertOptionalMutation(
          'Gỡ liên kết khách hàng chéo tenant ở phiếu xuất',
          supabaseAdmin
            .from('export_receipts')
            .update({ customer_id: null })
            .neq('tenant_id', tenantId)
            .in('customer_id', customerIds),
        )
        await assertOptionalMutation(
          'Gỡ liên kết khách hàng chéo tenant ở phiếu trả hàng',
          supabaseAdmin
            .from('export_returns')
            .update({ customer_id: null })
            .neq('tenant_id', tenantId)
            .in('customer_id', customerIds),
        )
        await assertOptionalMutation(
          'Gỡ liên kết khách hàng chéo tenant ở lịch sử IMEI',
          supabaseAdmin
            .from('imei_histories')
            .update({ customer_id: null })
            .in('customer_id', customerIds),
        )
        await assertOptionalMutation(
          'Gỡ liên kết khách hàng ở log email tự động',
          supabaseAdmin
            .from('email_automation_logs')
            .update({ customer_id: null })
            .in('customer_id', customerIds),
        )
      }

      await assertOptionalMutation('Xoá log chăm sóc khách hàng', supabaseAdmin.from('customer_care_logs').delete().eq('tenant_id', tenantId))
      await assertOptionalMutation('Xoá nhắc lịch chăm sóc', supabaseAdmin.from('care_reminders').delete().eq('tenant_id', tenantId))
      await assertOptionalMutation('Xoá lịch chăm sóc', supabaseAdmin.from('customer_care_schedules').delete().eq('tenant_id', tenantId))
      await assertOptionalMutation('Xoá voucher khách hàng', supabaseAdmin.from('customer_vouchers').delete().eq('tenant_id', tenantId))
      await assertOptionalMutation('Xoá tag khách hàng', supabaseAdmin.from('customer_tags').delete().eq('tenant_id', tenantId))
      await assertOptionalMutation('Xoá nguồn khách hàng', supabaseAdmin.from('customer_sources').delete().eq('tenant_id', tenantId))
      await assertOptionalMutation('Xoá thông báo CRM', supabaseAdmin.from('crm_notifications').delete().eq('tenant_id', tenantId))
      await deleteByIdsBestEffort(supabaseAdmin, 'customers', 'id', customerIds, 'Xoá khách hàng', LARGE_DELETE_BATCH_SIZE)
      return
    }

    case 'final_reports': {
      const landingOrderIds = await fetchIdsByTenant(supabaseAdmin, 'landing_orders', tenantId)

      await reportProgress?.(84, 'Đang xoá nhà cung cấp, danh mục và báo cáo')
      await assertOptionalMutation('Xoá nhà cung cấp', supabaseAdmin.from('suppliers').delete().eq('tenant_id', tenantId))
      await assertOptionalMutation('Xoá danh mục', supabaseAdmin.from('categories').delete().eq('tenant_id', tenantId))
      await assertOptionalMutation('Xoá thống kê ngày', supabaseAdmin.from('daily_stats').delete().eq('tenant_id', tenantId))
      await assertOptionalMutation('Xoá snapshot giá trị kho', supabaseAdmin.from('warehouse_value_snapshots').delete().eq('tenant_id', tenantId))
      await assertOptionalMutation('Xoá snapshot hiệu suất nhân viên', supabaseAdmin.from('staff_performance_snapshots').delete().eq('tenant_id', tenantId))
      await assertOptionalMutation('Xoá đánh giá nhân viên', supabaseAdmin.from('staff_reviews').delete().eq('tenant_id', tenantId))
      await assertOptionalMutation('Xoá mẫu voucher', supabaseAdmin.from('voucher_templates').delete().eq('tenant_id', tenantId))

      if (landingOrderIds.length > 0) {
        await deleteByIdsInBatches(supabaseAdmin, 'shop_ctv_orders', 'landing_order_id', landingOrderIds, 'Xoá đơn cộng tác viên', true)
      }
      await assertOptionalMutation('Xoá log email đơn landing', supabaseAdmin.from('landing_order_email_logs').delete().eq('tenant_id', tenantId))
      await assertOptionalMutation('Xoá đơn landing', supabaseAdmin.from('landing_orders').delete().eq('tenant_id', tenantId))

      await reportProgress?.(90, 'Đang xoá nhật ký hệ thống')
      const auditLogIds = await fetchIdsByTenant(supabaseAdmin, 'audit_logs', tenantId)
      await deleteByIdsBestEffort(supabaseAdmin, 'audit_logs', 'id', auditLogIds, 'Xoá nhật ký hệ thống', LARGE_DELETE_BATCH_SIZE)
      return
    }
  }
}

async function runKeepTemplatesPhase(
  supabaseAdmin: any,
  tenantId: string,
  phase: DeletePhase,
  reportProgress?: ProgressReporter,
) {
  switch (phase) {
    case 'history_and_returns': {
      await reportProgress?.(10, 'Đang tải danh sách dữ liệu cần làm sạch')
      const productIds = await fetchIdsByTenant(supabaseAdmin, 'products', tenantId)

      await reportProgress?.(22, 'Đang xoá lịch sử IMEI và trả hàng')
      if (productIds.length > 0) {
        await deleteByIdsInBatches(supabaseAdmin, 'imei_histories', 'product_id', productIds, 'Xoá lịch sử IMEI')
        await deleteByIdsInBatches(supabaseAdmin, 'product_imports', 'product_id', productIds, 'Xoá lịch sử nhập sản phẩm', true)
      }
      await assertMutation('Xoá phiếu trả hàng bán', supabaseAdmin.from('export_returns').delete().eq('tenant_id', tenantId))
      await assertMutation('Xoá phiếu trả hàng nhập', supabaseAdmin.from('import_returns').delete().eq('tenant_id', tenantId))
      return
    }

    case 'exports': {
      const exportReceiptIds = await fetchIdsByTenant(supabaseAdmin, 'export_receipts', tenantId)

      await reportProgress?.(36, 'Đang xoá phiếu xuất và thanh toán')
      if (exportReceiptIds.length > 0) {
        await deleteByIdsInBatches(supabaseAdmin, 'export_receipt_items', 'receipt_id', exportReceiptIds, 'Xoá chi tiết phiếu xuất')
        await deleteByIdsInBatches(supabaseAdmin, 'export_receipt_payments', 'receipt_id', exportReceiptIds, 'Xoá thanh toán phiếu xuất')
      }
      await assertMutation('Xoá phiếu xuất', supabaseAdmin.from('export_receipts').delete().eq('tenant_id', tenantId))
      return
    }

    case 'imports': {
      const importReceiptIds = await fetchIdsByTenant(supabaseAdmin, 'import_receipts', tenantId)

      await reportProgress?.(50, 'Đang xoá phiếu nhập và thanh toán')
      if (importReceiptIds.length > 0) {
        await deleteByIdsInBatches(supabaseAdmin, 'receipt_payments', 'receipt_id', importReceiptIds, 'Xoá thanh toán phiếu nhập', true)
        await deleteByIdsInBatches(supabaseAdmin, 'import_receipt_payments', 'receipt_id', importReceiptIds, 'Xoá thanh toán phiếu nhập cũ', true)
      }
      await assertMutation('Xoá phiếu nhập', supabaseAdmin.from('import_receipts').delete().eq('tenant_id', tenantId))
      return
    }

    case 'products_reset': {
      const [allProductIds, stockCountIds] = await Promise.all([
        fetchIdsByTenant(supabaseAdmin, 'products', tenantId),
        fetchIdsByTenant(supabaseAdmin, 'stock_counts', tenantId),
      ])

      await reportProgress?.(64, 'Đang dọn kiểm kho và reset sản phẩm mẫu')
      await cleanupStockCountData(supabaseAdmin, tenantId, allProductIds, stockCountIds)
      await cleanupDirectProductReferences(supabaseAdmin, allProductIds)

      await assertMutation(
        'Xoá sản phẩm IMEI',
        supabaseAdmin.from('products').delete().eq('tenant_id', tenantId).not('imei', 'is', null),
      )
      await assertMutation(
        'Reset số lượng sản phẩm mẫu',
        supabaseAdmin
          .from('products')
          .update({ quantity: 0, status: 'in_stock' })
          .eq('tenant_id', tenantId),
      )
      return
    }

    case 'remaining_cleanup': {
      await reportProgress?.(76, 'Đang xoá sổ quỹ, công nợ và dữ liệu còn lại')
      await assertMutation('Xoá sổ quỹ', supabaseAdmin.from('cash_book').delete().eq('tenant_id', tenantId))
      await assertMutation('Xoá thanh toán công nợ', supabaseAdmin.from('debt_payments').delete().eq('tenant_id', tenantId))

      await reportProgress?.(86, 'Đang reset dữ liệu khách hàng và nhật ký')
      await assertMutation('Xoá nhật ký hệ thống', supabaseAdmin.from('audit_logs').delete().eq('tenant_id', tenantId))
      await assertMutation(
        'Reset thông tin khách hàng',
        supabaseAdmin
          .from('customers')
          .update({
            total_spent: 0,
            current_points: 0,
            pending_points: 0,
            total_points_earned: 0,
            total_points_used: 0,
            last_purchase_date: null,
          })
          .eq('tenant_id', tenantId),
      )
      return
    }
  }
}

async function processDataManagementJob(params: BackgroundJobParams) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabaseAdmin = createAdminClient(supabaseUrl, serviceKey)
  const startedAt = new Date().toISOString()
  const { data: jobSnapshot, error: jobSnapshotError } = await supabaseAdmin
    .from('data_management_jobs')
    .select('status, metadata, started_at')
    .eq('id', params.jobId)
    .single()

  if (jobSnapshotError) {
    throw new Error(`Không thể tải trạng thái tác vụ xoá dữ liệu: ${jobSnapshotError.message}`)
  }

  if (!jobSnapshot || (jobSnapshot.status !== 'queued' && jobSnapshot.status !== 'processing')) {
    return
  }

  const jobMetadata = normalizeJobMetadata(jobSnapshot.metadata)
  const effectiveStartedAt = jobSnapshot.started_at || startedAt

  const reportProgress: ProgressReporter = async (progress, step) => {
    await updateJob(supabaseAdmin, params.jobId, {
      status: 'processing',
      progress,
      current_step: step,
      started_at: effectiveStartedAt,
      error_message: null,
    })
  }

  try {
    await updateJob(supabaseAdmin, params.jobId, {
      status: 'processing',
      progress: 3,
      current_step: 'Đang chuẩn bị xoá dữ liệu',
      started_at: effectiveStartedAt,
      error_message: null,
    })

    const currentPhase = jobMetadata.delete_phase || getInitialDeletePhase(params.deleteMode)

    if (currentPhase === 'restore') {
      if (params.restoreOption === 'restore') {
        await restoreDataFromBackup(supabaseAdmin, params.tenantId, reportProgress)
      }

      await updateJob(supabaseAdmin, params.jobId, {
        metadata: {
          ...jobMetadata,
          delete_phase: 'finalize',
        },
      })

      scheduleJobContinuation(supabaseUrl, serviceKey, params.jobId)
      return
    }

    if (currentPhase === 'finalize') {
      await finalizeDataManagementJob(supabaseAdmin, params, reportProgress)

      await updateJob(supabaseAdmin, params.jobId, {
        status: 'completed',
        progress: 100,
        current_step: 'Hoàn tất',
        completed_at: new Date().toISOString(),
        error_message: null,
        metadata: {
          ...jobMetadata,
          delete_phase: 'done',
        },
      })

      await sendDataManagementEmail({
        jobId: params.jobId,
        toEmail: params.requestedByEmail,
        deleteMode: params.deleteMode,
        status: 'completed',
      })
      return
    }

    if (params.deleteMode === 'keep_templates') {
      await runKeepTemplatesPhase(supabaseAdmin, params.tenantId, currentPhase, reportProgress)
    } else {
      await runFullDeletePhase(supabaseAdmin, params.tenantId, currentPhase, reportProgress)
    }

    const nextPhase = getNextDeletePhase(params.deleteMode, currentPhase)

    await updateJob(supabaseAdmin, params.jobId, {
      metadata: {
        ...jobMetadata,
        delete_phase: nextPhase ?? (params.restoreOption === 'restore' ? 'restore' : 'finalize'),
      },
    })

    scheduleJobContinuation(supabaseUrl, serviceKey, params.jobId)
  } catch (error) {
    const errorMessage = toErrorMessage(error)
    console.error('[tenant-data-management] processDataManagementJob failed:', error)

    await safeUpdateJob(supabaseAdmin, params.jobId, {
      status: 'failed',
      current_step: 'Thất bại',
      error_message: errorMessage,
      completed_at: new Date().toISOString(),
    })

    await sendDataManagementEmail({
      jobId: params.jobId,
      toEmail: params.requestedByEmail,
      deleteMode: params.deleteMode,
      status: 'failed',
      errorMessage,
    })
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const clientIP = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!

    const rlClient = createAdminClient(supabaseUrl, supabaseServiceKey)

    const supabaseAdmin = createAdminClient(supabaseUrl, supabaseServiceKey)
    const body = await req.json()
    const { action, tenantId } = body

    if (!action) {
      return jsonResponse({ error: 'Thiếu action' })
    }

    const authHeader = req.headers.get('Authorization')
    const isInternalCall = authHeader === `Bearer ${supabaseServiceKey}`

    if (action === 'continue_job') {
      if (!isInternalCall) {
        return jsonResponse({ error: 'Không có quyền truy cập' })
      }

      const jobId = String(body.jobId || '')
      if (!jobId) {
        return jsonResponse({ error: 'Thiếu jobId' })
      }

      const { data: internalJob, error: internalJobError } = await supabaseAdmin
        .from('data_management_jobs')
        .select('id, tenant_id, delete_mode, requested_by, requested_by_email, metadata, status')
        .eq('id', jobId)
        .single()

      if (internalJobError) {
        return jsonResponse({ error: 'Không thể tải tác vụ xoá dữ liệu: ' + internalJobError.message })
      }

      if (!internalJob || (internalJob.status !== 'queued' && internalJob.status !== 'processing')) {
        return jsonResponse({ success: true, skipped: true })
      }

      const internalMetadata = normalizeJobMetadata(internalJob.metadata)
      await processDataManagementJob({
        jobId: internalJob.id,
        tenantId: internalJob.tenant_id,
        deleteMode: normalizeDeleteMode(internalJob.delete_mode),
        restoreOption: normalizeRestoreOption(internalMetadata.restore_option),
        requestedBy: internalJob.requested_by,
        requestedByEmail: internalJob.requested_by_email,
      })

      return jsonResponse({ success: true, jobId })
    }

    if (!authHeader) {
      return jsonResponse({ error: 'Không có quyền truy cập' })
    }

    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const {
      data: { user: caller },
      error: callerError,
    } = await supabaseClient.auth.getUser()

    if (callerError || !caller) {
      return jsonResponse({ error: 'Không thể xác thực người dùng' })
    }

    const { data: userRole } = await supabaseAdmin
      .from('user_roles')
      .select('tenant_id, user_role')
      .eq('user_id', caller.id)
      .single()

    const { data: platformUser } = await supabaseAdmin
      .from('platform_users')
      .select('tenant_id, platform_role')
      .eq('user_id', caller.id)
      .single()

    const isSuperAdmin = userRole?.user_role === 'super_admin'
    const isPlatformAdmin = platformUser?.platform_role === 'platform_admin'
    const callerTenantId = isPlatformAdmin ? tenantId || platformUser?.tenant_id : userRole?.tenant_id || platformUser?.tenant_id

    if (!isSuperAdmin && !isPlatformAdmin) {
      return jsonResponse({ error: 'Chỉ Super Admin mới có quyền thực hiện' })
    }

    if (!callerTenantId) {
      return jsonResponse({ error: 'Không tìm thấy thông tin cửa hàng' })
    }

    const rateLimitKey = `tenant-data-management:${action}:${callerTenantId}:${caller.id}`
    const ensureActionRateLimit = async () => {
      const { data: allowed, error: rateLimitError } = await rlClient.rpc('check_rate_limit', {
        _function_name: rateLimitKey,
        _ip_address: clientIP,
        _max_requests: MAX_REQUESTS_PER_HOUR,
        _window_minutes: RATE_LIMIT_WINDOW_MINUTES,
      })

      if (rateLimitError) {
        throw new Error(`Không thể kiểm tra giới hạn yêu cầu: ${rateLimitError.message}`)
      }

      return allowed !== false
    }

    switch (action) {
      case 'toggle_data_visibility': {
        const { isHidden, password } = body
        const passwordError = await verifyCallerPassword(supabaseAdmin, caller.email, password)
        if (passwordError) {
          return jsonResponse({ error: passwordError })
        }

        if (!(await ensureActionRateLimit())) {
          return jsonResponse({ error: 'Quá nhiều yêu cầu. Vui lòng thử lại sau.' })
        }

        if (isHidden === true) {
          const { data: products } = await supabaseAdmin.from('products').select('*').eq('tenant_id', callerTenantId)
          if (products && products.length > 0) {
            await supabaseAdmin.from('products_backup').delete().eq('tenant_id', callerTenantId)
            await supabaseAdmin.from('products_backup').insert({ tenant_id: callerTenantId, data: products })
          }

          const { data: importReceipts } = await supabaseAdmin.from('import_receipts').select('*').eq('tenant_id', callerTenantId)
          if (importReceipts && importReceipts.length > 0) {
            await supabaseAdmin.from('import_receipts_backup').delete().eq('tenant_id', callerTenantId)
            await supabaseAdmin.from('import_receipts_backup').insert({ tenant_id: callerTenantId, data: importReceipts })
          }

          const { data: exportReceipts } = await supabaseAdmin.from('export_receipts').select('*').eq('tenant_id', callerTenantId)
          if (exportReceipts && exportReceipts.length > 0) {
            await supabaseAdmin.from('export_receipts_backup').delete().eq('tenant_id', callerTenantId)
            await supabaseAdmin.from('export_receipts_backup').insert({ tenant_id: callerTenantId, data: exportReceipts })
          }

          const { data: cashBook } = await supabaseAdmin.from('cash_book').select('*').eq('tenant_id', callerTenantId)
          if (cashBook && cashBook.length > 0) {
            await supabaseAdmin.from('cash_book_backup').delete().eq('tenant_id', callerTenantId)
            await supabaseAdmin.from('cash_book_backup').insert({ tenant_id: callerTenantId, data: cashBook })
          }

          const { error: updateError } = await supabaseAdmin
            .from('tenants')
            .update({ is_data_hidden: true, has_data_backup: true })
            .eq('id', callerTenantId)

          if (updateError) {
            return jsonResponse({ error: 'Không thể cập nhật trạng thái: ' + updateError.message })
          }

          await supabaseAdmin.from('audit_logs').insert({
            tenant_id: callerTenantId,
            user_id: caller.id,
            action_type: 'ENABLE_TEST_MODE',
            table_name: 'tenants',
            description: 'Bật chế độ Test - Đã backup dữ liệu gốc',
          })
        } else {
          const { error: updateError } = await supabaseAdmin
            .from('tenants')
            .update({ is_data_hidden: false })
            .eq('id', callerTenantId)

          if (updateError) {
            return jsonResponse({ error: 'Không thể cập nhật trạng thái: ' + updateError.message })
          }

          await supabaseAdmin.from('audit_logs').insert({
            tenant_id: callerTenantId,
            user_id: caller.id,
            action_type: 'DISABLE_TEST_MODE',
            table_name: 'tenants',
            description: 'Tắt chế độ Test',
          })
        }

        return jsonResponse({
          success: true,
          message: isHidden ? 'Đã bật chế độ Test - Dữ liệu đã được backup' : 'Đã tắt chế độ Test',
        })
      }

      case 'stop_test_mode':
      case 'delete_all_data': {
        const normalizedConfirm = normalizeConfirmText(body.confirmText)
        if (normalizedConfirm !== 'tôi đồng ý xoá' && normalizedConfirm !== 'tôi đồng ý xóa') {
          return jsonResponse({ error: 'Văn bản xác nhận không đúng' })
        }

        const passwordError = await verifyCallerPassword(supabaseAdmin, caller.email, body.password)
        if (passwordError) {
          return jsonResponse({ error: passwordError })
        }

        if (!(await ensureActionRateLimit())) {
          return jsonResponse({ error: 'Quá nhiều yêu cầu. Vui lòng thử lại sau.' })
        }

        const activeJob = await getActiveDeleteJob(supabaseAdmin, callerTenantId)
        if (activeJob) {
          return jsonResponse({
            success: true,
            alreadyRunning: true,
            jobId: activeJob.id,
            job: activeJob,
            message: 'Hệ thống đang xử lý yêu cầu xoá dữ liệu trước đó.',
          })
        }

        const deleteMode = normalizeDeleteMode(body.deleteMode)
        const restoreOption = normalizeRestoreOption(body.restoreOption)

        // Lấy email từ bảng tenants (email cửa hàng đã cập nhật) thay vì auth user
        let notifyEmail = caller.email ?? null
        try {
          const { data: tenantData } = await supabaseAdmin
            .from('tenants')
            .select('email')
            .eq('id', callerTenantId)
            .single()
          if (tenantData?.email) {
            notifyEmail = tenantData.email
          }
        } catch (_) { /* fallback to caller.email */ }

        const { data: createdJob, error: createJobError } = await supabaseAdmin
          .from('data_management_jobs')
          .insert({
            job_type: 'delete_restore',
            tenant_id: callerTenantId,
            requested_by: caller.id,
            requested_by_email: notifyEmail,
            delete_mode: deleteMode,
            status: 'queued',
            progress: 0,
            current_step: 'Đang đưa yêu cầu vào hàng chờ',
            notify_email: notifyEmail,
            metadata: {
              restore_option: restoreOption,
              requested_action: action,
            },
          })
          .select('id, status, progress, current_step, delete_mode, notify_email, created_at')
          .single()

        if (createJobError) {
          const duplicateError = createJobError.code === '23505' || String(createJobError.message).includes('idx_data_management_jobs_one_active_per_tenant')

          if (duplicateError) {
            const duplicatedActiveJob = await getActiveDeleteJob(supabaseAdmin, callerTenantId)
            if (duplicatedActiveJob) {
              return jsonResponse({
                success: true,
                alreadyRunning: true,
                jobId: duplicatedActiveJob.id,
                job: duplicatedActiveJob,
                message: 'Hệ thống đang xử lý yêu cầu xoá dữ liệu trước đó.',
              })
            }
          }

          return jsonResponse({ error: 'Không thể tạo tác vụ xoá dữ liệu: ' + createJobError.message })
        }

        scheduleJobContinuation(supabaseUrl, supabaseServiceKey, createdJob.id)

        return jsonResponse({
          success: true,
          jobId: createdJob.id,
          job: createdJob,
          message: notifyEmail
            ? 'Đã bắt đầu xoá dữ liệu ở nền. Khi hoàn tất hệ thống sẽ báo trong app và qua email.'
            : 'Đã bắt đầu xoá dữ liệu ở nền. Bạn có thể theo dõi tiến trình ngay trong ứng dụng.',
        })
      }

      default:
        return jsonResponse({ error: 'Hành động không hợp lệ' })
    }
  } catch (error) {
    console.error('Unexpected error:', error)
    return jsonResponse({ error: 'Lỗi hệ thống: ' + toErrorMessage(error) })
  }
})

async function deleteAllWarehouseData(supabaseAdmin: any, tenantId: string, reportProgress?: ProgressReporter) {
  await reportProgress?.(8, 'Đang tải danh sách dữ liệu cần xoá')

  const [productIds, customerIds, supplierIds, exportReceiptIds, importReceiptIds, stockCountIds, einvoiceIds, landingOrderIds, stockTransferIds] = await Promise.all([
    fetchIdsByTenant(supabaseAdmin, 'products', tenantId),
    fetchIdsByTenant(supabaseAdmin, 'customers', tenantId),
    fetchIdsByTenant(supabaseAdmin, 'suppliers', tenantId),
    fetchIdsByTenant(supabaseAdmin, 'export_receipts', tenantId),
    fetchIdsByTenant(supabaseAdmin, 'import_receipts', tenantId),
    fetchIdsByTenant(supabaseAdmin, 'stock_counts', tenantId),
    fetchIdsByTenant(supabaseAdmin, 'einvoices', tenantId),
    fetchIdsByTenant(supabaseAdmin, 'landing_orders', tenantId),
    fetchIdsByTenant(supabaseAdmin, 'stock_transfer_requests', tenantId),
  ])

  await reportProgress?.(18, 'Đang xoá IMEI và lịch sử nhập sản phẩm')
  if (productIds.length > 0) {
    await deleteByIdsInBatches(supabaseAdmin, 'imei_histories', 'product_id', productIds, 'Xoá lịch sử IMEI')
    await deleteByIdsInBatches(supabaseAdmin, 'product_imports', 'product_id', productIds, 'Xoá lịch sử nhập sản phẩm')
  }

  await reportProgress?.(28, 'Đang xoá kiểm kho và hoá đơn điện tử')
  await cleanupStockCountData(supabaseAdmin, tenantId, productIds, stockCountIds)

  if (einvoiceIds.length > 0) {
    await deleteByIdsInBatches(supabaseAdmin, 'einvoice_items', 'einvoice_id', einvoiceIds, 'Xoá chi tiết hoá đơn điện tử', true)
  }
  await assertOptionalMutation('Xoá log hoá đơn điện tử', supabaseAdmin.from('einvoice_logs').delete().eq('tenant_id', tenantId))
  await assertOptionalMutation('Xoá hoá đơn điện tử', supabaseAdmin.from('einvoices').delete().eq('tenant_id', tenantId))

  await reportProgress?.(38, 'Đang xoá trả hàng và phiếu xuất')
  await assertMutation('Xoá phiếu trả hàng bán', supabaseAdmin.from('export_returns').delete().eq('tenant_id', tenantId))
  await assertMutation('Xoá phiếu trả hàng nhập', supabaseAdmin.from('import_returns').delete().eq('tenant_id', tenantId))
  await assertOptionalMutation('Xoá thanh toán trả hàng', supabaseAdmin.from('return_payments').delete().eq('tenant_id', tenantId))

  if (exportReceiptIds.length > 0) {
    await deleteByIdsInBatches(supabaseAdmin, 'export_receipt_items', 'receipt_id', exportReceiptIds, 'Xoá chi tiết phiếu xuất')
    await deleteByIdsInBatches(supabaseAdmin, 'export_receipt_payments', 'receipt_id', exportReceiptIds, 'Xoá thanh toán phiếu xuất')
  }
  await assertMutation('Xoá phiếu xuất', supabaseAdmin.from('export_receipts').delete().eq('tenant_id', tenantId))

  await reportProgress?.(50, 'Đang xoá phiếu nhập và điều chuyển kho')
  if (importReceiptIds.length > 0) {
    await deleteByIdsInBatches(supabaseAdmin, 'receipt_payments', 'receipt_id', importReceiptIds, 'Xoá thanh toán phiếu nhập', true)
    await deleteByIdsInBatches(supabaseAdmin, 'import_receipt_payments', 'receipt_id', importReceiptIds, 'Xoá thanh toán phiếu nhập cũ', true)
  }
  await assertMutation('Xoá phiếu nhập', supabaseAdmin.from('import_receipts').delete().eq('tenant_id', tenantId))

  if (stockTransferIds.length > 0) {
    await deleteByIdsInBatches(supabaseAdmin, 'stock_transfer_items', 'transfer_request_id', stockTransferIds, 'Xoá chi tiết chuyển kho')
  }
  if (productIds.length > 0) {
    await deleteByIdsInBatches(supabaseAdmin, 'stock_transfer_items', 'product_id', productIds, 'Xoá liên kết chuyển kho theo sản phẩm')
  }
  if (supplierIds.length > 0) {
    await deleteByIdsInBatches(supabaseAdmin, 'stock_transfer_items', 'supplier_id', supplierIds, 'Xoá liên kết chuyển kho theo nhà cung cấp', true)
  }
  await assertOptionalMutation('Xoá phiếu chuyển kho', supabaseAdmin.from('stock_transfer_requests').delete().eq('tenant_id', tenantId))

  await reportProgress?.(62, 'Đang xoá sản phẩm và sổ quỹ')

  try {
    await cleanupDirectProductReferences(supabaseAdmin, productIds)
  } catch (error) {
    console.warn('[tenant-data-management] cleanupDirectProductReferences skipped:', toErrorMessage(error))
  }

  try {
    await cleanupStockCountData(supabaseAdmin, tenantId, productIds, [])
  } catch (error) {
    console.warn('[tenant-data-management] cleanupStockCountData skipped:', toErrorMessage(error))
  }

  try {
    await assertOptionalMutation('Xoá phiếu xuất còn sót', supabaseAdmin.from('export_receipts').delete().eq('tenant_id', tenantId))
  } catch (error) {
    console.warn('[tenant-data-management] export_receipts cleanup skipped:', toErrorMessage(error))
  }

  try {
    await assertOptionalMutation('Xoá phiếu nhập còn sót', supabaseAdmin.from('import_receipts').delete().eq('tenant_id', tenantId))
  } catch (error) {
    console.warn('[tenant-data-management] import_receipts cleanup skipped:', toErrorMessage(error))
  }

  await deleteByIdsBestEffort(supabaseAdmin, 'products', 'id', productIds, 'Xoá sản phẩm', LARGE_DELETE_BATCH_SIZE)
  await assertOptionalMutation('Xoá nhóm sản phẩm', supabaseAdmin.from('product_groups').delete().eq('tenant_id', tenantId))

  const cashBookIds = await fetchIdsByTenant(supabaseAdmin, 'cash_book', tenantId)
  await deleteByIdsBestEffort(supabaseAdmin, 'cash_book', 'id', cashBookIds, 'Xoá sổ quỹ', LARGE_DELETE_BATCH_SIZE)

  await assertOptionalMutation('Xoá số dư đầu kỳ', supabaseAdmin.from('cash_book_opening_balances').delete().eq('tenant_id', tenantId))

  await reportProgress?.(74, 'Đang xoá công nợ và dữ liệu khách hàng')
  const debtPaymentIds = await fetchIdsByTenant(supabaseAdmin, 'debt_payments', tenantId)
  await deleteByIdsBestEffort(supabaseAdmin, 'debt_payments', 'id', debtPaymentIds, 'Xoá thanh toán công nợ', LARGE_DELETE_BATCH_SIZE)
  await assertOptionalMutation('Xoá bù trừ công nợ', supabaseAdmin.from('debt_offsets').delete().eq('tenant_id', tenantId))
  await assertOptionalMutation('Xoá gán nhãn công nợ', supabaseAdmin.from('debt_tag_assignments').delete().eq('tenant_id', tenantId))
  await assertOptionalMutation('Xoá nhãn công nợ', supabaseAdmin.from('debt_tags').delete().eq('tenant_id', tenantId))

  if (customerIds.length > 0) {
    await deleteByIdsInBatches(supabaseAdmin, 'customer_tag_assignments', 'customer_id', customerIds, 'Xoá gán tag khách hàng', true)
    await deleteByIdsInBatches(supabaseAdmin, 'customer_contact_channels', 'customer_id', customerIds, 'Xoá kênh liên hệ khách hàng', true)
    await deleteByIdsInBatches(supabaseAdmin, 'point_transactions', 'customer_id', customerIds, 'Xoá lịch sử điểm', true)
    await deleteByIdsInBatches(supabaseAdmin, 'email_automation_logs', 'customer_id', customerIds, 'Xoá log email khách hàng', true)
  }
  await assertOptionalMutation('Xoá log chăm sóc khách hàng', supabaseAdmin.from('customer_care_logs').delete().eq('tenant_id', tenantId))
  await assertOptionalMutation('Xoá nhắc lịch chăm sóc', supabaseAdmin.from('care_reminders').delete().eq('tenant_id', tenantId))
  await assertOptionalMutation('Xoá lịch chăm sóc', supabaseAdmin.from('customer_care_schedules').delete().eq('tenant_id', tenantId))
  await assertOptionalMutation('Xoá voucher khách hàng', supabaseAdmin.from('customer_vouchers').delete().eq('tenant_id', tenantId))
  await assertOptionalMutation('Xoá tag khách hàng', supabaseAdmin.from('customer_tags').delete().eq('tenant_id', tenantId))
  await assertOptionalMutation('Xoá nguồn khách hàng', supabaseAdmin.from('customer_sources').delete().eq('tenant_id', tenantId))
  await assertOptionalMutation('Xoá thông báo CRM', supabaseAdmin.from('crm_notifications').delete().eq('tenant_id', tenantId))
  await deleteByIdsBestEffort(supabaseAdmin, 'customers', 'id', customerIds, 'Xoá khách hàng', LARGE_DELETE_BATCH_SIZE)

  await reportProgress?.(84, 'Đang xoá nhà cung cấp, danh mục và báo cáo')
  await assertOptionalMutation('Xoá nhà cung cấp', supabaseAdmin.from('suppliers').delete().eq('tenant_id', tenantId))
  await assertOptionalMutation('Xoá danh mục', supabaseAdmin.from('categories').delete().eq('tenant_id', tenantId))
  await assertOptionalMutation('Xoá thống kê ngày', supabaseAdmin.from('daily_stats').delete().eq('tenant_id', tenantId))
  await assertOptionalMutation('Xoá snapshot giá trị kho', supabaseAdmin.from('warehouse_value_snapshots').delete().eq('tenant_id', tenantId))
  await assertOptionalMutation('Xoá snapshot hiệu suất nhân viên', supabaseAdmin.from('staff_performance_snapshots').delete().eq('tenant_id', tenantId))
  await assertOptionalMutation('Xoá đánh giá nhân viên', supabaseAdmin.from('staff_reviews').delete().eq('tenant_id', tenantId))
  await assertOptionalMutation('Xoá mẫu voucher', supabaseAdmin.from('voucher_templates').delete().eq('tenant_id', tenantId))

  if (landingOrderIds.length > 0) {
    await deleteByIdsInBatches(supabaseAdmin, 'shop_ctv_orders', 'landing_order_id', landingOrderIds, 'Xoá đơn cộng tác viên', true)
  }
  await assertOptionalMutation('Xoá log email đơn landing', supabaseAdmin.from('landing_order_email_logs').delete().eq('tenant_id', tenantId))
  await assertOptionalMutation('Xoá đơn landing', supabaseAdmin.from('landing_orders').delete().eq('tenant_id', tenantId))

  await reportProgress?.(90, 'Đang xoá nhật ký hệ thống')
  const auditLogIds = await fetchIdsByTenant(supabaseAdmin, 'audit_logs', tenantId)
  await deleteByIdsBestEffort(supabaseAdmin, 'audit_logs', 'id', auditLogIds, 'Xoá nhật ký hệ thống', LARGE_DELETE_BATCH_SIZE)
}

async function deleteKeepTemplates(supabaseAdmin: any, tenantId: string, reportProgress?: ProgressReporter) {
  await reportProgress?.(10, 'Đang tải danh sách dữ liệu cần làm sạch')

  const [productIds, exportReceiptIds, importReceiptIds, stockCountIds] = await Promise.all([
    fetchIdsByTenant(supabaseAdmin, 'products', tenantId),
    fetchIdsByTenant(supabaseAdmin, 'export_receipts', tenantId),
    fetchIdsByTenant(supabaseAdmin, 'import_receipts', tenantId),
    fetchIdsByTenant(supabaseAdmin, 'stock_counts', tenantId),
  ])

  await reportProgress?.(22, 'Đang xoá lịch sử IMEI và trả hàng')
  if (productIds.length > 0) {
    await deleteByIdsInBatches(supabaseAdmin, 'imei_histories', 'product_id', productIds, 'Xoá lịch sử IMEI')
    await deleteByIdsInBatches(supabaseAdmin, 'product_imports', 'product_id', productIds, 'Xoá lịch sử nhập sản phẩm', true)
  }
  await assertMutation('Xoá phiếu trả hàng bán', supabaseAdmin.from('export_returns').delete().eq('tenant_id', tenantId))
  await assertMutation('Xoá phiếu trả hàng nhập', supabaseAdmin.from('import_returns').delete().eq('tenant_id', tenantId))

  await reportProgress?.(36, 'Đang xoá phiếu xuất và thanh toán')
  if (exportReceiptIds.length > 0) {
    await deleteByIdsInBatches(supabaseAdmin, 'export_receipt_items', 'receipt_id', exportReceiptIds, 'Xoá chi tiết phiếu xuất')
    await deleteByIdsInBatches(supabaseAdmin, 'export_receipt_payments', 'receipt_id', exportReceiptIds, 'Xoá thanh toán phiếu xuất')
  }
  await assertMutation('Xoá phiếu xuất', supabaseAdmin.from('export_receipts').delete().eq('tenant_id', tenantId))

  await reportProgress?.(50, 'Đang xoá phiếu nhập và thanh toán')
  if (importReceiptIds.length > 0) {
    await deleteByIdsInBatches(supabaseAdmin, 'receipt_payments', 'receipt_id', importReceiptIds, 'Xoá thanh toán phiếu nhập', true)
    await deleteByIdsInBatches(supabaseAdmin, 'import_receipt_payments', 'receipt_id', importReceiptIds, 'Xoá thanh toán phiếu nhập cũ', true)
  }
  await assertMutation('Xoá phiếu nhập', supabaseAdmin.from('import_receipts').delete().eq('tenant_id', tenantId))

  await reportProgress?.(64, 'Đang dọn kiểm kho và reset sản phẩm mẫu')

  const allProductIds = await fetchIdsByTenant(supabaseAdmin, 'products', tenantId)
  await cleanupStockCountData(supabaseAdmin, tenantId, allProductIds, stockCountIds)
  await cleanupDirectProductReferences(supabaseAdmin, allProductIds)

  await assertMutation(
    'Xoá sản phẩm IMEI',
    supabaseAdmin.from('products').delete().eq('tenant_id', tenantId).not('imei', 'is', null),
  )
  await assertMutation(
    'Reset số lượng sản phẩm mẫu',
    supabaseAdmin
      .from('products')
      .update({ quantity: 0, status: 'in_stock' })
      .eq('tenant_id', tenantId),
  )

  await reportProgress?.(76, 'Đang xoá sổ quỹ, công nợ và dữ liệu còn lại')
  await assertMutation('Xoá sổ quỹ', supabaseAdmin.from('cash_book').delete().eq('tenant_id', tenantId))
  await assertMutation('Xoá thanh toán công nợ', supabaseAdmin.from('debt_payments').delete().eq('tenant_id', tenantId))

  await reportProgress?.(86, 'Đang reset dữ liệu khách hàng và nhật ký')
  await assertMutation('Xoá nhật ký hệ thống', supabaseAdmin.from('audit_logs').delete().eq('tenant_id', tenantId))
  await assertMutation(
    'Reset thông tin khách hàng',
    supabaseAdmin
      .from('customers')
      .update({
        total_spent: 0,
        current_points: 0,
        pending_points: 0,
        total_points_earned: 0,
        total_points_used: 0,
        last_purchase_date: null,
      })
      .eq('tenant_id', tenantId),
  )
}
