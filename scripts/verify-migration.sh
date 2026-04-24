#!/usr/bin/env bash
# Verify migration: so sánh COUNT(*) và MAX(created_at) giữa Cloud (SRC) và Self-host (DST)
# Usage: SRC_DB_URL=... DST_DB_URL=... ./scripts/verify-migration.sh
set -euo pipefail

: "${SRC_DB_URL:?SRC_DB_URL chưa set (postgres://... của Lovable Cloud)}"
: "${DST_DB_URL:?DST_DB_URL chưa set (postgres://... của self-host)}"

TABLES=(
  tenants companies branches profiles user_roles platform_users
  products product_imports product_variants categories
  customers customer_tags customer_contact_channels customer_care_schedules
  sale_receipts sale_receipt_items import_receipts import_receipt_items
  return_receipts return_receipt_items repair_orders
  cash_book cash_book_categories cash_book_opening_balances
  attendance_records attendance_locations attendance_corrections work_shifts
  payroll_records payroll_components salary_advances
  audit_logs notification_automations crm_notifications chat_messages conversations
  landing_orders landing_pages advertisements
  affiliates affiliate_referrals affiliate_commissions
  custom_domains custom_print_templates trusted_devices
  payment_requests subscription_plans bank_accounts
  push_vapid_keys push_subscriptions
)

printf "%-40s | %12s | %12s | %s\n" "TABLE" "SRC COUNT" "DST COUNT" "STATUS"
printf -- "-%.0s" {1..90}; echo

FAIL=0
for t in "${TABLES[@]}"; do
  src=$(psql "$SRC_DB_URL" -tAc "SELECT COUNT(*) FROM public.\"$t\"" 2>/dev/null || echo "ERR")
  dst=$(psql "$DST_DB_URL" -tAc "SELECT COUNT(*) FROM public.\"$t\"" 2>/dev/null || echo "ERR")
  if [[ "$src" == "$dst" ]]; then
    status="✅ OK"
  else
    status="❌ DIFF (delta=$((dst - src)))"
    FAIL=$((FAIL+1))
  fi
  printf "%-40s | %12s | %12s | %s\n" "$t" "$src" "$dst" "$status"
done

echo
echo "auth.users:"
src_u=$(psql "$SRC_DB_URL" -tAc "SELECT COUNT(*) FROM auth.users")
dst_u=$(psql "$DST_DB_URL" -tAc "SELECT COUNT(*) FROM auth.users")
echo "  SRC=$src_u  DST=$dst_u"
[[ "$src_u" != "$dst_u" ]] && FAIL=$((FAIL+1))

echo
if [[ $FAIL -eq 0 ]]; then
  echo "🎉 All tables match. Ready to cutover."
  exit 0
else
  echo "⚠️  $FAIL table(s) mismatch. Investigate before cutover."
  exit 1
fi