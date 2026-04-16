import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Fetch all rows with pagination to bypass 1000-row limit
async function fetchAll<T>(queryFn: () => any, pageSize = 1000): Promise<T[]> {
  const all: T[] = []
  let from = 0
  while (true) {
    const { data, error } = await queryFn().range(from, from + pageSize - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    all.push(...(data as T[]))
    if (data.length < pageSize) break
    from += pageSize
  }
  return all
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Không có quyền truy cập' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!

    const admin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const client = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const { data: { user }, error: userError } = await client.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Không thể xác thực' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body = await req.json()
    const tenantId = (body?.tenantId ?? '').trim()
    const dryRun = body?.dryRun !== false

    if (!tenantId) {
      return new Response(JSON.stringify({ error: 'Thiếu tenantId' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Permission check
    const [{ data: userRole }, { data: platformUser }] = await Promise.all([
      admin.from('user_roles').select('user_role').eq('user_id', user.id).eq('tenant_id', tenantId).maybeSingle(),
      admin.from('platform_users').select('platform_role').eq('user_id', user.id).maybeSingle(),
    ])
    if (userRole?.user_role !== 'super_admin' && platformUser?.platform_role !== 'platform_admin') {
      return new Response(JSON.stringify({ error: 'Chỉ Super Admin/Platform Admin' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 1. Fetch all data with pagination (bypasses 1000-row limit)
    const [allReceipts, orphans, suppliers] = await Promise.all([
      fetchAll<any>(() => admin.from('import_receipts')
        .select('id, code, import_date, total_amount, supplier_id, branch_id')
        .eq('tenant_id', tenantId)
        .eq('status', 'completed')),
      fetchAll<any>(() => admin.from('products')
        .select('id, imei, name, sku, import_price, supplier_id, import_date, branch_id, status')
        .eq('tenant_id', tenantId)
        .is('import_receipt_id', null)
        .neq('status', 'template')),
      fetchAll<any>(() => admin.from('suppliers').select('id, name').eq('tenant_id', tenantId)),
    ])

    const supplierNameMap = new Map(suppliers.map(s => [s.id, s.name]))

    // Build sets of receipt IDs that have products (paginated)
    const receiptIdsWithProducts = new Set<string>()

    const linkedProducts = await fetchAll<any>(() => admin.from('products')
      .select('import_receipt_id')
      .eq('tenant_id', tenantId)
      .not('import_receipt_id', 'is', null)
      .neq('status', 'template'))

    for (const p of linkedProducts) {
      if (p.import_receipt_id) receiptIdsWithProducts.add(p.import_receipt_id)
    }

    // Check product_imports in batches (receipt IDs)
    const receiptIds = allReceipts.map(r => r.id)
    for (let i = 0; i < receiptIds.length; i += 500) {
      const batch = receiptIds.slice(i, i + 500)
      const { data: linkedPI } = await admin
        .from('product_imports')
        .select('import_receipt_id')
        .in('import_receipt_id', batch)
      for (const pi of linkedPI || []) {
        if (pi.import_receipt_id) receiptIdsWithProducts.add(pi.import_receipt_id)
      }
    }

    // Empty receipts = those not in either set
    const emptyReceipts = allReceipts.filter(r => !receiptIdsWithProducts.has(r.id))

    // Matching logic
    const usedProductIds = new Set<string>()
    const matchResults: { receiptCode: string; receiptId: string; strategy: string; products: { id: string; name: string; imei: string | null; price: number }[] }[] = []
    const unmatchedReceipts: { code: string; id: string; total: number; supplierName: string | null }[] = []

    const sorted = [...emptyReceipts].sort((a, b) => a.total_amount - b.total_amount)

    for (const receipt of sorted) {
      const total = receipt.total_amount
      if (total <= 0) continue

      // Strategy A: exact single-product match (same supplier)
      const exactMatch = orphans.find(p =>
        !usedProductIds.has(p.id) &&
        p.supplier_id === receipt.supplier_id &&
        Math.abs((p.import_price ?? 0) - total) <= 1
      )

      if (exactMatch) {
        usedProductIds.add(exactMatch.id)
        matchResults.push({
          receiptCode: receipt.code, receiptId: receipt.id, strategy: 'exact_single',
          products: [{ id: exactMatch.id, name: exactMatch.name, imei: exactMatch.imei, price: exactMatch.import_price }],
        })
        continue
      }

      // Strategy B: greedy multi-product match (same supplier, max 10)
      const candidates = orphans
        .filter(p => !usedProductIds.has(p.id) && p.supplier_id === receipt.supplier_id && (p.import_price ?? 0) > 0)
        .sort((a, b) => (b.import_price ?? 0) - (a.import_price ?? 0))

      if (candidates.length > 0 && candidates.length <= 50) {
        const selected: typeof candidates = []
        let remaining = total
        for (const c of candidates) {
          if (selected.length >= 10) break
          const price = c.import_price ?? 0
          if (price <= remaining + 1) {
            selected.push(c)
            remaining -= price
          }
          if (Math.abs(remaining) <= 1) break
        }
        if (Math.abs(remaining) <= 1 && selected.length > 0) {
          for (const p of selected) usedProductIds.add(p.id)
          matchResults.push({
            receiptCode: receipt.code, receiptId: receipt.id, strategy: 'greedy_multi',
            products: selected.map(p => ({ id: p.id, name: p.name, imei: p.imei, price: p.import_price })),
          })
          continue
        }
      }

      // Strategy C: cross-supplier single match
      const crossMatch = orphans.find(p =>
        !usedProductIds.has(p.id) &&
        Math.abs((p.import_price ?? 0) - total) <= 1
      )
      if (crossMatch) {
        usedProductIds.add(crossMatch.id)
        matchResults.push({
          receiptCode: receipt.code, receiptId: receipt.id, strategy: 'cross_supplier_single',
          products: [{ id: crossMatch.id, name: crossMatch.name, imei: crossMatch.imei, price: crossMatch.import_price }],
        })
        continue
      }

      unmatchedReceipts.push({
        code: receipt.code, id: receipt.id, total,
        supplierName: receipt.supplier_id ? supplierNameMap.get(receipt.supplier_id) ?? null : null,
      })
    }

    // Apply if not dry run
    let updatedCount = 0
    if (!dryRun) {
      for (const m of matchResults) {
        for (const p of m.products) {
          const { error: upErr } = await admin.from('products').update({
            import_receipt_id: m.receiptId,
          }).eq('id', p.id)
          if (!upErr) updatedCount++
          else console.error(`Update failed for ${p.id}:`, upErr)
        }
      }

      await admin.from('audit_logs').insert({
        tenant_id: tenantId, user_id: user.id,
        action_type: 'RESTORE_IMPORT_RECEIPT_ITEMS', table_name: 'products',
        description: `Phục hồi liên kết SP-Phiếu nhập: matched=${matchResults.length}/${emptyReceipts.length}, updated=${updatedCount}`,
        new_data: { matched: matchResults.length, unmatched: unmatchedReceipts.length, updated: updatedCount, totalEmpty: emptyReceipts.length, totalOrphans: orphans.length },
      })
    }

    return new Response(JSON.stringify({
      dryRun,
      summary: {
        totalEmptyReceipts: emptyReceipts.length,
        totalOrphanProducts: orphans.length,
        matched: matchResults.length,
        unmatched: unmatchedReceipts.length,
        productsLinked: dryRun ? matchResults.reduce((s, m) => s + m.products.length, 0) : updatedCount,
      },
      matchDetails: matchResults.slice(0, 30),
      unmatchedDetails: unmatchedReceipts.slice(0, 30),
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Error:', error)
    return new Response(JSON.stringify({ error: 'Lỗi: ' + (error as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
