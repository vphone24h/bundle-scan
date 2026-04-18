import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as XLSX from "https://esm.sh/xlsx@0.18.5";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    const { tenantId, date, mode } = await req.json();

    if (!tenantId) {
      // Cron mode: backup all tenants
      const { data: tenants } = await admin.from("tenants").select("id");
      const results = [];
      for (const t of tenants || []) {
        try {
          const res = await runBackup(admin, t.id, date || todayStr(), "daily");
          results.push({ tenantId: t.id, ...res });
        } catch (e) {
          results.push({ tenantId: t.id, error: e.message });
        }
      }
      await cleanupExpired(admin);
      await cleanupStuck(admin);
      return new Response(JSON.stringify({ ok: true, results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const backupMode = mode || "daily";
    const result = await runBackup(admin, tenantId, date || todayStr(), backupMode);
    return new Response(JSON.stringify({ ok: true, ...result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Backup error:", err);
    return new Response(JSON.stringify({ ok: false, error: err.message }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function todayStr() {
  const now = new Date();
  now.setHours(now.getHours() + 7);
  return now.toISOString().split("T")[0];
}

async function cleanupExpired(admin: any) {
  const { data: expired } = await admin
    .from("daily_backups")
    .select("id, file_path, tenant_id")
    .lt("expires_at", new Date().toISOString())
    .not("file_path", "is", null);

  for (const b of expired || []) {
    await admin.storage.from("daily-backups").remove([b.file_path]);
    await admin.from("daily_backups").delete().eq("id", b.id);
  }
}

// Clean up stuck "processing" records older than 10 minutes
async function cleanupStuck(admin: any) {
  const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  await admin
    .from("daily_backups")
    .update({ status: "failed", error_message: "Timeout - tự động đánh dấu lỗi" })
    .eq("status", "processing")
    .lt("created_at", tenMinAgo);
}

// Fetch rows with a hard limit to prevent memory overflow
async function fetchRows(admin: any, baseQuery: () => any, maxRows = 1500): Promise<any[]> {
  const PAGE = 500;
  const all: any[] = [];
  let from = 0;
  while (all.length < maxRows) {
    const remaining = maxRows - all.length;
    const limit = Math.min(PAGE, remaining);
    const { data, error } = await baseQuery().range(from, from + limit - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < limit) break;
    from += limit;
  }
  return all;
}

// Fetch items in batches
async function fetchItemsBatched(admin: any, table: string, ids: string[], selectCols: string): Promise<Map<string, any[]>> {
  const map = new Map<string, any[]>();
  if (ids.length === 0) return map;
  for (let i = 0; i < ids.length; i += 200) {
    const chunk = ids.slice(i, i + 200);
    const { data } = await admin.from(table).select(selectCols).in("receipt_id", chunk);
    if (data) {
      for (const item of data) {
        const arr = map.get(item.receipt_id);
        if (arr) arr.push(item);
        else map.set(item.receipt_id, [item]);
      }
    }
  }
  return map;
}

// Fetch name maps in batches
async function fetchNameMap(admin: any, table: string, ids: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return map;
  for (let i = 0; i < unique.length; i += 200) {
    const chunk = unique.slice(i, i + 200);
    const { data } = await admin.from(table).select("id, name, phone").in("id", chunk);
    data?.forEach((c: any) => map.set(c.id, `${c.name || ""} - ${c.phone || ""}`));
  }
  return map;
}

async function runBackup(admin: any, tenantId: string, dateStr: string, mode: string) {
  const isFullBackup = mode === "full";
  const backupDate = dateStr;

  const { data: existing } = await admin
    .from("daily_backups")
    .select("id, status, file_path")
    .eq("tenant_id", tenantId)
    .eq("backup_date", backupDate)
    .eq("backup_type", isFullBackup ? "full" : "daily")
    .maybeSingle();

  if (existing?.status === "completed" && !isFullBackup) {
    return { status: "already_completed", id: existing.id };
  }

  // Clean up previous attempt
  if (existing) {
    if (existing.file_path) {
      await admin.storage.from("daily-backups").remove([existing.file_path]);
    }
    await admin.from("daily_backups").delete().eq("id", existing.id);
  }

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 60);

  const { data: insertedRow, error: insertErr } = await admin.from("daily_backups").insert({
    tenant_id: tenantId,
    backup_date: backupDate,
    status: "processing",
    expires_at: expiresAt.toISOString(),
    backup_type: isFullBackup ? "full" : "daily",
  }).select("id").single();

  if (insertErr) throw new Error(`Insert backup record failed: ${insertErr.message}`);
  if (!insertedRow) throw new Error("Insert backup record returned null");

  try {
    const tenantRes = await admin.from("tenants").select("name, subdomain").eq("id", tenantId).single();
    const tenantName = tenantRes.data?.name || tenantRes.data?.subdomain || "shop";

    let exports: any[], imports: any[], products: any[];

    if (isFullBackup) {
      // Full backup: limit to 1500 receipts each + 3000 products to avoid memory overflow
      [exports, imports, products] = await Promise.all([
        fetchRows(admin, () => admin.from("export_receipts")
          .select("id, code, export_date, total_amount, customer_id, note")
          .eq("tenant_id", tenantId)
          .eq("status", "completed")
          .order("export_date", { ascending: false }), 1500),
        fetchRows(admin, () => admin.from("import_receipts")
          .select("id, code, import_date, total_amount, supplier_id, note")
          .eq("tenant_id", tenantId)
          .eq("status", "completed")
          .order("import_date", { ascending: false }), 1500),
        fetchRows(admin, () => admin.from("products")
          .select("id, name, sku, import_price, sale_price")
          .eq("tenant_id", tenantId)
          .eq("status", "in_stock")
          .order("name"), 3000),
      ]);
    } else {
      const dayStart = `${dateStr}T00:00:00+07:00`;
      const dayEnd = `${dateStr}T23:59:59+07:00`;
      const [expRes, impRes, prodRes] = await Promise.all([
        admin.from("export_receipts")
          .select("id, code, export_date, total_amount, customer_id, note")
          .eq("tenant_id", tenantId)
          .gte("export_date", dayStart).lte("export_date", dayEnd)
          .eq("status", "completed").order("export_date").limit(1000),
        admin.from("import_receipts")
          .select("id, code, import_date, total_amount, supplier_id, note")
          .eq("tenant_id", tenantId)
          .gte("import_date", dayStart).lte("import_date", dayEnd)
          .eq("status", "completed").order("import_date").limit(1000),
        admin.from("products")
          .select("id, name, sku, import_price, sale_price")
          .eq("tenant_id", tenantId)
          .eq("status", "in_stock")
          .order("name").limit(3000),
      ]);
      exports = expRes.data || [];
      imports = impRes.data || [];
      products = prodRes.data || [];
    }

    // Fetch items and names
    const exportIds = exports.map((e: any) => e.id);
    const importIds = imports.map((e: any) => e.id);

    const [exportItemsMap, importItemsMap, customerMap, supplierMap] = await Promise.all([
      fetchItemsBatched(admin, "export_receipt_items", exportIds, "receipt_id, product_name, sku, imei, sale_price"),
      fetchItemsBatched(admin, "import_receipt_items", importIds, "receipt_id, product_name, sku, imei, import_price, quantity"),
      fetchNameMap(admin, "customers", exports.map((e: any) => e.customer_id)),
      fetchNameMap(admin, "suppliers", imports.map((e: any) => e.supplier_id)),
    ]);

    // Build workbook
    const wb = XLSX.utils.book_new();

    const totalSales = exports.reduce((s: number, e: any) => s + (e.total_amount || 0), 0);
    const totalImports = imports.reduce((s: number, e: any) => s + (e.total_amount || 0), 0);
    const totalInvValue = products.reduce((s: number, p: any) => s + (p.import_price || 0), 0);
    const totalInvSale = products.reduce((s: number, p: any) => s + (p.sale_price || 0), 0);

    // Sheet 1: Summary
    const wsSummary = XLSX.utils.aoa_to_sheet([
      [isFullBackup ? "BACKUP TOÀN BỘ DỮ LIỆU" : "BÁO CÁO BACKUP HÀNG NGÀY"],
      ["Cửa hàng:", tenantName],
      ["Ngày tạo:", dateStr],
      [""],
      ["CHỈ SỐ", "GIÁ TRỊ"],
      ["Số phiếu bán", exports.length],
      ["Tổng doanh thu", totalSales],
      ["Số phiếu nhập", imports.length],
      ["Tổng giá trị nhập", totalImports],
      ["Tồn kho (số SP)", products.length],
      ["Tổng giá vốn tồn kho", totalInvValue],
      ["Tổng giá bán tồn kho", totalInvSale],
    ]);
    wsSummary["!cols"] = [{ wch: 25 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, wsSummary, "Tổng quan");

    // Sheet 2: Sales by receipt
    const salesRows: any[][] = [["STT", "Mã phiếu", "Ngày", "Khách hàng", "Sản phẩm", "SKU", "IMEI", "Giá bán", "Tổng phiếu"]];
    let stt = 1;
    const salesProductAgg = new Map<string, { name: string; sku: string; qty: number; revenue: number; receipts: Set<string> }>();
    for (const ex of exports) {
      const items = exportItemsMap.get(ex.id);
      const cust = ex.customer_id ? customerMap.get(ex.customer_id) || "" : "";
      if (!items || items.length === 0) {
        salesRows.push([stt++, ex.code, ex.export_date, cust, "", "", "", "", ex.total_amount]);
      } else {
        for (const it of items) {
          salesRows.push([stt++, ex.code, ex.export_date, cust, it.product_name || "", it.sku || "", it.imei || "", it.sale_price || 0, ex.total_amount]);
          const key = `${it.product_name || ""}||${it.sku || ""}`;
          const ex_agg = salesProductAgg.get(key);
          const price = Number(it.sale_price) || 0;
          if (ex_agg) {
            ex_agg.qty += 1;
            ex_agg.revenue += price;
            ex_agg.receipts.add(ex.code);
          } else {
            salesProductAgg.set(key, { name: it.product_name || "", sku: it.sku || "", qty: 1, revenue: price, receipts: new Set([ex.code]) });
          }
        }
      }
    }
    const wsSales = XLSX.utils.aoa_to_sheet(salesRows);
    wsSales["!cols"] = [{ wch: 5 }, { wch: 18 }, { wch: 16 }, { wch: 22 }, { wch: 30 }, { wch: 12 }, { wch: 18 }, { wch: 12 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, wsSales, "Bán theo phiếu");

    // Sheet 3: Sales by product
    const salesProdRows: any[][] = [["STT", "Tên sản phẩm", "SKU", "Số lượng bán", "Tổng doanh thu", "Giá bán TB", "Số phiếu"]];
    const salesProdSorted = [...salesProductAgg.values()].sort((a, b) => b.revenue - a.revenue);
    salesProdSorted.forEach((p, idx) => {
      salesProdRows.push([idx + 1, p.name, p.sku, p.qty, p.revenue, p.qty > 0 ? Math.round(p.revenue / p.qty) : 0, p.receipts.size]);
    });
    const wsSalesProd = XLSX.utils.aoa_to_sheet(salesProdRows);
    wsSalesProd["!cols"] = [{ wch: 5 }, { wch: 35 }, { wch: 15 }, { wch: 12 }, { wch: 16 }, { wch: 14 }, { wch: 10 }];
    XLSX.utils.book_append_sheet(wb, wsSalesProd, "Bán theo sản phẩm");

    // Sheet 4: Imports by receipt
    const impRows: any[][] = [["STT", "Mã phiếu", "Ngày", "NCC", "Sản phẩm", "SKU", "IMEI", "Giá nhập", "SL", "Tổng phiếu"]];
    let stt2 = 1;
    const impProductAgg = new Map<string, { name: string; sku: string; qty: number; cost: number; receipts: Set<string> }>();
    for (const im of imports) {
      const items = importItemsMap.get(im.id);
      const supp = im.supplier_id ? supplierMap.get(im.supplier_id) || "" : "";
      if (!items || items.length === 0) {
        impRows.push([stt2++, im.code, im.import_date, supp, "", "", "", "", "", im.total_amount]);
      } else {
        for (const it of items) {
          const qty = Number(it.quantity) || 1;
          const price = Number(it.import_price) || 0;
          impRows.push([stt2++, im.code, im.import_date, supp, it.product_name || "", it.sku || "", it.imei || "", price, qty, im.total_amount]);
          const key = `${it.product_name || ""}||${it.sku || ""}`;
          const im_agg = impProductAgg.get(key);
          if (im_agg) {
            im_agg.qty += qty;
            im_agg.cost += price * qty;
            im_agg.receipts.add(im.code);
          } else {
            impProductAgg.set(key, { name: it.product_name || "", sku: it.sku || "", qty, cost: price * qty, receipts: new Set([im.code]) });
          }
        }
      }
    }
    const wsImp = XLSX.utils.aoa_to_sheet(impRows);
    wsImp["!cols"] = [{ wch: 5 }, { wch: 18 }, { wch: 16 }, { wch: 20 }, { wch: 30 }, { wch: 12 }, { wch: 18 }, { wch: 12 }, { wch: 5 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, wsImp, "Nhập theo phiếu");

    // Sheet 5: Imports by product
    const impProdRows: any[][] = [["STT", "Tên sản phẩm", "SKU", "Số lượng nhập", "Tổng giá trị nhập", "Giá nhập TB", "Số phiếu"]];
    const impProdSorted = [...impProductAgg.values()].sort((a, b) => b.cost - a.cost);
    impProdSorted.forEach((p, idx) => {
      impProdRows.push([idx + 1, p.name, p.sku, p.qty, p.cost, p.qty > 0 ? Math.round(p.cost / p.qty) : 0, p.receipts.size]);
    });
    const wsImpProd = XLSX.utils.aoa_to_sheet(impProdRows);
    wsImpProd["!cols"] = [{ wch: 5 }, { wch: 35 }, { wch: 15 }, { wch: 12 }, { wch: 18 }, { wch: 14 }, { wch: 10 }];
    XLSX.utils.book_append_sheet(wb, wsImpProd, "Nhập theo sản phẩm");

    // Sheet 4: Inventory
    const invRows: any[][] = [["STT", "Tên sản phẩm", "SKU", "Giá nhập", "Giá bán"]];
    products.forEach((p: any, idx: number) => {
      invRows.push([idx + 1, p.name || "", p.sku || "", p.import_price || 0, p.sale_price || 0]);
    });
    const wsInv = XLSX.utils.aoa_to_sheet(invRows);
    wsInv["!cols"] = [{ wch: 5 }, { wch: 35 }, { wch: 15 }, { wch: 12 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, wsInv, "Tồn kho");

    const xlsxBuffer = XLSX.write(wb, { type: "array", bookType: "xlsx" });
    const filePath = `${tenantId}/${backupDate}${isFullBackup ? '_full' : ''}.xlsx`;

    const { error: uploadErr } = await admin.storage
      .from("daily-backups")
      .upload(filePath, new Uint8Array(xlsxBuffer), {
        contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        upsert: true,
      });
    if (uploadErr) throw uploadErr;

    const stats = {
      exports: exports.length,
      imports: imports.length,
      inventory: products.length,
      totalSales,
      totalImports,
      inventoryValue: totalInvValue,
    };

    await admin
      .from("daily_backups")
      .update({
        status: "completed",
        file_path: filePath,
        file_size: xlsxBuffer.byteLength,
        stats,
        completed_at: new Date().toISOString(),
      })
      .eq("id", insertedRow.id);

    return { status: "completed", stats, filePath };
  } catch (err) {
    await admin
      .from("daily_backups")
      .update({ status: "failed", error_message: err.message })
      .eq("id", insertedRow.id);
    throw err;
  }
}
