import { supabase } from '@/integrations/supabase/client';
import { DebtSummary } from '@/hooks/useDebt';
import { exportToExcel, formatDateForExcel } from '@/lib/exportExcel';
import { toast } from 'sonner';

export async function exportDebtToExcel(
  debt: DebtSummary,
  entityType: 'customer' | 'supplier'
) {
  try {
    toast.info('Đang xuất file Excel...');

    // Fetch receipts
    let receipts: any[] = [];
    if (entityType === 'customer') {
      const { data } = await supabase
        .from('export_receipts')
        .select('id, code, export_date, total_amount, paid_amount, debt_amount, original_debt_amount, note, status')
        .eq('customer_id', debt.entity_id)
        .in('status', ['completed', 'partial_return', 'full_return'])
        .order('export_date', { ascending: true });
      receipts = data || [];
    } else {
      const entityIds = debt.merged_entity_ids?.length ? debt.merged_entity_ids : [debt.entity_id];
      const { data } = await supabase
        .from('import_receipts')
        .select('id, code, import_date, total_amount, paid_amount, debt_amount, original_debt_amount, note')
        .in('supplier_id', entityIds)
        .eq('status', 'completed')
        .order('import_date', { ascending: true });
      receipts = data || [];
    }

    // Fetch payment history
    const entityIds = (entityType === 'supplier' && debt.merged_entity_ids?.length) ? debt.merged_entity_ids : [debt.entity_id];
    const { data: payments } = await supabase
      .from('debt_payments')
      .select('id, payment_type, amount, allocated_amount, description, created_at, balance_after, payment_source')
      .eq('entity_type', entityType)
      .in('entity_id', entityIds)
      .order('created_at', { ascending: true });

    const dateField = entityType === 'customer' ? 'export_date' : 'import_date';

    // Build timeline
    type TimelineItem = {
      date: string;
      type: string;
      code: string;
      description: string;
      debtAmount: number;
      paymentAmount: number;
      balanceAfter: number | null;
    };

    const timeline: TimelineItem[] = [];
    let runningBalance = 0;

    // Add receipts with debt
    for (const r of receipts) {
      const originalDebt = Number(r.original_debt_amount) || Math.max((Number(r.total_amount) || 0) - (Number(r.paid_amount) || 0), 0);
      if (originalDebt > 0) {
        runningBalance += originalDebt;
        timeline.push({
          date: r[dateField],
          type: 'Đơn hàng',
          code: r.code || '',
          description: r.note || '',
          debtAmount: originalDebt,
          paymentAmount: 0,
          balanceAfter: runningBalance,
        });
      }
    }

    // Add additions and payments
    for (const p of (payments || [])) {
      if (p.payment_type === 'addition') {
        runningBalance += Number(p.amount);
        timeline.push({
          date: p.created_at,
          type: 'Cộng nợ',
          code: '',
          description: p.description || '',
          debtAmount: Number(p.amount),
          paymentAmount: 0,
          balanceAfter: p.balance_after != null ? Number(p.balance_after) : runningBalance,
        });
      } else {
        runningBalance -= Number(p.amount);
        timeline.push({
          date: p.created_at,
          type: entityType === 'customer' ? 'Thu nợ' : 'Trả nợ',
          code: '',
          description: p.description || '',
          debtAmount: 0,
          paymentAmount: Number(p.amount),
          balanceAfter: p.balance_after != null ? Number(p.balance_after) : Math.max(0, runningBalance),
        });
      }
    }

    // Sort by date
    timeline.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Export
    const entityLabel = entityType === 'customer' ? 'Khách hàng' : 'Nhà cung cấp';
    const safeName = debt.entity_name.replace(/[^a-zA-Z0-9\u00C0-\u024F\u1E00-\u1EFF\s]/g, '').trim().substring(0, 30);

    exportToExcel({
      filename: `CongNo_${safeName}_${new Date().toISOString().slice(0, 10)}`,
      sheetName: 'Công nợ',
      columns: [
        { header: 'Ngày', key: 'date', width: 18, format: (v) => formatDateForExcel(v, 'dd/MM/yyyy HH:mm') },
        { header: 'Loại', key: 'type', width: 12 },
        { header: 'Mã phiếu', key: 'code', width: 16 },
        { header: 'Diễn giải', key: 'description', width: 30 },
        { header: 'Phát sinh nợ', key: 'debtAmount', width: 18, isNumeric: true, format: (v) => v || '' },
        { header: entityType === 'customer' ? 'Đã thu' : 'Đã trả', key: 'paymentAmount', width: 18, isNumeric: true, format: (v) => v || '' },
        { header: 'Dư nợ', key: 'balanceAfter', width: 18, isNumeric: true },
      ],
      data: [
        // Header info row
        { date: '', type: '', code: `${entityLabel}: ${debt.entity_name}`, description: debt.entity_phone || '', debtAmount: '', paymentAmount: '', balanceAfter: '' },
        { date: '', type: '', code: `Chi nhánh: ${debt.branch_name || ''}`, description: debt.entity_code || '', debtAmount: '', paymentAmount: '', balanceAfter: '' },
        { date: '', type: '', code: '', description: '', debtAmount: '', paymentAmount: '', balanceAfter: '' },
        ...timeline,
        // Summary row
        { date: '', type: '', code: '', description: 'TỔNG CỘNG', debtAmount: debt.total_amount, paymentAmount: debt.paid_amount, balanceAfter: debt.remaining_amount },
      ],
    });

    toast.success('Đã xuất file Excel');
  } catch (error) {
    console.error('Export error:', error);
    toast.error('Lỗi xuất file Excel');
  }
}
