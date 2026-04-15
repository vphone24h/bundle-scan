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
    // mode: "daily" (default, auto cron) or "full" (manual, all history)

    if (!tenantId) {
      // Cron mode: run daily for all tenants
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
      return new Response(JSON.stringify({ results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const backupMode = mode || "daily";
    const result = await runBackup(admin, tenantId, date || todayStr(), backupMode);
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Backup error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
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

async function fetchAllRows(admin: any, baseQuery: () => any) {
  const PAGE = 1000;
  let all: any[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await baseQuery().range(from, from + PAGE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

async function runBackup(admin: any, tenantId: string, dateStr: string, mode: string) {
  const isFullBackup = mode === "full";
  const backupDate = isFullBackup ? `${dateStr}_full` : dateStr;

  // Check if already done
  const { data: existing } = await admin
    .from("daily_backups")
    .select("id, status")
    .eq("tenant_id", tenantId)
    .eq("backup_date", backupDate)
    .maybeSingle();

  if (existing?.status === "completed" && !isFullBackup) {
    return { status: "already_completed", id: existing.id };
  }

  // For full backup, delete old record if exists to allow re-run
  if (existing && isFullBackup) {
    if (existing.status === "completed") {
      // Remove old file
      const { data: oldRecord } = await admin.from("daily_backups").select("file_path").eq("id", existing.id).single();
      if (oldRecord?.file_path) {
        await admin.storage.from("daily-backups").remove([oldRecord.file_path]);
      }
    }
    await admin.from("daily_backups").delete().eq("id", existing.id);
  }

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 60);

  const { data: insertedRow } = await admin.from("daily_backups").insert({
    tenant_id: tenantId,
    backup_date: backupDate,
    status: "processing",
    expires_at: expiresAt.toISOString(),
    backup_type: isFullBackup ? "full" : "daily",
  }).select("id").single();

  try {
    const tenantRes = await admin.from("tenants").select("name, subdomain").eq("id", tenantId).single();
    const tenantName = tenantRes.data?.name || tenantRes.data?.subdomain || "shop";

    let exports: any[], imports: any[], products: any[];
    let exportItems: any[] = [], importItems: any[] = [];

    if (isFullBackup) {
      // FULL mode: fetch ALL historical data with pagination
      const [expAll, impAll, prodAll] = await Promise.all([
        fetchAllRows(admin, () => admin.from("export_receipts")
          .select("id, code, export_date, total_amount, paid_amount, debt_amount, status, note, customer_id")
          .eq("tenant_id", tenantId)
          .eq("status", "completed")
          .order("export_date", { ascending: true })),
        fetchAllRows(admin, () => admin.from("import_receipts")
          .select("id, code, import_date, total_amount, paid_amount, debt_amount, status, note, supplier_id")
          .eq("tenant_id", tenantId)
          .eq("status", "completed")
          .order("import_date", { ascending: true })),
        fetchAllRows(admin, () => admin.from("products")
          .select("id, name, sku, import_price, sale_price, status, category_id")
          .eq("tenant_id", tenantId)
          .eq("status", "in_stock")
          .order("name")),
      ]);
      exports = expAll;
      imports = impAll;
      products = prodAll;
    } else {
      // DAILY mode: only today's data
      const dayStart = `${dateStr}T00:00:00+07:00`;
      const dayEnd = `${dateStr}T23:59:59+07:00`;

      const [expRes, impRes, prodRes] = await Promise.all([
        admin.from("export_receipts")
          .select("id, code, export_date, total_amount, paid_amount, debt_amount, status, note, customer_id")
          .eq("tenant_id", tenantId)
          .gte("export_date", dayStart).lte("export_date", dayEnd)
          .eq("status", "completed")
          .order("export_date", { ascending: true }).limit(1000),
        admin.from("import_receipts")
          .select("id, code, import_date, total_amount, paid_amount, debt_amount, status, note, supplier_id")
          .eq("tenant_id", tenantId)
          .gte("import_date", dayStart).lte("import_date", dayEnd)
          .eq("status", "completed")
          .order("import_date", { ascending: true }).limit(1000),
        admin.from("products")
          .select("id, name, sku, import_price, sale_price, status, category_id")
          .eq("tenant_id", tenantId)
          .eq("status", "in_stock")
          .order("name").limit(5000),
      ]);
      exports = expRes.data || [];
      imports = impRes.data || [];
      products = prodRes.data || [];
    }

    // Fetch export items
    const exportIds = exports.map((e: any) => e.id);
    for (let i = 0; i < exportIds.length; i += 200) {
      const chunk = exportIds.slice(i, i + 200);
      const { data } = await admin
        .from("export_receipt_items")
        .select("receipt_id, product_name, sku, imei, sale_price, warranty, note")
        .in("receipt_id", chunk);
      if (data) exportItems.push(...data);
    }

    // Fetch import items
    const importIds = imports.map((e: any) => e.id);
    for (let i = 0; i < importIds.length; i += 200) {
      const chunk = importIds.slice(i, i + 200);
      const { data } = await admin
        .from("import_receipt_items")
        .select("receipt_id, product_name, sku, imei, import_price, quantity")
        .in("receipt_id", chunk);
      if (data) importItems.push(...data);
    }

    // Fetch customer names
    const customerIds = [...new Set(exports.map((e: any) => e.customer_id).filter(Boolean))];
    const customerMap = new Map<string, string>();
    for (let i = 0; i < customerIds.length; i += 200) {
      const chunk = customerIds.slice(i, i + 200);
      const { data } = await admin.from("customers").select("id, name, phone").in("id", chunk);
      data?.forEach((c: any) => customerMap.set(c.id, `${c.name || ""} - ${c.phone || ""}`));
    }

    // Fetch supplier names (for full backup)
    const supplierIds = [...new Set(imports.map((e: any) => e.supplier_id).filter(Boolean))];
    const supplierMap = new Map<string, string>();
    for (let i = 0; i < supplierIds.length; i += 200) {
      const chunk = supplierIds.slice(i, i + 200);
      const { data } = await admin.from("suppliers").select("id, name, phone").in("id", chunk);
      data?.forEach((s: any) => supplierMap.set(s.id, `${s.name || ""} - ${s.phone || ""}`));
    }

    // Build Excel workbook
    const wb = XLSX.utils.book_new();

    const totalSales = exports.reduce((s: number, e: any) => s + (e.total_amount || 0), 0);
    const totalImports = imports.reduce((s: number, e: any) => s + (e.total_amount || 0), 0);
    const totalInventoryValue = products.reduce((s: number, p: any) => s + (p.import_price || 0), 0);
    const totalInventorySaleValue = products.reduce((s: number, p: any) => s + (p.sale_price || 0), 0);

    // Sheet 1: Tổng quan
    const summaryData = [
      [isFullBackup ? "BACKUP TOÀN BỘ DỮ LIỆU" : "BÁO CÁO BACKUP HÀNG NGÀY", "", "", ""],
      ["Cửa hàng:", tenantName, "", ""],
      ["Ngày tạo:", dateStr, "", ""],
      [isFullBackup ? "Loại: Toàn bộ lịch sử" : "Loại: Trong ngày", "", "", ""],
      ["", "", "", ""],
      ["CHỈ SỐ", "GIÁ TRỊ", "", ""],
      ["Số phiếu bán", exports.length, "", ""],
      ["Tổng doanh thu", totalSales, "", ""],
      ["Số phiếu nhập", imports.length, "", ""],
      ["Tổng giá trị nhập", totalImports, "", ""],
      ["Tồn kho (số SP)", products.length, "", ""],
      ["Tổng giá vốn tồn kho", totalInventoryValue, "", ""],
      ["Tổng giá bán tồn kho", totalInventorySaleValue, "", ""],
    ];
    const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
    wsSummary["!cols"] = [{ wch: 25 }, { wch: 20 }, { wch: 15 }, { wch: 15 }];
    XLSX.utils.book_append_sheet(wb, wsSummary, "Tổng quan");

    // Sheet 2: Bán hàng
    const salesHeader = ["STT", "Mã phiếu", "Ngày", "Khách hàng", "Sản phẩm", "SKU", "IMEI", "Giá bán", "Tổng phiếu", "Ghi chú"];
    const salesRows: any[][] = [salesHeader];
    let stt = 1;
    for (const ex of exports) {
      const items = exportItems.filter((i: any) => i.receipt_id === ex.id);
      const custName = ex.customer_id ? customerMap.get(ex.customer_id) || "" : "";
      if (items.length === 0) {
        salesRows.push([stt++, ex.code, ex.export_date, custName, "", "", "", "", ex.total_amount, ex.note || ""]);
      } else {
        for (const item of items) {
          salesRows.push([stt++, ex.code, ex.export_date, custName, item.product_name || "", item.sku || "", item.imei || "", item.sale_price || 0, ex.total_amount, ex.note || ""]);
        }
      }
    }
    const wsSales = XLSX.utils.aoa_to_sheet(salesRows);
    wsSales["!cols"] = [{ wch: 5 }, { wch: 20 }, { wch: 18 }, { wch: 25 }, { wch: 35 }, { wch: 12 }, { wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, wsSales, "Bán hàng");

    // Sheet 3: Nhập hàng
    const importHeader = ["STT", "Mã phiếu", "Ngày", "NCC", "Sản phẩm", "SKU", "IMEI", "Giá nhập", "SL", "Tổng phiếu", "Ghi chú"];
    const importRows: any[][] = [importHeader];
    let stt2 = 1;
    for (const im of imports) {
      const items = importItems.filter((i: any) => i.receipt_id === im.id);
      const suppName = im.supplier_id ? supplierMap.get(im.supplier_id) || "" : "";
      if (items.length === 0) {
        importRows.push([stt2++, im.code, im.import_date, suppName, "", "", "", "", "", im.total_amount, im.note || ""]);
      } else {
        for (const item of items) {
          importRows.push([stt2++, im.code, im.import_date, suppName, item.product_name || "", item.sku || "", item.imei || "", item.import_price || 0, item.quantity || 1, im.total_amount, im.note || ""]);
        }
      }
    }
    const wsImport = XLSX.utils.aoa_to_sheet(importRows);
    wsImport["!cols"] = [{ wch: 5 }, { wch: 20 }, { wch: 18 }, { wch: 20 }, { wch: 35 }, { wch: 12 }, { wch: 18 }, { wch: 14 }, { wch: 5 }, { wch: 14 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, wsImport, "Nhập hàng");

    // Sheet 4: Tồn kho
    const invHeader = ["STT", "Tên sản phẩm", "SKU", "Giá nhập", "Giá bán"];
    const invRows: any[][] = [invHeader];
    products.forEach((p: any, idx: number) => {
      invRows.push([idx + 1, p.name || "", p.sku || "", p.import_price || 0, p.sale_price || 0]);
    });
    const wsInv = XLSX.utils.aoa_to_sheet(invRows);
    wsInv["!cols"] = [{ wch: 5 }, { wch: 40 }, { wch: 15 }, { wch: 14 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, wsInv, "Tồn kho");

    // Generate Excel buffer
    const xlsxBuffer = XLSX.write(wb, { type: "array", bookType: "xlsx" });
    const filePath = `${tenantId}/${backupDate}.xlsx`;

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
      inventoryValue: totalInventoryValue,
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
      .eq("tenant_id", tenantId)
      .eq("backup_date", backupDate);
    throw err;
  }
}
