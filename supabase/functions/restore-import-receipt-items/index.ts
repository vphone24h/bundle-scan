import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface OrphanProduct {
  id: string
  imei: string | null
  name: string
  import_price: number
  supplier_id: string | null
  import_date: string | null
  branch_id: string | null
}

interface EmptyReceipt {
  id: string
  code: string
  import_date: string
  total_amount: number
  supplier_id: string | null
  branch_id: string | null
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

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Không thể xác thực' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body = await req.json()
    const tenantId = (body?.tenantId ?? '').trim()
    const dryRun = body?.dryRun !== false // default true = chỉ phân tích, không sửa

    if (!tenantId) {
      return new Response(JSON.stringify({ error: 'Thiếu tenantId' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Check permissions
    const { data: userRole } = await supabaseAdmin
      .from('user_roles')
      .select('user_role')
      .eq('user_id', user.id)
      .eq('tenant_id', tenantId)
      .maybeSingle()

    const { data: platformUser } = await supabaseAdmin
      .from('platform_users')
      .select('platform_role')
      .eq('user_id', user.id)
      .maybeSingle()

    const allowed = userRole?.user_role === 'super_admin' || platformUser?.platform_role === 'platform_admin'
    if (!allowed) {
      return new Response(JSON.stringify({ error: 'Chỉ Super Admin/Platform Admin mới có quyền' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Step 1: Find all empty import receipts (no products linked)
    const { data: allReceipts, error: rErr } = await supabaseAdmin
      .from('import_receipts')
      .select('id, code, import_date, total_amount, supplier_id, branch_id')
      .eq('tenant_id', tenantId)
      .eq('status', 'completed')

    if (rErr) throw rErr

    const emptyReceipts: EmptyReceipt[] = []
    for (const r of allReceipts ?? []) {
      const { count: pCount } = await supabaseAdmin
        .from('products')
        .select('id', { count: 'exact', head: true })
        .eq('import_receipt_id', r.id)

      const { count: piCount } = await supabaseAdmin
        .from('product_imports')
        .select('id', { count: 'exact', head: true })
        .eq('import_receipt_id', r.id)

      if ((pCount ?? 0) === 0 && (piCount ?? 0) === 0) {
        emptyReceipts.push(r as EmptyReceipt)
      }
    }

    // Step 2: Find orphan products (no import_receipt_id)
    const { data: orphanProducts, error: oErr } = await supabaseAdmin
      .from('products')
      .select('id, imei, name, import_price, supplier_id, import_date, branch_id')
      .eq('tenant_id', tenantId)
      .is('import_receipt_id', null)
      .neq('status', 'template')

    if (oErr) throw oErr

    const orphans = (orphanProducts ?? []) as OrphanProduct[]

    // Step 3: Try to match orphan products to empty receipts
    // Strategy: group orphans by supplier_id, then find subsets whose import_price sum = receipt total_amount
    // Since exact subset-sum is NP-hard, use heuristic: sort by price desc, greedy match

    const orphansBySupplier = new Map<string, OrphanProduct[]>()
    for (const o of orphans) {
      const key = o.supplier_id ?? '__none__'
      if (!orphansBySupplier.has(key)) orphansBySupplier.set(key, [])
      orphansBySupplier.get(key)!.push(o)
    }

    // Also group orphans without supplier (supplier was overwritten)
    const noSupplierOrphans = orphansBySupplier.get('__none__') ?? []

    const matched: { receiptCode: string; receiptId: string; products: { id: string; name: string; imei: string | null; import_price: number }[] }[] = []
    const unmatched: { receiptCode: string; receiptId: string; total_amount: number; supplier_id: string | null }[] = []
    const usedProductIds = new Set<string>()

    // Sort receipts by total_amount desc for better matching
    emptyReceipts.sort((a, b) => b.total_amount - a.total_amount)

    for (const receipt of emptyReceipts) {
      const candidatePools: OrphanProduct[][] = []

      // Pool 1: same supplier
      if (receipt.supplier_id) {
        const pool = orphansBySupplier.get(receipt.supplier_id)
        if (pool) candidatePools.push(pool)
      }

      // Pool 2: orphans without supplier (fallback)
      candidatePools.push(noSupplierOrphans)

      // Pool 3: all orphans from bulk clone (supplier_id = Anh Bình)
      // These had their supplier overwritten
      for (const [key, pool] of orphansBySupplier) {
        if (key !== receipt.supplier_id && key !== '__none__') {
          candidatePools.push(pool)
        }
      }

      let found = false
      for (const pool of candidatePools) {
        const available = pool
          .filter(p => !usedProductIds.has(p.id))
          .sort((a, b) => (b.import_price ?? 0) - (a.import_price ?? 0))

        // Greedy subset sum
        const selected: OrphanProduct[] = []
        let remaining = receipt.total_amount

        for (const p of available) {
          const price = p.import_price ?? 0
          if (price <= 0) continue
          if (price <= remaining + 1) { // 1đ tolerance
            selected.push(p)
            remaining -= price
          }
          if (Math.abs(remaining) <= 1) break
        }

        if (Math.abs(remaining) <= 1 && selected.length > 0) {
          // Match found!
          matched.push({
            receiptCode: receipt.code,
            receiptId: receipt.id,
            products: selected.map(p => ({
              id: p.id,
              name: p.name,
              imei: p.imei,
              import_price: p.import_price,
            })),
          })
          for (const p of selected) usedProductIds.add(p.id)
          found = true
          break
        }
      }

      if (!found) {
        unmatched.push({
          receiptCode: receipt.code,
          receiptId: receipt.id,
          total_amount: receipt.total_amount,
          supplier_id: receipt.supplier_id,
        })
      }
    }

    // Step 4: Apply changes if not dry run
    let updatedCount = 0
    if (!dryRun) {
      for (const m of matched) {
        for (const p of m.products) {
          const { error: upErr } = await supabaseAdmin
            .from('products')
            .update({ import_receipt_id: m.receiptId })
            .eq('id', p.id)
          if (upErr) {
            console.error(`Failed to update product ${p.id}:`, upErr)
          } else {
            updatedCount++
          }
        }
      }

      // Audit log
      await supabaseAdmin.from('audit_logs').insert({
        tenant_id: tenantId,
        user_id: user.id,
        action_type: 'RESTORE_IMPORT_RECEIPT_ITEMS',
        table_name: 'products',
        description: `Phục hồi liên kết sản phẩm cho phiếu nhập: matched=${matched.length}, unmatched=${unmatched.length}, products_updated=${updatedCount}`,
        new_data: {
          matched_receipts: matched.length,
          unmatched_receipts: unmatched.length,
          products_updated: updatedCount,
          total_empty_receipts: emptyReceipts.length,
          total_orphan_products: orphans.length,
        },
      })
    }

    return new Response(JSON.stringify({
      dryRun,
      summary: {
        totalEmptyReceipts: emptyReceipts.length,
        totalOrphanProducts: orphans.length,
        matchedReceipts: matched.length,
        unmatchedReceipts: unmatched.length,
        productsToUpdate: matched.reduce((s, m) => s + m.products.length, 0),
        productsUpdated: updatedCount,
      },
      matched: matched.slice(0, 20), // limit response size
      unmatched: unmatched.slice(0, 20),
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
