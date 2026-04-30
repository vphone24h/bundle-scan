import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentTenant } from './useTenant';
import { useDebtPaymentHistory } from './useDebt';
import { toast } from 'sonner';

export interface InterestConfig {
  id: string;
  tenant_id: string;
  entity_type: 'customer' | 'supplier';
  entity_id: string;
  monthly_rate_percent: number;
  start_date: string;
  is_active: boolean;
}

export interface InterestPayment {
  id: string;
  amount: number;
  note: string | null;
  paid_at: string;
}

/**
 * Whether interest feature enabled for this shop.
 * Admin tên miền bật/tắt riêng từng shop ở tab DN (tenants.interest_enabled).
 */
export function useCompanyInterestEnabled() {
  const { data: tenant } = useCurrentTenant();
  const companyId = (tenant as any)?.company_id || null;
  const tenantInterestEnabled = !!(tenant as any)?.interest_enabled;

  const { data } = useQuery({
    queryKey: ['company-interest-phone', companyId],
    queryFn: async () => {
      if (!companyId) return { phone: null as string | null };
      const { data: settings } = await supabase
        .from('company_settings')
        .select('phone')
        .eq('company_id', companyId)
        .maybeSingle();
      return { phone: (settings as any)?.phone || null };
    },
    enabled: !!companyId,
    staleTime: 60_000,
  });

  return {
    enabled: tenantInterestEnabled,
    adminPhone: data?.phone || null,
    tenantId: tenant?.id,
    companyId,
  };
}

export function useDebtInterestConfig(entityType: 'customer' | 'supplier', entityId: string | null) {
  const { data: tenant } = useCurrentTenant();
  const tenantId = tenant?.id;
  return useQuery({
    queryKey: ['debt-interest-config', tenantId, entityType, entityId],
    queryFn: async () => {
      if (!tenantId || !entityId) return null;
      const { data, error } = await supabase
        .from('debt_interest_configs')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('entity_type', entityType)
        .eq('entity_id', entityId)
        .maybeSingle();
      if (error) throw error;
      return data as InterestConfig | null;
    },
    enabled: !!tenantId && !!entityId,
  });
}

export function useDebtInterestPayments(entityType: 'customer' | 'supplier', entityId: string | null) {
  const { data: tenant } = useCurrentTenant();
  const tenantId = tenant?.id;
  return useQuery({
    queryKey: ['debt-interest-payments', tenantId, entityType, entityId],
    queryFn: async () => {
      if (!tenantId || !entityId) return [];
      const { data, error } = await supabase
        .from('debt_interest_payments')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('entity_type', entityType)
        .eq('entity_id', entityId)
        .order('paid_at', { ascending: false });
      if (error) throw error;
      return (data || []) as InterestPayment[];
    },
    enabled: !!tenantId && !!entityId,
  });
}

export function useSaveInterestConfig() {
  const qc = useQueryClient();
  const { data: tenant } = useCurrentTenant();
  return useMutation({
    mutationFn: async (input: {
      entity_type: 'customer' | 'supplier';
      entity_id: string;
      monthly_rate_percent: number;
      start_date?: string;
      existing_id?: string | null;
    }) => {
      if (!tenant?.id) throw new Error('Không xác định tenant');
      const { data: { user } } = await supabase.auth.getUser();
      if (input.existing_id) {
        const { error } = await supabase
          .from('debt_interest_configs')
          .update({
            monthly_rate_percent: input.monthly_rate_percent,
            is_active: true,
            ...(input.start_date ? { start_date: input.start_date } : {}),
          })
          .eq('id', input.existing_id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('debt_interest_configs').insert({
          tenant_id: tenant.id,
          entity_type: input.entity_type,
          entity_id: input.entity_id,
          monthly_rate_percent: input.monthly_rate_percent,
          start_date: input.start_date || new Date().toISOString(),
          is_active: true,
          created_by: user?.id,
        });
        if (error) throw error;
      }
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['debt-interest-config'] });
      toast.success('Đã lưu cấu hình lãi');
    },
    onError: (e: any) => toast.error(e.message || 'Lỗi lưu cấu hình'),
  });
}

export function useStopInterestConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('debt_interest_configs')
        .update({ is_active: false })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['debt-interest-config'] });
      toast.success('Đã dừng tính lãi');
    },
  });
}

export function usePayInterest() {
  const qc = useQueryClient();
  const { data: tenant } = useCurrentTenant();
  return useMutation({
    mutationFn: async (input: {
      entity_type: 'customer' | 'supplier';
      entity_id: string;
      amount: number;
      note?: string;
    }) => {
      if (!tenant?.id) throw new Error('Không xác định tenant');
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from('debt_interest_payments').insert({
        tenant_id: tenant.id,
        entity_type: input.entity_type,
        entity_id: input.entity_id,
        amount: input.amount,
        note: input.note || null,
        created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['debt-interest-payments'] });
      toast.success('Đã đóng lãi');
    },
    onError: (e: any) => toast.error(e.message || 'Lỗi đóng lãi'),
  });
}

export function useDeleteInterestPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('debt_interest_payments').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['debt-interest-payments'] });
      toast.success('Đã xóa phiếu đóng lãi');
    },
  });
}

/**
 * Compute accrued interest based on debt balance over time.
 * Simple interest, daily accrual, NOT compounded.
 * For each segment between debt-changing events:
 *   interest += balance * (monthlyRate/100) / 30 * days
 * Only counts from start_date onwards.
 */
export function useAccruedInterest(
  entityType: 'customer' | 'supplier',
  entityId: string | null,
  mergedEntityIds?: string[]
) {
  const { data: config } = useDebtInterestConfig(entityType, entityId);
  const { data: history } = useDebtPaymentHistory(entityType, entityId, mergedEntityIds);
  const { data: payments } = useDebtInterestPayments(entityType, entityId);

  return useMemo(() => {
    if (!config || !config.is_active || !config.monthly_rate_percent) {
      return {
        accrued: 0,
        paidInterest: 0,
        remainingInterest: 0,
        currentDebt: 0,
        config,
        startDate: config?.start_date || null,
      };
    }

    const start = new Date(config.start_date).getTime();
    const now = Date.now();
    if (now <= start) {
      return { accrued: 0, paidInterest: 0, remainingInterest: 0, currentDebt: 0, config, startDate: config.start_date };
    }

    // Build sorted events (addition +, payment -). Use balance_after if available.
    const events = (history || [])
      .map((p: any) => ({
        time: new Date(p.created_at).getTime(),
        balance_after: Number(p.balance_after) || 0,
      }))
      .sort((a, b) => a.time - b.time);

    // Find balance at start_date: last event <= start
    let balanceAtStart = 0;
    let firstEventAfterStartIdx = 0;
    for (let i = 0; i < events.length; i++) {
      if (events[i].time <= start) {
        balanceAtStart = events[i].balance_after;
        firstEventAfterStartIdx = i + 1;
      } else break;
    }

    const dailyRate = (Number(config.monthly_rate_percent) / 100) / 30;
    let accrued = 0;
    let cursor = start;
    let balance = balanceAtStart;

    for (let i = firstEventAfterStartIdx; i < events.length; i++) {
      const ev = events[i];
      const days = (ev.time - cursor) / (1000 * 60 * 60 * 24);
      if (days > 0 && balance > 0) {
        accrued += balance * dailyRate * days;
      }
      cursor = ev.time;
      balance = ev.balance_after;
    }
    // From last event to now
    const daysLast = (now - cursor) / (1000 * 60 * 60 * 24);
    if (daysLast > 0 && balance > 0) {
      accrued += balance * dailyRate * daysLast;
    }

    const paidInterest = (payments || []).reduce((s, p) => s + (Number(p.amount) || 0), 0);
    const remainingInterest = Math.max(0, accrued - paidInterest);

    return {
      accrued,
      paidInterest,
      remainingInterest,
      currentDebt: balance,
      config,
      startDate: config.start_date,
    };
  }, [config, history, payments]);
}