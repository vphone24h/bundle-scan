import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as XLSX from "https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function parseDate(dateStr: string): string {
  try {
    const parts = dateStr.split("/");
    if (parts.length === 3) {
      return `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}T12:00:00+07:00`;
    }
  } catch {}
  return new Date().toISOString();
}

function cleanImei(raw: string | null | undefined): string | null {
  const v = raw?.trim() || null;
  if (!v || v === "-" || v === "empty" || v.startsWith("empty")) return null;
  return v;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceKey);

    const { storagePath, tenantId, sourceId = "backup", dryRun = false } = await req.json();

    if (!storagePath || !tenantId) {
      return new Response(JSON.stringify({ error: "Missing storagePath or tenantId" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Download file from storage
    const { data: fileData, error: dlErr } = await adminClient.storage
      .from("temp-imports")
      .download(storagePath);

    if (dlErr || !fileData) {
      return new Response(JSON.stringify({ error: "File not found: " + dlErr?.message }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const buffer = await fileData.arrayBuffer();
    const workbook = XLSX.read(new Uint8Array(buffer), { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rawData: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

    // Detect header row
    const startRow = rawData.length > 0 && typeof rawData[0][4] !== "number" ? 1 : 0;

    // Debug: log first 3 data rows to see column structure
    const debugRows = [];
    for (let i = startRow; i < Math.min(startRow + 3, rawData.length); i++) {
      const row = rawData[i];
      debugRows.push({
        row_index: i,
        col_count: row?.length,
        col0: String(row?.[0] || "").substring(0, 50),
        col1: String(row?.[1] || "").substring(0, 50),
        col2: String(row?.[2] || "").substring(0, 50),
        col3: String(row?.[3] || "").substring(0, 50),
        col4_raw: row?.[4],
        col4_type: typeof row?.[4],
        col5: String(row?.[5] || "").substring(0, 50),
        col6: String(row?.[6] || "").substring(0, 50),
        col7: String(row?.[7] || "").substring(0, 50),
      });
    }

    // Parse all rows
    interface ParsedOrder {
      orderId: string;
      imei: string;
      customerName: string;
      customerPhone: string;
      customerEmail: string;
      customerAddress: string;
      productName: string;
      productVariant: string;
      salePrice: number;
      note: string;
      orderDate: string;
      status: string;
      warranty: string;
    }

    const orders: ParsedOrder[] = [];
    for (let i = startRow; i < rawData.length; i++) {
      const row = rawData[i];
      if (!row || row.length < 7) continue;

      try {
        const col0 = String(row[0] || "");
        const lines0 = col0.split("\n").map((l: string) => l.trim());
        const orderId = lines0[0] || "";
        if (!orderId) continue;

        let imei = "";
        for (const line of lines0) {
          const match = line.match(/^IMEI:\s*(.*)$/i);
          if (match) { imei = match[1].trim(); break; }
        }

        const col1 = String(row[1] || "");
        const lines1 = col1.split("\n").map((l: string) => l.trim());
        const customerName = lines1[0] || "Khách lẻ";
        let customerPhone = "", customerEmail = "", customerAddress = "";
        for (const line of lines1) {
          if (/^0\d{8,10}$/.test(line.replace(/\s/g, ""))) customerPhone = line.replace(/\s/g, "");
          else if (line.includes("@")) customerEmail = line;
        }
        for (let j = lines1.length - 1; j >= 1; j--) {
          const l = lines1[j];
          if (l && l !== customerPhone && !l.includes("@") && !/^0\d{8,10}$/.test(l.replace(/\s/g, ""))) {
            customerAddress = l; break;
          }
        }

        const col2 = String(row[2] || "");
        const lines2 = col2.split("\n").map((l: string) => l.trim());
        const productName = lines2[0] || "Sản phẩm";
        const productVariant = lines2[1] || "";
        let note = "", warranty = "";
        for (const line of lines2) {
          const noteMatch = line.match(/^Ghi chú:\s*(.*)$/i);
          if (noteMatch) note = noteMatch[1].trim();
          const wMatch = line.match(/^Gói bảo hành:\s*(.*)$/i);
          if (wMatch) warranty = wMatch[1].trim();
        }

        // Try ALL numeric columns to find the price
        let salePrice = 0;
        // Try col4 (E) first, then col3 (D), then col5 (F)
        for (const colIdx of [4, 3, 5]) {
          const val = row[colIdx];
          if (typeof val === "number" && val > 0) {
            salePrice = val;
            break;
          } else if (val) {
            const parsed = parseInt(String(val).replace(/[^\d]/g, ""));
            if (parsed > 0) { salePrice = parsed; break; }
          }
        }

        const col6 = String(row[6] || "");
        const lines6 = col6.split("\n").map((l: string) => l.trim());
        let orderDate = "";
        for (const line of lines6) {
          const dateMatch = line.match(/(\d{1,2}\/\d{1,2}\/\d{4})/);
          if (dateMatch) { orderDate = dateMatch[1]; break; }
        }

        const status = String(row[7] || "").trim();

        orders.push({
          orderId, imei, customerName, customerPhone, customerEmail, customerAddress,
          productName: productName + (productVariant ? ` - ${productVariant}` : ""),
          productVariant, salePrice, note, orderDate, status,
          warranty: warranty === "N/A" ? "" : warranty,
        });
      } catch { continue; }
    }

    const completedOrders = orders.filter(
      (o) => o.status === "Hoàn tất" || o.status === "Đã giao hàng"
    );

    const priceStats = {
      total: completedOrders.length,
      withPrice: completedOrders.filter(o => o.salePrice > 0).length,
      withoutPrice: completedOrders.filter(o => o.salePrice === 0).length,
      samplePrices: completedOrders.slice(0, 5).map(o => ({ id: o.orderId, price: o.salePrice, product: o.productName.substring(0, 40) })),
    };

    if (dryRun) {
      return new Response(JSON.stringify({
        dryRun: true,
        totalRows: rawData.length - startRow,
        parsedOrders: orders.length,
        completedOrders: completedOrders.length,
        priceStats,
        debugRows,
      }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- ACTUAL IMPORT ---
    // Get default branch
    const { data: branches } = await adminClient
      .from("branches").select("id").eq("tenant_id", tenantId).eq("is_default", true).limit(1);
    const defaultBranchId = branches?.[0]?.id || null;

    // Check existing codes
    const allCodes = completedOrders.map(o => `${sourceId.toUpperCase()}-${o.orderId.slice(-8)}`);
    const existingCodesSet = new Set<string>();
    for (let i = 0; i < allCodes.length; i += 500) {
      const chunk = allCodes.slice(i, i + 500);
      const { data: existing } = await adminClient
        .from("export_receipts").select("code").eq("tenant_id", tenantId).in("code", chunk);
      existing?.forEach((r: any) => existingCodesSet.add(r.code));
    }

    // Batch upsert customers
    const phoneMap = new Map<string, any>();
    for (const o of completedOrders) {
      if (o.customerPhone?.length >= 9) {
        const cleaned = o.customerPhone.replace(/\s+/g, "");
        if (!phoneMap.has(cleaned)) {
          phoneMap.set(cleaned, { name: o.customerName || "Khách lẻ", email: o.customerEmail || "", address: o.customerAddress || "", phone: cleaned });
        }
      }
    }

    const customerIdMap = new Map<string, string>();
    const allPhones = [...phoneMap.keys()];
    for (let i = 0; i < allPhones.length; i += 500) {
      const chunk = allPhones.slice(i, i + 500);
      const { data: existingCusts } = await adminClient
        .from("customers").select("id, phone").eq("tenant_id", tenantId).in("phone", chunk);
      existingCusts?.forEach((c: any) => customerIdMap.set(c.phone, c.id));
    }

    const newCustomers = allPhones.filter(p => !customerIdMap.has(p)).map(p => {
      const info = phoneMap.get(p)!;
      return { name: info.name, phone: info.phone, email: info.email || null, address: info.address || null, tenant_id: tenantId, source: sourceId };
    });

    for (let i = 0; i < newCustomers.length; i += 200) {
      const chunk = newCustomers.slice(i, i + 200);
      const { data: inserted } = await adminClient.from("customers").insert(chunk).select("id, phone");
      inserted?.forEach((c: any) => customerIdMap.set(c.phone, c.id));
    }

    // Insert receipts
    let createdReceipts = 0, createdItems = 0, skipped = 0;
    const newOrders = completedOrders.filter(o => {
      const code = `${sourceId.toUpperCase()}-${o.orderId.slice(-8)}`;
      if (existingCodesSet.has(code)) { skipped++; return false; }
      return true;
    });

    for (let i = 0; i < newOrders.length; i += 200) {
      const chunk = newOrders.slice(i, i + 200);
      const receiptRows = chunk.map(order => {
        const cleanPhone = order.customerPhone?.replace(/\s+/g, "") || "";
        return {
          code: `${sourceId.toUpperCase()}-${order.orderId.slice(-8)}`,
          tenant_id: tenantId,
          customer_id: customerIdMap.get(cleanPhone) || null,
          branch_id: defaultBranchId,
          export_date: parseDate(order.orderDate),
          total_amount: order.salePrice || 0,
          paid_amount: order.salePrice || 0,
          debt_amount: 0, vat_amount: 0, vat_rate: 0,
          status: "completed",
          note: `[${sourceId}] ${order.note || ""}`.trim(),
        };
      });

      const { data: insertedReceipts, error: receiptErr } = await adminClient
        .from("export_receipts").insert(receiptRows).select("id, code");
      if (receiptErr) { console.error("Receipt error:", receiptErr); skipped += chunk.length; continue; }

      createdReceipts += insertedReceipts.length;
      const codeToId = new Map(insertedReceipts.map((r: any) => [r.code, r.id]));

      const itemRows = chunk.map(order => {
        const code = `${sourceId.toUpperCase()}-${order.orderId.slice(-8)}`;
        const receiptId = codeToId.get(code);
        if (!receiptId) return null;
        return {
          receipt_id: receiptId,
          product_name: order.productName || "Sản phẩm",
          sku: order.productVariant || "",
          imei: cleanImei(order.imei),
          sale_price: order.salePrice || 0,
          status: "sold",
          warranty: order.warranty || null,
          note: order.note || null,
        };
      }).filter(Boolean);

      if (itemRows.length > 0) {
        const { error: itemErr } = await adminClient.from("export_receipt_items").insert(itemRows);
        if (itemErr) console.error("Item error:", itemErr);
        else createdItems += itemRows.length;
      }
    }

    return new Response(JSON.stringify({
      success: true,
      totalRows: rawData.length - startRow,
      parsedOrders: orders.length,
      completedOrders: completedOrders.length,
      createdReceipts,
      createdItems,
      customersCreated: newCustomers.length,
      skipped,
      priceStats,
      debugRows,
    }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
