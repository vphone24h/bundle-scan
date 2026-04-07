/**
 * Company-aware tenant helpers
 * 
 * Since data is already isolated by tenant_id, and tenants belong to companies,
 * the company layer provides grouping/validation rather than direct data filtering.
 * 
 * Use these helpers for:
 * - Validating user belongs to correct company at login
 * - Filtering tenant lists by company
 * - Building company-scoped URLs
 */

import { supabase } from '@/integrations/supabase/client';
import { getCurrentCompanyId } from '@/hooks/useCompanyResolver';

/**
 * Validate that a tenant belongs to the current company.
 * Used during login to prevent cross-company access.
 */
export async function validateTenantCompany(tenantId: string): Promise<boolean> {
  const companyId = getCurrentCompanyId();
  if (!companyId) return true; // No company context = allow (dev mode / fallback)

  const { data, error } = await supabase
    .from('tenants')
    .select('company_id')
    .eq('id', tenantId)
    .single();

  if (error || !data) return false;
  return data.company_id === companyId;
}

/**
 * Get all tenant IDs that belong to the current company.
 * Useful for platform-level queries scoped to a company.
 */
export async function getCompanyTenantIds(): Promise<string[]> {
  const companyId = getCurrentCompanyId();
  if (!companyId) return [];

  const { data, error } = await supabase
    .from('tenants')
    .select('id')
    .eq('company_id', companyId);

  if (error || !data) return [];
  return data.map(t => t.id);
}

/**
 * Check if current user's tenant belongs to the resolved company.
 * Returns true if valid, false if cross-company access detected.
 */
export async function isUserInCurrentCompany(userId: string): Promise<boolean> {
  const companyId = getCurrentCompanyId();
  if (!companyId) return true;

  const { data: tenantId } = await supabase.rpc('get_user_tenant_id_secure');
  if (!tenantId) return false;

  return validateTenantCompany(tenantId);
}
