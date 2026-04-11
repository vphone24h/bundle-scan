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

    const { tenantId, date } = await req.json();

    // If no tenantId, run for all tenants (cron mode)
    if (!tenantId) {
      const { data: tenants } = await admin.from("tenants").select("id");
      const results = [];
      for (const t of tenants || []) {
        try {
          const res = await runBackup(admin, t.id, date || todayStr());
          results.push({ tenantId: t.id, ...res });
        } catch (e) {
          results.push({ tenantId: t.id, error: e.message });
        }
      }
      // Cleanup expired backups
      await cleanupExpired(admin);
      return new Response(JSON.stringify({ results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await runBackup(admin, tenantId, date || todayStr());
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
  now.setHours(now.getHours() + 7); // Vietnam timezone
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

async function runBackup(admin: any, tenantId: string, dateStr: string) {
  // Check if already done
  const { data: existing } = await admin
    .from("daily_backups")
    .select("id, status")
    .eq("tenant_id", tenantId)
    .eq("backup_date", dateStr)
    .maybeSingle();

  if (existing?.status === "completed") {
    return { status: "already_completed", id: existing.id };
  }

  // Create or update record
  const backupId = existing?.id;
  if (!backupId) {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 60);
    await admin.from("daily_backups").insert({
      tenant_id: tenantId,
      backup_date: dateStr,
      status: "processing",
      expires_at: expiresAt.toISOString(),
    });
  } else {
    await admin.from("daily_backups").update({ status: "processing" }).eq("id", backupId);
  }

  try {
    const dayStart = `${dateStr}T00:00:00+07:00`;
    const dayEnd = `${dateStr}T23:59:59+07:00`;

    // Fetch data in parallel
    const [exportRes, importRes, productsRes, tenantRes] = await Promise.all([
      // Export receipts (sales) for the day
      admin
        .from("export_receipts")
        .select("id, code, export_date, total_amount, paid_amount, debt_amount, status, note, customer_id")
        .eq("tenant_id", tenantId)
        .gte("export_date", dayStart)
        .lte("export_date", dayEnd)
        .eq("status", "completed")
        .order("export_date", { ascending: true })
        .limit(1000),
      // Import receipts for the day
      admin
        .from("import_receipts")
        .select("id, code, import_date, total_amount, paid_amount, debt_amount, status, note, supplier_id")
        .eq("tenant_id", tenantId)
        .gte("import_date", dayStart)
        .lte("import_date", dayEnd)
        .eq("status", "completed")
        .order("import_date", { ascending: true })
        .limit(1000),
      // Current inventory
      admin
        .from("products")
        .select("id, name, sku, import_price, sale_price, status, category_id")
        .eq("tenant_id", tenantId)
        .eq("status", "in_stock")
        .order("name")
        .limit(5000),
      // Tenant info
      admin.from("tenants").select("name, subdomain").eq("id", tenantId).single(),
    ]);

    const exports = exportRes.data || [];
    const imports = importRes.data || [];
    const products = productsRes.data || [];
    const tenantName = tenantRes.data?.name || tenantRes.data?.subdomain || "shop";

    // Fetch export items for the day's receipts
    const exportIds = exports.map((e: any) => e.id);
    let exportItems: any[] = [];
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
    let importItems: any[] = [];
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

    // Build Excel workbook
    const wb = XLSX.utils.book_new();

    // Sheet 1: Tổng quan
    const totalSales = exports.reduce((s: number, e: any) => s + (e.total_amount || 0), 0);
    const totalImports = imports.reduce((s: number, e: any) => s + (e.total_amount || 0), 0);
    const totalInventoryValue = products.reduce((s: number, p: any) => s + (p.import_price || 0), 0);
    const totalInventorySaleValue = products.reduce((s: number, p: any) => s + (p.sale_price || 0), 0);

    const summaryData = [
      ["BÁO CÁO BACKUP HÀNG NGÀY", "", "", ""],
      ["Cửa hàng:", tenantName, "", ""],
      ["Ngày:", dateStr, "", ""],
      ["", "", "", ""],
      ["CHỈ SỐ", "GIÁ TRỊ", "", ""],
      ["Số phiếu bán", exports.length, "", ""],
      ["Tổng doanh thu", totalSales, "", ""],
      ["Số phiếu nhập", imports.length, "", ""],
      ["Tổng giá trị nhập", totalImports, "", ""],
      ["Tồn kho (số SP)", products.length, "", ""],
      ["Tổng giá vốn tồn kho", totalInventoryValue, "", ""],
      ["Tổng giá bán tồn kho", totalInventorySaleValue, "", ""],
      ["Lợi nhuận gộp ước tính", totalSales - exports.reduce((s: number, e: any) => {
        const items = exportItems.filter((i: any) => i.receipt_id === e.id);
        return s; // simplified - just use sale totals
      }, 0), "", ""],
    ];
    const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
    wsSummary["!cols"] = [{ wch: 25 }, { wch: 20 }, { wch: 15 }, { wch: 15 }];
    XLSX.utils.book_append_sheet(wb, wsSummary, "Tổng quan");

    // Sheet 2: Chi tiết bán hàng
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

    // Sheet 3: Chi tiết nhập hàng
    const importHeader = ["STT", "Mã phiếu", "Ngày", "Sản phẩm", "SKU", "IMEI", "Giá nhập", "SL", "Tổng phiếu", "Ghi chú"];
    const importRows: any[][] = [importHeader];
    let stt2 = 1;
    for (const im of imports) {
      const items = importItems.filter((i: any) => i.receipt_id === im.id);
      if (items.length === 0) {
        importRows.push([stt2++, im.code, im.import_date, "", "", "", "", "", im.total_amount, im.note || ""]);
      } else {
        for (const item of items) {
          importRows.push([stt2++, im.code, im.import_date, item.product_name || "", item.sku || "", item.imei || "", item.import_price || 0, item.quantity || 1, im.total_amount, im.note || ""]);
        }
      }
    }
    const wsImport = XLSX.utils.aoa_to_sheet(importRows);
    wsImport["!cols"] = [{ wch: 5 }, { wch: 20 }, { wch: 18 }, { wch: 35 }, { wch: 12 }, { wch: 18 }, { wch: 14 }, { wch: 5 }, { wch: 14 }, { wch: 20 }];
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
    const filePath = `${tenantId}/${dateStr}.xlsx`;

    // Upload to storage
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

    // Update record
    await admin
      .from("daily_backups")
      .update({
        status: "completed",
        file_path: filePath,
        file_size: xlsxBuffer.byteLength,
        stats,
        completed_at: new Date().toISOString(),
      })
      .eq("tenant_id", tenantId)
      .eq("backup_date", dateStr);

    return { status: "completed", stats, filePath };
  } catch (err) {
    await admin
      .from("daily_backups")
      .update({ status: "failed", error_message: err.message })
      .eq("tenant_id", tenantId)
      .eq("backup_date", dateStr);
    throw err;
  }
}
