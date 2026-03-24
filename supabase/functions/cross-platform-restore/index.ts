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

    // Get tenant
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

    // Check admin role
    const { data: roleData } = await adminClient
      .from('user_roles')
      .select('user_role')
      .eq('user_id', user.id)
      .single()

    if (!roleData || roleData.user_role !== 'super_admin') {
      return new Response(JSON.stringify({ error: 'Forbidden: Super Admin only' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const tenantId = tenantData.tenant_id
    const body = await req.json()
    const { importData, mode } = body // mode: 'merge' | 'overwrite'

    if (!importData || !importData.version) {
      return new Response(JSON.stringify({ error: 'File JSON không hợp lệ hoặc thiếu version' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (importData.version !== '1.0') {
      return new Response(JSON.stringify({ error: `Version "${importData.version}" không được hỗ trợ. Chỉ hỗ trợ version 1.0` }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const results: Record<string, number> = {}
    const errors: string[] = []

    // ID mapping: external_id → new database UUID
    const branchMap: Record<string, string> = {}
    const categoryMap: Record<string, string> = {}
    const supplierMap: Record<string, string> = {}
    const customerMap: Record<string, string> = {}
    const productMap: Record<string, string> = {}
    const importReceiptMap: Record<string, string> = {}
    const exportReceiptMap: Record<string, string> = {}

    // Helper
    const mapRef = (extId: string | null, map: Record<string, string>) => extId ? (map[extId] || null) : null

    try {
      // 1. Branches
      if (importData.branches?.length > 0) {
        for (const b of importData.branches) {
          const { data, error } = await adminClient.from('branches').insert({
            tenant_id: tenantId,
            name: b.name,
            address: b.address,
            phone: b.phone,
            is_default: b.is_default,
            note: b.note,
          }).select('id').single()

          if (error) {
            errors.push(`Branch "${b.name}": ${error.message}`)
          } else if (data) {
            branchMap[b.external_id] = data.id
          }
        }
        results.branches = Object.keys(branchMap).length
      }

      // 2. Categories
      if (importData.categories?.length > 0) {
        // First pass: insert categories without parent
        const withParent: any[] = []
        for (const c of importData.categories) {
          if (c.parent_external_id) {
            withParent.push(c)
            continue
          }
          const { data, error } = await adminClient.from('categories').insert({
            tenant_id: tenantId,
            name: c.name,
          }).select('id').single()

          if (error) {
            errors.push(`Category "${c.name}": ${error.message}`)
          } else if (data) {
            categoryMap[c.external_id] = data.id
          }
        }
        // Second pass: insert categories with parent
        for (const c of withParent) {
          const { data, error } = await adminClient.from('categories').insert({
            tenant_id: tenantId,
            name: c.name,
            parent_id: mapRef(c.parent_external_id, categoryMap),
          }).select('id').single()

          if (error) {
            errors.push(`Category "${c.name}": ${error.message}`)
          } else if (data) {
            categoryMap[c.external_id] = data.id
          }
        }
        results.categories = Object.keys(categoryMap).length
      }

      // 3. Suppliers
      if (importData.suppliers?.length > 0) {
        for (const s of importData.suppliers) {
          const { data, error } = await adminClient.from('suppliers').insert({
            tenant_id: tenantId,
            name: s.name,
            phone: s.phone,
            email: s.email,
            address: s.address,
            tax_code: s.tax_code,
            debt_amount: s.debt_amount || 0,
            note: s.note,
            entity_code: s.entity_code,
          }).select('id').single()

          if (error) {
            errors.push(`Supplier "${s.name}": ${error.message}`)
          } else if (data) {
            supplierMap[s.external_id] = data.id
          }
        }
        results.suppliers = Object.keys(supplierMap).length
      }

      // 4. Customers
      if (importData.customers?.length > 0) {
        for (const c of importData.customers) {
          const { data, error } = await adminClient.from('customers').insert({
            tenant_id: tenantId,
            name: c.name,
            phone: c.phone,
            email: c.email,
            address: c.address,
            birthday: c.birthday,
            entity_code: c.entity_code,
            source: c.source,
            note: c.note,
            total_spent: c.total_spent || 0,
            current_points: c.current_points || 0,
            pending_points: c.pending_points || 0,
            total_points_earned: c.total_points_earned || 0,
            total_points_used: c.total_points_used || 0,
            membership_tier: c.membership_tier || 'regular',
            status: c.status || 'active',
            debt_due_days: c.debt_due_days,
            last_purchase_date: c.last_purchase_date,
            preferred_branch_id: mapRef(c.preferred_branch_external_id, branchMap),
          }).select('id').single()

          if (error) {
            errors.push(`Customer "${c.name}": ${error.message}`)
          } else if (data) {
            customerMap[c.external_id] = data.id
          }
        }
        results.customers = Object.keys(customerMap).length
      }

      // 5. Products
      if (importData.products?.length > 0) {
        for (const p of importData.products) {
          const { data, error } = await adminClient.from('products').insert({
            tenant_id: tenantId,
            name: p.name,
            sku: p.sku,
            imei: p.imei,
            barcode: p.barcode,
            import_price: p.import_price,
            sale_price: p.sale_price,
            quantity: p.quantity || 1,
            status: p.status || 'in_stock',
            warranty: p.warranty,
            warranty_package: p.warranty_package,
            warranty_start_date: p.warranty_start_date,
            warranty_end_date: p.warranty_end_date,
            note: p.note,
            image_url: p.image_url,
            supplier_name: p.supplier_name,
            supplier_id: mapRef(p.supplier_external_id, supplierMap),
            category_id: mapRef(p.category_external_id, categoryMap),
            branch_id: mapRef(p.branch_external_id, branchMap),
            group_id: p.group_id,
            version_name: p.version_name,
            version_value: p.version_value,
            color: p.color,
          }).select('id').single()

          if (error) {
            errors.push(`Product "${p.name}": ${error.message}`)
          } else if (data) {
            productMap[p.external_id] = data.id
          }
        }
        results.products = Object.keys(productMap).length
      }

      // 6. Import receipts
      if (importData.import_receipts?.length > 0) {
        for (const r of importData.import_receipts) {
          const { data, error } = await adminClient.from('import_receipts').insert({
            tenant_id: tenantId,
            code: r.code,
            supplier_id: mapRef(r.supplier_external_id, supplierMap),
            branch_id: mapRef(r.branch_external_id, branchMap),
            total_amount: r.total_amount,
            paid_amount: r.paid_amount,
            payment_source: r.payment_source,
            import_date: r.import_date,
            note: r.note,
            status: r.status || 'completed',
          }).select('id').single()

          if (error) {
            errors.push(`Import receipt "${r.code}": ${error.message}`)
          } else if (data) {
            importReceiptMap[r.external_id] = data.id
          }
        }
        results.import_receipts = Object.keys(importReceiptMap).length
      }

      // 7. Export receipts
      if (importData.export_receipts?.length > 0) {
        for (const r of importData.export_receipts) {
          const { data, error } = await adminClient.from('export_receipts').insert({
            tenant_id: tenantId,
            code: r.code,
            customer_id: mapRef(r.customer_external_id, customerMap),
            branch_id: mapRef(r.branch_external_id, branchMap),
            total_amount: r.total_amount,
            paid_amount: r.paid_amount,
            discount_amount: r.discount_amount,
            voucher_discount: r.voucher_discount,
            points_discount: r.points_discount,
            payment_source: r.payment_source,
            export_date: r.export_date,
            note: r.note,
            status: r.status || 'completed',
            customer_name: r.customer_name,
            customer_phone: r.customer_phone,
            created_by_name: r.created_by_name,
          }).select('id').single()

          if (error) {
            errors.push(`Export receipt "${r.code}": ${error.message}`)
          } else if (data) {
            exportReceiptMap[r.external_id] = data.id
          }
        }
        results.export_receipts = Object.keys(exportReceiptMap).length
      }

      // 8. Export receipt items
      if (importData.export_receipt_items?.length > 0) {
        let itemCount = 0
        for (const item of importData.export_receipt_items) {
          const receiptId = mapRef(item.receipt_external_id, exportReceiptMap)
          if (!receiptId) continue

          const { error } = await adminClient.from('export_receipt_items').insert({
            receipt_id: receiptId,
            product_id: mapRef(item.product_external_id, productMap),
            product_name: item.product_name,
            imei: item.imei,
            quantity: item.quantity,
            unit_price: item.unit_price,
            total_price: item.total_price,
            warranty: item.warranty,
            warranty_package: item.warranty_package,
          })

          if (error) {
            errors.push(`Export item: ${error.message}`)
          } else {
            itemCount++
          }
        }
        results.export_receipt_items = itemCount
      }

      // 9. Export receipt payments
      if (importData.export_receipt_payments?.length > 0) {
        let paymentCount = 0
        for (const p of importData.export_receipt_payments) {
          const receiptId = mapRef(p.receipt_external_id, exportReceiptMap)
          if (!receiptId) continue

          const { error } = await adminClient.from('export_receipt_payments').insert({
            receipt_id: receiptId,
            amount: p.amount,
            payment_source: p.payment_source,
            payment_date: p.payment_date,
            note: p.note,
          })

          if (error) {
            errors.push(`Payment: ${error.message}`)
          } else {
            paymentCount++
          }
        }
        results.export_receipt_payments = paymentCount
      }

      // 10. Cash book
      if (importData.cash_book?.length > 0) {
        let cbCount = 0
        for (const cb of importData.cash_book) {
          const { error } = await adminClient.from('cash_book').insert({
            tenant_id: tenantId,
            type: cb.type,
            category: cb.category,
            description: cb.description,
            amount: cb.amount,
            payment_source: cb.payment_source,
            transaction_date: cb.transaction_date,
            note: cb.note,
            recipient_name: cb.recipient_name,
            recipient_phone: cb.recipient_phone,
            reference_type: cb.reference_type,
            is_business_accounting: cb.is_business_accounting,
            branch_id: mapRef(cb.branch_external_id, branchMap),
            created_by_name: cb.created_by_name,
          })

          if (error) {
            errors.push(`Cash book: ${error.message}`)
          } else {
            cbCount++
          }
        }
        results.cash_book = cbCount
      }

      // 11. Debt payments
      if (importData.debt_payments?.length > 0) {
        let dpCount = 0
        for (const dp of importData.debt_payments) {
          const { error } = await adminClient.from('debt_payments').insert({
            tenant_id: tenantId,
            entity_id: dp.entity_id,
            entity_type: dp.entity_type,
            payment_type: dp.payment_type,
            amount: dp.amount,
            allocated_amount: dp.allocated_amount,
            balance_after: dp.balance_after,
            description: dp.description,
            payment_source: dp.payment_source,
            branch_id: mapRef(dp.branch_external_id, branchMap),
          })

          if (error) {
            errors.push(`Debt payment: ${error.message}`)
          } else {
            dpCount++
          }
        }
        results.debt_payments = dpCount
      }

      // 12. Web config
      if (importData.web_config) {
        const wc = importData.web_config
        const { error } = await adminClient.from('tenant_landing_settings').upsert({
          tenant_id: tenantId,
          store_name: wc.store_name,
          store_description: wc.store_description,
          store_phone: wc.store_phone,
          store_email: wc.store_email,
          store_address: wc.store_address,
          additional_addresses: wc.additional_addresses,
          logo_url: wc.logo_url,
          banner_url: wc.banner_url,
          primary_color: wc.primary_color,
          secondary_color: wc.secondary_color,
          facebook_url: wc.facebook_url,
          zalo_url: wc.zalo_url,
          youtube_url: wc.youtube_url,
          tiktok_url: wc.tiktok_url,
        }, { onConflict: 'tenant_id' })

        if (error) {
          errors.push(`Web config: ${error.message}`)
        } else {
          results.web_config = 1
        }
      }

    } catch (e) {
      errors.push(`Fatal: ${(e as Error).message}`)
    }

    // Log
    await adminClient.from('audit_logs').insert({
      tenant_id: tenantId,
      user_id: user.id,
      action_type: 'CROSS_PLATFORM_IMPORT',
      table_name: 'ALL',
      description: `Import cross-platform JSON v1.0 (mode: ${mode || 'merge'})`,
    })

    return new Response(JSON.stringify({
      success: true,
      results,
      errors: errors.length > 0 ? errors.slice(0, 20) : [],
      total_errors: errors.length,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('Cross-platform import error:', error)
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
