

## Problem

"Lợi nhuận kinh doanh" (Business Profit) currently only counts profit from sold items. It does not subtract the profit lost from returned orders. The detailed history table (tab "Chi tiết đơn hàng") correctly includes both sold and returned items, so its total differs from the summary card.

**Example from screenshots:**
- Sold profit: +1.49M + 3.79M + 3.29M = +8.57M
- Return profit loss: -4.4M
- Correct business profit: **+4.17M** (matches history total +4.2Tr)
- Current display: **8.57M** (missing return deduction)

## Changes

### 1. Update RPC `get_report_stats_aggregated` (database migration)

Modify the `_business_profit` calculation to subtract the profit loss from returned items (`export_returns` with `fee_type = 'none'`):

```sql
-- After calculating sold profit, subtract return profit loss:
_business_profit := _business_profit - (
  SELECT COALESCE(SUM(ret.sale_price - COALESCE(p.import_price, 0)), 0)
  FROM export_returns ret
  LEFT JOIN products p ON p.id = ret.product_id
  WHERE ret.tenant_id = p_tenant_id
    AND ret.fee_type = 'none'
    AND ret.return_date >= p_start_iso
    AND ret.return_date <= p_end_iso
    AND (p_branch_id IS NULL OR ret.branch_id = p_branch_id)
    AND (p_category_id IS NULL OR p.category_id = p_category_id)
);
```

Also update `netProfit` accordingly since it depends on `businessProfit`.

### 2. Update detail dialog for `businessProfit` case

In `src/components/reports/ReportStatDetailDialog.tsx`, change the `businessProfit` case to show both sold items and returned items (similar to `netRevenue` layout), with a summary header showing:
- Lợi nhuận bán hàng (from sold items)
- Trừ lợi nhuận trả hàng (from returns)
- = Lợi nhuận kinh doanh

Display both `salesDetails` and `returnDetails` lists below.

### 3. Update summary description

In `src/components/reports/RevenueProfitReport.tsx`, update the note for business profit from `'Σ(Giá bán - Giá nhập)'` to `'Σ Lãi bán - Σ Lãi trả hàng'` to reflect the new formula.

