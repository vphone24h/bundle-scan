import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Get all enabled automations
    const { data: automations, error: autoErr } = await supabase
      .from('notification_automations')
      .select('*')
      .eq('is_enabled', true);

    if (autoErr) throw autoErr;
    if (!automations || automations.length === 0) {
      return new Response(JSON.stringify({ message: 'No active automations' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let totalSent = 0;

    for (const auto of automations) {
      const users = await getTargetUsers(supabase, auto);

      for (const user of users) {
        // Check if already executed (for recurring triggers like low_stock, check today only)
        const isRecurring = ['low_stock', 'trial_expiring'].includes(auto.trigger_type);
        let execQuery = supabase
          .from('automation_execution_logs')
          .select('id')
          .eq('automation_id', auto.id)
          .eq('user_id', user.user_id)
          .eq('channel', 'bell');

        if (isRecurring) {
          const todayStart = new Date();
          todayStart.setHours(0, 0, 0, 0);
          execQuery = execQuery.gte('executed_at', todayStart.toISOString());
        }

        const { data: existing } = await execQuery.maybeSingle();

        if (existing) continue;

        // Create system notification for this user via bell
        if ((auto.channels as string[]).includes('bell')) {
          await supabase.from('system_notifications').insert({
            title: replaceVars(auto.title, user),
            message: replaceVars(auto.message, user),
            full_content: auto.full_content || null,
            notification_type: auto.link_url ? 'article' : 'info',
            link_url: auto.link_url || null,
            is_pinned: false,
            is_active: true,
            show_as_startup_popup: (auto.channels as string[]).includes('popup'),
            target_audience: 'group',
            target_tenant_ids: user.tenant_id ? [user.tenant_id] : [],
          });
        }

        // Send push notification if push channel is enabled
        if ((auto.channels as string[]).includes('push') || (auto.channels as string[]).includes('bell')) {
          try {
            const pushUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/send-push`;
            await fetch(pushUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
              },
              body: JSON.stringify({
                title: replaceVars(auto.title, user),
                message: replaceVars(auto.message, user),
                url: auto.link_url || '/',
              }),
            });
          } catch (pushErr) {
            console.error('Push send error in automation:', pushErr);
          }
        }

        // Log execution
        await supabase.from('automation_execution_logs').insert({
          automation_id: auto.id,
          user_id: user.user_id,
          tenant_id: user.tenant_id || null,
          channel: 'bell',
        });

        totalSent++;
      }
    }

    return new Response(JSON.stringify({ message: `Processed ${totalSent} automations` }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Automation error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

interface TargetUser {
  user_id: string;
  tenant_id?: string;
  display_name?: string;
  email?: string;
}

function replaceVars(text: string, user: TargetUser): string {
  return text
    .replace(/\{name\}/g, user.display_name || 'bạn')
    .replace(/\{email\}/g, user.email || '');
}

async function getTargetUsers(supabase: any, automation: any): Promise<TargetUser[]> {
  const now = new Date();
  const trigger = automation.trigger_type;

  if (trigger === 'new_signup') {
    // Users created within the last day who signed up at least delay_minutes ago
    const delayMs = (automation.delay_minutes || 5) * 60 * 1000;
    const cutoffRecent = new Date(now.getTime() - delayMs);
    const cutoffOld = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const { data } = await supabase
      .from('platform_users')
      .select('user_id, tenant_id')
      .gte('created_at', cutoffOld.toISOString())
      .lte('created_at', cutoffRecent.toISOString());

    return (data || []).map((u: any) => ({ user_id: u.user_id, tenant_id: u.tenant_id }));
  }

  if (trigger === 'inactive_1d' || trigger === 'inactive_3d' || trigger === 'inactive_7d') {
    const daysMap: Record<string, number> = { inactive_1d: 1, inactive_3d: 3, inactive_7d: 7 };
    const days = daysMap[trigger] || 1;
    const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    const cutoffEnd = new Date(now.getTime() - (days + 1) * 24 * 60 * 60 * 1000);

    // Users who signed up around N days ago and have no import receipts
    const { data: users } = await supabase
      .from('platform_users')
      .select('user_id, tenant_id')
      .gte('created_at', cutoffEnd.toISOString())
      .lte('created_at', cutoff.toISOString());

    const results: TargetUser[] = [];
    for (const u of users || []) {
      if (!u.tenant_id) continue;
      const { count } = await supabase
        .from('import_receipts')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', u.tenant_id);

      if ((count || 0) === 0) {
        results.push({ user_id: u.user_id, tenant_id: u.tenant_id });
      }
    }
    return results;
  }

  if (trigger === 'trial_expiring') {
    // Tenants whose trial expires in 2 days
    const { data: tenants } = await supabase
      .from('tenants')
      .select('id, trial_end_date')
      .eq('status', 'trial')
      .not('trial_end_date', 'is', null);

    const targetTenantIds: string[] = [];
    for (const t of tenants || []) {
      const trialEnd = new Date(t.trial_end_date);
      const daysLeft = Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      if (daysLeft <= 2 && daysLeft >= 0) {
        targetTenantIds.push(t.id);
      }
    }

    if (targetTenantIds.length === 0) return [];

    const { data: users } = await supabase
      .from('platform_users')
      .select('user_id, tenant_id')
      .in('tenant_id', targetTenantIds);

    return (users || []).map((u: any) => ({ user_id: u.user_id, tenant_id: u.tenant_id }));
  }

  if (trigger === 'low_stock') {
    // Find tenants with products that have quantity <= 2
    const { data: lowStockProducts } = await supabase
      .from('products')
      .select('tenant_id')
      .lte('quantity', 2)
      .gt('quantity', 0);

    if (!lowStockProducts || lowStockProducts.length === 0) return [];

    const tenantIds = [...new Set(lowStockProducts.map((p: any) => p.tenant_id).filter(Boolean))];

    const { data: users } = await supabase
      .from('user_roles')
      .select('user_id, tenant_id')
      .in('tenant_id', tenantIds)
      .in('user_role', ['super_admin', 'branch_admin']);

    return (users || []).map((u: any) => ({ user_id: u.user_id, tenant_id: u.tenant_id }));
  }

  return [];
}
