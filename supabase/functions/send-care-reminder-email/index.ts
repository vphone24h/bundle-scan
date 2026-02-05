 import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
 import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
 
 const corsHeaders = {
   "Access-Control-Allow-Origin": "*",
   "Access-Control-Allow-Headers":
     "authorization, x-client-info, apikey, content-type",
 };
 
 interface EmailRequest {
   scheduleId?: string;
   userId?: string;
   sendAll?: boolean;
 }
 
 const handler = async (req: Request): Promise<Response> => {
   if (req.method === "OPTIONS") {
     return new Response(null, { headers: corsHeaders });
   }
 
   try {
     const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
     const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
     const resendApiKey = Deno.env.get("RESEND_API_KEY");
 
     const supabase = createClient(supabaseUrl, supabaseServiceKey);
 
     const { scheduleId, userId, sendAll }: EmailRequest = await req.json();
 
     // Get pending care schedules that are due today or overdue
     let query = supabase
       .from("customer_care_schedules")
       .select(`
         id,
         tenant_id,
         customer_id,
         care_type_name,
         scheduled_date,
         scheduled_time,
         note,
         assigned_staff_id,
         status,
         customer:customers(id, name, phone)
       `)
       .eq("status", "pending")
       .lte("scheduled_date", new Date().toISOString().split("T")[0]);
 
     if (scheduleId) {
       query = query.eq("id", scheduleId);
     }
     if (userId) {
       query = query.eq("assigned_staff_id", userId);
     }
 
     const { data: schedules, error: schedulesError } = await query;
 
     if (schedulesError) throw schedulesError;
 
     if (!schedules || schedules.length === 0) {
       return new Response(JSON.stringify({ message: "No pending schedules found" }), {
         status: 200,
         headers: { "Content-Type": "application/json", ...corsHeaders },
       });
     }
 
     // Create in-app notifications for each schedule
     const notificationResults = [];
 
     for (const schedule of schedules) {
       if (!schedule.assigned_staff_id) continue;
 
      const customerData = schedule.customer as unknown;
      const customer = Array.isArray(customerData) && customerData.length > 0
        ? customerData[0] as { id: string; name: string; phone: string }
        : customerData as { id: string; name: string; phone: string } | null;
       const isOverdue = new Date(schedule.scheduled_date) < new Date(new Date().toISOString().split("T")[0]);
 
       // Check if notification already exists for today
       const { data: existingNotification } = await supabase
         .from("crm_notifications")
         .select("id")
         .eq("reference_id", schedule.id)
         .eq("notification_type", isOverdue ? "overdue_care" : "care_reminder")
         .gte("created_at", new Date().toISOString().split("T")[0])
         .single();
 
       if (existingNotification) {
         continue; // Skip if already notified today
       }
 
       // Create in-app notification
       const { error: notifError } = await supabase.from("crm_notifications").insert({
         tenant_id: schedule.tenant_id,
         user_id: schedule.assigned_staff_id,
         notification_type: isOverdue ? "overdue_care" : "care_reminder",
         title: isOverdue
           ? `Quá hạn: ${customer?.name || "Khách hàng"}`
           : `Nhắc chăm sóc: ${customer?.name || "Khách hàng"}`,
         message: `${schedule.care_type_name} - SĐT: ${customer?.phone || "N/A"}`,
         reference_type: "care_schedule",
         reference_id: schedule.id,
       });
 
       if (notifError) {
         console.error("Failed to create notification:", notifError);
         continue;
       }
 
       notificationResults.push({
         scheduleId: schedule.id,
         type: "app_notification",
         success: true,
       });
 
       // Send email if RESEND_API_KEY is configured
       if (resendApiKey) {
         // Get staff email from platform_users
         const { data: staffUser } = await supabase
           .from("platform_users")
           .select("email")
           .eq("user_id", schedule.assigned_staff_id)
           .eq("tenant_id", schedule.tenant_id)
           .single();
 
         if (staffUser?.email) {
           try {
             const emailResponse = await fetch("https://api.resend.com/emails", {
               method: "POST",
               headers: {
                 "Content-Type": "application/json",
                 Authorization: `Bearer ${resendApiKey}`,
               },
               body: JSON.stringify({
                 from: "vkho.vn <noreply@vkho.vn>",
                 to: [staffUser.email],
                 subject: isOverdue
                   ? `[Quá hạn] Chăm sóc: ${customer?.name}`
                   : `[Nhắc nhở] Chăm sóc: ${customer?.name}`,
                 html: `
                   <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                     <h2 style="color: ${isOverdue ? "#ef4444" : "#3b82f6"};">
                       ${isOverdue ? "⚠️ Lịch chăm sóc đã quá hạn" : "🔔 Nhắc lịch chăm sóc"}
                     </h2>
                     <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
                       <p><strong>Khách hàng:</strong> ${customer?.name || "N/A"}</p>
                       <p><strong>SĐT:</strong> ${customer?.phone || "N/A"}</p>
                       <p><strong>Nội dung:</strong> ${schedule.care_type_name}</p>
                       <p><strong>Ngày hẹn:</strong> ${schedule.scheduled_date}${schedule.scheduled_time ? ` lúc ${schedule.scheduled_time}` : ""}</p>
                       ${schedule.note ? `<p><strong>Ghi chú:</strong> ${schedule.note}</p>` : ""}
                     </div>
                     <p style="color: #666; font-size: 14px;">
                       Vui lòng đăng nhập vào hệ thống để cập nhật trạng thái chăm sóc.
                     </p>
                   </div>
                 `,
               }),
             });
 
             if (emailResponse.ok) {
               // Update notification with email sent status
               await supabase
                 .from("crm_notifications")
                 .update({
                   is_email_sent: true,
                   email_sent_at: new Date().toISOString(),
                 })
                 .eq("reference_id", schedule.id)
                 .eq("notification_type", isOverdue ? "overdue_care" : "care_reminder");
 
               notificationResults.push({
                 scheduleId: schedule.id,
                 type: "email",
                 success: true,
               });
             }
           } catch (emailError) {
             console.error("Failed to send email:", emailError);
           }
         }
       }
     }
 
     // Update overdue schedules
     await supabase
       .from("customer_care_schedules")
       .update({ status: "overdue" })
       .eq("status", "pending")
       .lt("scheduled_date", new Date().toISOString().split("T")[0]);
 
     return new Response(
       JSON.stringify({
         success: true,
         processed: schedules.length,
         notifications: notificationResults,
       }),
       {
         status: 200,
         headers: { "Content-Type": "application/json", ...corsHeaders },
       }
     );
   } catch (error: any) {
     console.error("Error in send-care-reminder-email:", error);
     return new Response(JSON.stringify({ error: error.message }), {
       status: 500,
       headers: { "Content-Type": "application/json", ...corsHeaders },
     });
   }
 };
 
 serve(handler);