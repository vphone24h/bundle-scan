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

      // Filter users by audience and dedup
      const eligibleUsers: TargetUser[] = [];
      for (const user of users) {
        if (!matchesAudience(user, auto.target_audience)) continue;
        const alreadySent = await checkAlreadySent(supabase, auto, user.user_id);
        if (alreadySent) continue;
        eligibleUsers.push(user);
      }

      if (eligibleUsers.length === 0) continue;

      // Collect unique tenant IDs for targeting
      const tenantIds = [...new Set(eligibleUsers.map(u => u.tenant_id).filter(Boolean))] as string[];

      // Create ONE bell notification per automation run (not per user)
      if ((auto.channels as string[]).includes('bell')) {
        await supabase.from('system_notifications').insert({
          title: auto.title,
          message: auto.message,
          full_content: auto.full_content || null,
          notification_type: auto.link_url ? 'article' : 'info',
          link_url: auto.link_url || null,
          is_pinned: false,
          is_active: true,
          show_as_startup_popup: (auto.channels as string[]).includes('popup'),
          target_audience: tenantIds.length > 0 ? 'group' : 'all',
          target_tenant_ids: tenantIds,
          source: 'automation',
        });
      }

      // Send push and log per user
      for (const user of eligibleUsers) {
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

        // Log execution per user for dedup tracking
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
  tenant_status?: string;
  subscription_start_date?: string | null;
}

function replaceVars(text: string, user: TargetUser): string {
  return text
    .replace(/\{name\}/g, user.display_name || 'bạn')
    .replace(/\{email\}/g, user.email || '');
}

/** Check if user matches the target audience filter */
function matchesAudience(user: TargetUser, audience: string): boolean {
  if (!audience || audience === 'all') return true;
  const status = user.tenant_status || 'active';
  switch (audience) {
    case 'active': return status === 'active';
    case 'trial': return status === 'trial';
    case 'free': return status === 'expired' || status === 'active'; // accounts without paid subscription
    case 'paid': return !!user.subscription_start_date;
    default: return true;
  }
}

/** Check if notification was already sent based on frequency setting */
async function checkAlreadySent(supabase: any, auto: any, userId: string): Promise<boolean> {
  const frequency: string = auto.send_frequency || 'daily';

  let cutoff: Date | null = null;
  const now = new Date();

  switch (frequency) {
    case 'once':
      // Check if ever sent
      cutoff = null; // no time filter = check all time
      break;
    case 'daily': {
      cutoff = new Date(now);
      cutoff.setHours(0, 0, 0, 0);
      break;
    }
    case 'weekly': {
      cutoff = new Date(now);
      cutoff.setDate(cutoff.getDate() - 7);
      break;
    }
    case 'monthly': {
      cutoff = new Date(now);
      cutoff.setMonth(cutoff.getMonth() - 1);
      break;
    }
    default: {
      cutoff = new Date(now);
      cutoff.setHours(0, 0, 0, 0);
    }
  }

  let query = supabase
    .from('automation_execution_logs')
    .select('id')
    .eq('automation_id', auto.id)
    .eq('user_id', userId)
    .eq('channel', 'bell');

  if (cutoff) {
    query = query.gte('executed_at', cutoff.toISOString());
  }

  const { data: existing } = await query.maybeSingle();
  return !!existing;
}

async function getTargetUsers(supabase: any, automation: any): Promise<TargetUser[]> {
  const now = new Date();
  const trigger = automation.trigger_type;

  if (trigger === 'new_signup') {
    const delayMs = (automation.delay_minutes || 5) * 60 * 1000;
    const cutoffRecent = new Date(now.getTime() - delayMs);
    const cutoffOld = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const { data } = await supabase
      .from('platform_users')
      .select('user_id, tenant_id')
      .gte('created_at', cutoffOld.toISOString())
      .lte('created_at', cutoffRecent.toISOString());

    return await enrichUsersWithTenantStatus(supabase, data || []);
  }

  if (trigger === 'inactive_1d' || trigger === 'inactive_3d' || trigger === 'inactive_7d') {
    const daysMap: Record<string, number> = { inactive_1d: 1, inactive_3d: 3, inactive_7d: 7 };
    const days = daysMap[trigger] || 1;
    const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    const cutoffEnd = new Date(now.getTime() - (days + 1) * 24 * 60 * 60 * 1000);

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
    return await enrichUsersWithTenantStatus(supabase, results);
  }

  if (trigger === 'trial_expiring') {
    const { data: tenants } = await supabase
      .from('tenants')
      .select('id, trial_end_date, status, subscription_start_date')
      .eq('status', 'trial')
      .not('trial_end_date', 'is', null);

    const targetTenantMap: Record<string, any> = {};
    for (const t of tenants || []) {
      const trialEnd = new Date(t.trial_end_date);
      const daysLeft = Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      if (daysLeft <= 2 && daysLeft >= 0) {
        targetTenantMap[t.id] = t;
      }
    }

    const tenantIds = Object.keys(targetTenantMap);
    if (tenantIds.length === 0) return [];

    const { data: users } = await supabase
      .from('platform_users')
      .select('user_id, tenant_id')
      .in('tenant_id', tenantIds);

    return (users || []).map((u: any) => ({
      user_id: u.user_id,
      tenant_id: u.tenant_id,
      tenant_status: targetTenantMap[u.tenant_id]?.status || 'trial',
      subscription_start_date: targetTenantMap[u.tenant_id]?.subscription_start_date || null,
    }));
  }

  if (trigger === 'low_stock') {
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

    return await enrichUsersWithTenantStatus(supabase, users || []);
  }

  if (trigger === 'no_import') {
    // Tenants that have NEVER imported
    const { data: allUsers } = await supabase
      .from('platform_users')
      .select('user_id, tenant_id')
      .eq('is_active', true);

    const results: TargetUser[] = [];
    const checkedTenants: Record<string, boolean> = {};
    for (const u of allUsers || []) {
      if (!u.tenant_id) continue;
      if (checkedTenants[u.tenant_id] === undefined) {
        const { count } = await supabase
          .from('import_receipts')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', u.tenant_id);
        checkedTenants[u.tenant_id] = (count || 0) === 0;
      }
      if (checkedTenants[u.tenant_id]) {
        results.push({ user_id: u.user_id, tenant_id: u.tenant_id });
      }
    }
    return await enrichUsersWithTenantStatus(supabase, results);
  }

  if (trigger === 'no_export') {
    // Tenants that have NEVER exported
    const { data: allUsers } = await supabase
      .from('platform_users')
      .select('user_id, tenant_id')
      .eq('is_active', true);

    const results: TargetUser[] = [];
    const checkedTenants: Record<string, boolean> = {};
    for (const u of allUsers || []) {
      if (!u.tenant_id) continue;
      if (checkedTenants[u.tenant_id] === undefined) {
        const { count } = await supabase
          .from('export_receipts')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', u.tenant_id);
        checkedTenants[u.tenant_id] = (count || 0) === 0;
      }
      if (checkedTenants[u.tenant_id]) {
        results.push({ user_id: u.user_id, tenant_id: u.tenant_id });
      }
    }
    return await enrichUsersWithTenantStatus(supabase, results);
  }

  if (trigger === 'no_subscription') {
    // Tenants without a paid subscription
    const { data: tenants } = await supabase
      .from('tenants')
      .select('id')
      .is('subscription_start_date', null);

    if (!tenants || tenants.length === 0) return [];
    const tenantIds = tenants.map((t: any) => t.id);

    const { data: users } = await supabase
      .from('platform_users')
      .select('user_id, tenant_id')
      .in('tenant_id', tenantIds)
      .eq('is_active', true);

    return await enrichUsersWithTenantStatus(supabase, users || []);
  }

  if (trigger === 'all_accounts') {
    // All active platform users
    const { data: users } = await supabase
      .from('platform_users')
      .select('user_id, tenant_id')
      .eq('is_active', true);

    return await enrichUsersWithTenantStatus(supabase, users || []);
  }

  return [];
}

/** Enrich user list with tenant status info for audience filtering */
async function enrichUsersWithTenantStatus(supabase: any, users: any[]): Promise<TargetUser[]> {
  if (users.length === 0) return [];

  const tenantIds = [...new Set(users.map(u => u.tenant_id).filter(Boolean))];
  if (tenantIds.length === 0) return users;

  const { data: tenants } = await supabase
    .from('tenants')
    .select('id, status, subscription_start_date')
    .in('id', tenantIds);

  const tenantMap: Record<string, any> = {};
  for (const t of tenants || []) {
    tenantMap[t.id] = t;
  }

  return users.map(u => ({
    user_id: u.user_id,
    tenant_id: u.tenant_id,
    tenant_status: tenantMap[u.tenant_id]?.status || 'active',
    subscription_start_date: tenantMap[u.tenant_id]?.subscription_start_date || null,
  }));
}
