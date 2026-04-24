#!/usr/bin/env bash
# Rollback: đổi env frontend trở về Lovable Cloud nếu cutover fail
# Thực thi trên máy có quyền edit env Lovable project
set -euo pipefail

CLOUD_URL="https://rodpbhesrwykmpywiiyd.supabase.co"
CLOUD_ANON="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJvZHBiaGVzcnd5a21weXdpaXlkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0MjM4MDMsImV4cCI6MjA4NDk5OTgwM30.P7Kc0pxkUdyHi8AgDBlRmPqxg0MWr2C_J_EUqORQY_s"

echo "⚠️  ROLLBACK to Lovable Cloud"
echo "   URL  = $CLOUD_URL"
echo "   ANON = ${CLOUD_ANON:0:40}..."
echo
read -p "Xác nhận rollback? (yes/NO) " confirm
[[ "$confirm" != "yes" ]] && { echo "Đã hủy."; exit 1; }

# 1. Resume pg_cron jobs trên Cloud
echo "→ Resume pg_cron jobs (chạy thủ công trong Cloud SQL editor):"
cat <<'SQL'
SELECT cron.schedule('daily-backup','59 23 * * *',$$SELECT net.http_post('https://rodpbhesrwykmpywiiyd.supabase.co/functions/v1/daily-backup'::text,'{}'::jsonb)$$);
SELECT cron.schedule('auto-checkout','*/5 * * * *',$$SELECT auto_checkout_expired()$$);
SQL

# 2. Hướng dẫn đổi env Lovable
echo
echo "→ Vào Lovable project → Settings → Environment Variables, set:"
echo "    VITE_SUPABASE_URL=$CLOUD_URL"
echo "    VITE_SUPABASE_PUBLISHABLE_KEY=$CLOUD_ANON"
echo "  → Lovable sẽ tự rebuild frontend (~2 phút)."
echo
echo "→ Revert Google OAuth redirect URL về:"
echo "    $CLOUD_URL/auth/v1/callback"
echo
echo "✅ Rollback steps printed. Thực hiện thủ công các bước trên."