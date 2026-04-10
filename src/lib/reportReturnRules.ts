const FULL_REFUND_TOLERANCE = 1;

interface ReturnRevenueCheckInput {
  feeType?: string | null;
  refundAmount?: number | string | null;
  salePrice?: number | string | null;
  quantity?: number | string | null;
  hasNewImportReceipt?: boolean | null;
}

export function doesReturnAffectRevenue(input: ReturnRevenueCheckInput) {
  const normalizedFeeType = String(input.feeType ?? '').trim().toLowerCase();

  if (input.hasNewImportReceipt) {
    return false;
  }

  if (normalizedFeeType && normalizedFeeType !== 'none') {
    return false;
  }

  const quantity = Number(input.quantity ?? 1) || 1;
  const refundAmount = Number(input.refundAmount ?? 0) || 0;
  const originalSaleTotal = (Number(input.salePrice ?? 0) || 0) * quantity;

  if (originalSaleTotal <= 0) return false;

  if (refundAmount <= 0) return true;

  return Math.abs(refundAmount - originalSaleTotal) <= FULL_REFUND_TOLERANCE;
}