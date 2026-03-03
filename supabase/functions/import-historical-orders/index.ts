import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface OrderRow {
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
  orderDate: string; // dd/MM/yyyy
  status: string;
  warranty: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify user with their token
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get tenant_id
    const { data: tenantId } = await userClient.rpc("get_user_tenant_id_secure");
    if (!tenantId) {
      return new Response(JSON.stringify({ error: "Tenant not found" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check admin
    const { data: isAdmin } = await userClient.rpc("is_tenant_admin", { _user_id: user.id });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden: Admin only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use service role for inserts to bypass RLS
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const { orders, sourceId = "vphone1" }: { orders: OrderRow[]; sourceId?: string } = await req.json();

    if (!orders || !Array.isArray(orders) || orders.length === 0) {
      return new Response(JSON.stringify({ error: "No orders provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get default branch
    const { data: branches } = await adminClient
      .from("branches")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("is_default", true)
      .limit(1);
    const defaultBranchId = branches?.[0]?.id || null;

    // Filter only completed orders
    const completedOrders = orders.filter(
      (o) => o.status === "Hoàn tất" || o.status === "Đã giao hàng"
    );

    // Collect unique phones
    const phoneMap = new Map<string, { name: string; email: string; address: string; phone: string }>();
    for (const o of completedOrders) {
      if (o.customerPhone && o.customerPhone.length >= 9) {
        const cleaned = o.customerPhone.replace(/\s+/g, "");
        if (!phoneMap.has(cleaned)) {
          phoneMap.set(cleaned, {
            name: o.customerName || "Khách lẻ",
            email: o.customerEmail || "",
            address: o.customerAddress || "",
            phone: cleaned,
          });
        }
      }
    }

    // Upsert customers
    const customerIdMap = new Map<string, string>();
    for (const [phone, info] of phoneMap) {
      // Check existing
      const { data: existing } = await adminClient
        .from("customers")
        .select("id")
        .eq("phone", phone)
        .eq("tenant_id", tenantId)
        .maybeSingle();

      if (existing) {
        customerIdMap.set(phone, existing.id);
      } else {
        const { data: newCust, error: custErr } = await adminClient
          .from("customers")
          .insert({
            name: info.name,
            phone: info.phone,
            email: info.email || null,
            address: info.address || null,
            tenant_id: tenantId,
            source: sourceId,
          })
          .select("id")
          .single();

        if (custErr) {
          console.error("Customer insert error:", custErr);
          continue;
        }
        customerIdMap.set(phone, newCust.id);
      }
    }

    // Create export receipts + items
    let createdReceipts = 0;
    let createdItems = 0;
    let skipped = 0;

    for (const order of completedOrders) {
      const cleanPhone = order.customerPhone?.replace(/\s+/g, "") || "";
      const customerId = customerIdMap.get(cleanPhone) || null;

      // Parse date: dd/MM/yyyy -> ISO
      let exportDate: string;
      try {
        const parts = order.orderDate.split("/");
        if (parts.length === 3) {
          const day = parts[0].padStart(2, "0");
          const month = parts[1].padStart(2, "0");
          const year = parts[2];
          exportDate = `${year}-${month}-${day}T12:00:00+07:00`;
        } else {
          exportDate = new Date().toISOString();
        }
      } catch {
        exportDate = new Date().toISOString();
      }

      const receiptCode = `${sourceId.toUpperCase()}-${order.orderId.slice(-8)}`;

      // Check duplicate receipt by code
      const { data: existingReceipt } = await adminClient
        .from("export_receipts")
        .select("id")
        .eq("code", receiptCode)
        .eq("tenant_id", tenantId)
        .maybeSingle();

      if (existingReceipt) {
        skipped++;
        continue;
      }

      const { data: receipt, error: receiptErr } = await adminClient
        .from("export_receipts")
        .insert({
          code: receiptCode,
          tenant_id: tenantId,
          customer_id: customerId,
          branch_id: defaultBranchId,
          export_date: exportDate,
          total_amount: order.salePrice || 0,
          paid_amount: order.salePrice || 0,
          debt_amount: 0,
          vat_amount: 0,
          vat_rate: 0,
          status: "completed",
          note: `[${sourceId}] ${order.note || ""}`.trim(),
          created_by: user.id,
        })
        .select("id")
        .single();

      if (receiptErr) {
        console.error("Receipt insert error:", receiptErr);
        skipped++;
        continue;
      }

      createdReceipts++;

      // Clean IMEI
      let imei = order.imei?.trim() || null;
      if (imei === "-" || imei === "" || imei === "empty" || imei?.startsWith("empty")) {
        imei = null;
      }

      const { error: itemErr } = await adminClient
        .from("export_receipt_items")
        .insert({
          receipt_id: receipt.id,
          product_name: order.productName || "Sản phẩm",
          sku: order.productVariant || "",
          imei: imei,
          sale_price: order.salePrice || 0,
          status: "sold",
          warranty: order.warranty || null,
          note: order.note || null,
        });

      if (itemErr) {
        console.error("Item insert error:", itemErr);
      } else {
        createdItems++;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        totalOrders: orders.length,
        completedOrders: completedOrders.length,
        createdReceipts,
        createdItems,
        customersCreated: phoneMap.size,
        skipped,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
