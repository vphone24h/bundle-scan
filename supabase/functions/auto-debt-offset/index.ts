import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const body = await req.json().catch(() => ({}));
    const tenantId = body.tenant_id;
    const entityCode = body.entity_code; // optional: only check specific entity

    if (!tenantId) {
      return new Response(JSON.stringify({ error: "tenant_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get customer debts with entity_code
    const { data: customerDebts } = await supabase.rpc(
      "get_customer_debt_summary",
      { _show_settled: false, _branch_id: null }
    );

    // Get supplier debts with entity_code
    const { data: supplierDebts } = await supabase.rpc(
      "get_supplier_debt_summary",
      { _show_settled: false, _branch_id: null }
    );

    if (!customerDebts || !supplierDebts) {
      return new Response(JSON.stringify({ message: "No debts found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build supplier map by entity_code
    const supplierByCode = new Map<string, any>();
    for (const sd of supplierDebts) {
      if (sd.entity_code && sd.remaining_amount > 0) {
        supplierByCode.set(sd.entity_code.trim(), sd);
      }
    }

    // Find matches
    const matches: any[] = [];
    for (const cd of customerDebts) {
      if (cd.entity_code && cd.remaining_amount > 0) {
        const code = cd.entity_code.trim();
        // If entityCode specified, only process that one
        if (entityCode && code !== entityCode) continue;
        const matchedSupplier = supplierByCode.get(code);
        if (matchedSupplier) {
          matches.push({
            customerDebt: cd,
            supplierDebt: matchedSupplier,
            entityCode: code,
          });
        }
      }
    }

    if (matches.length === 0) {
      return new Response(
        JSON.stringify({ message: "No offset matches found", count: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results: any[] = [];

    for (const match of matches) {
      const cd = match.customerDebt;
      const sd = match.supplierDebt;
      const offsetAmount = Math.min(cd.remaining_amount, sd.remaining_amount);

      if (offsetAmount <= 0) continue;

      const customerDebtAfter = cd.remaining_amount - offsetAmount;
      const supplierDebtAfter = sd.remaining_amount - offsetAmount;

      // 1. Record offset
      const { error: offsetError } = await supabase
        .from("debt_offsets")
        .insert([
          {
            tenant_id: tenantId,
            customer_entity_id: cd.entity_id,
            supplier_entity_id: sd.entity_id,
            customer_name: cd.entity_name,
            supplier_name: sd.entity_name,
            customer_debt_before: cd.remaining_amount,
            supplier_debt_before: sd.remaining_amount,
            offset_amount: offsetAmount,
            customer_debt_after: customerDebtAfter,
            supplier_debt_after: supplierDebtAfter,
            note: `[Tự động] Bù trừ công nợ 2 chiều: ${cd.entity_name} ↔ ${sd.entity_name}`,
            created_by: null,
          },
        ]);

      if (offsetError) {
        console.error("Offset insert error:", offsetError);
        continue;
      }

      // 2. Customer debt payment
      await supabase.from("debt_payments").insert([
        {
          entity_type: "customer",
          entity_id: cd.entity_id,
          payment_type: "payment",
          amount: offsetAmount,
          payment_source: "debt_offset",
          description: `[Tự động] Bù trừ công nợ với NCC ${sd.entity_name}`,
          branch_id: cd.branch_id,
          created_by: null,
          tenant_id: tenantId,
        },
      ]);

      // 3. Supplier debt payment
      const supplierEntityIds =
        sd.merged_entity_ids && sd.merged_entity_ids.length > 0
          ? sd.merged_entity_ids
          : [sd.entity_id];

      await supabase.from("debt_payments").insert([
        {
          entity_type: "supplier",
          entity_id: sd.entity_id,
          payment_type: "payment",
          amount: offsetAmount,
          payment_source: "debt_offset",
          description: `[Tự động] Bù trừ công nợ với KH ${cd.entity_name}`,
          branch_id: sd.branch_id,
          created_by: null,
          tenant_id: tenantId,
        },
      ]);

      // 4. FIFO for customer
      {
        let remaining = offsetAmount;
        const { data: receipts } = await supabase
          .from("export_receipts")
          .select("id, export_date, debt_amount, paid_amount")
          .eq("customer_id", cd.entity_id)
          .eq("status", "completed")
          .gt("debt_amount", 0)
          .order("export_date", { ascending: true });

        if (receipts) {
          for (const r of receipts) {
            if (remaining <= 0) break;
            const pay = Math.min(remaining, Number(r.debt_amount));
            await supabase
              .from("export_receipts")
              .update({
                paid_amount: Number(r.paid_amount) + pay,
                debt_amount: Number(r.debt_amount) - pay,
              })
              .eq("id", r.id);
            remaining -= pay;
          }
        }
      }

      // 5. FIFO for supplier
      {
        let remaining = offsetAmount;
        const { data: receipts } = await supabase
          .from("import_receipts")
          .select("id, import_date, debt_amount, paid_amount")
          .in("supplier_id", supplierEntityIds)
          .eq("status", "completed")
          .gt("debt_amount", 0)
          .order("import_date", { ascending: true });

        if (receipts) {
          for (const r of receipts) {
            if (remaining <= 0) break;
            const pay = Math.min(remaining, Number(r.debt_amount));
            await supabase
              .from("import_receipts")
              .update({
                paid_amount: Number(r.paid_amount) + pay,
                debt_amount: Number(r.debt_amount) - pay,
              })
              .eq("id", r.id);
            remaining -= pay;
          }
        }
      }

      // 6. Audit log
      await supabase.from("audit_logs").insert([
        {
          user_id: null,
          action_type: "auto_debt_offset",
          table_name: "debt_offsets",
          tenant_id: tenantId,
          description: `[Tự động] Bù trừ: KH ${cd.entity_name} ↔ NCC ${sd.entity_name} | ${offsetAmount.toLocaleString("vi-VN")}đ`,
          new_data: {
            customer_entity_id: cd.entity_id,
            supplier_entity_id: sd.entity_id,
            offset_amount: offsetAmount,
            customer_debt_after: customerDebtAfter,
            supplier_debt_after: supplierDebtAfter,
          },
        },
      ]);

      // 7. In-app notification to all admins of this tenant
      const { data: admins } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("tenant_id", tenantId)
        .in("user_role", ["super_admin", "branch_admin"]);

      if (admins) {
        const notifications = admins.map((a: any) => ({
          tenant_id: tenantId,
          user_id: a.user_id,
          notification_type: "auto_debt_offset",
          title: "Bù trừ công nợ tự động",
          message: `Hệ thống đã tự động bù trừ ${offsetAmount.toLocaleString("vi-VN")}đ giữa KH ${cd.entity_name} và NCC ${sd.entity_name}`,
          reference_type: "debt_offset",
        }));
        await supabase.from("crm_notifications").insert(notifications);
      }

      results.push({
        entityCode: match.entityCode,
        customer: cd.entity_name,
        supplier: sd.entity_name,
        offsetAmount,
      });
    }

    return new Response(
      JSON.stringify({
        message: `Auto-offset completed: ${results.length} pair(s)`,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("Auto debt offset error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
