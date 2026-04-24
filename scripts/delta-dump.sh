#!/usr/bin/env bash
# Delta dump: chỉ dump rows mới/sửa từ SNAPSHOT_TIME đến giờ cho 10 bảng nóng
# Usage:
#   SRC_DB_URL=... DST_DB_URL=... SNAPSHOT_TIME='2026-04-24 18:00:00+07' \
#     ./scripts/delta-dump.sh
set -euo pipefail

: "${SRC_DB_URL:?SRC_DB_URL chưa set}"
: "${DST_DB_URL:?DST_DB_URL chưa set}"
: "${SNAPSHOT_TIME:?SNAPSHOT_TIME chưa set (vd: '2026-04-24 18:00:00+07')}"

OUT_DIR="${OUT_DIR:-./delta_$(date +%Y%m%d_%H%M%S)}"
mkdir -p "$OUT_DIR"

# Bảng nóng (high-write) — bổ sung khi cần
HOT_TABLES=(
  sale_receipts sale_receipt_items
  import_receipts import_receipt_items
  return_receipts return_receipt_items
  cash_book
  attendance_records
  chat_messages
  landing_orders
  audit_logs
  crm_notifications
  customer_care_logs
)

echo "📤 Dumping delta từ $SNAPSHOT_TIME ..."
for t in "${HOT_TABLES[@]}"; do
  echo "  → $t"
  psql "$SRC_DB_URL" -c "\COPY (SELECT * FROM public.\"$t\" WHERE COALESCE(updated_at, created_at) > '$SNAPSHOT_TIME') TO '$OUT_DIR/$t.csv' WITH CSV HEADER"
done

echo
echo "📥 Restoring delta vào self-host (UPSERT theo id) ..."
for t in "${HOT_TABLES[@]}"; do
  rows=$(wc -l < "$OUT_DIR/$t.csv")
  echo "  → $t ($((rows - 1)) rows)"
  if [[ $rows -le 1 ]]; then continue; fi

  # Tạo bảng tạm + COPY vào + UPSERT vào bảng thật
  psql "$DST_DB_URL" <<SQL
CREATE TEMP TABLE _tmp_$t (LIKE public."$t" INCLUDING DEFAULTS);
\\COPY _tmp_$t FROM '$OUT_DIR/$t.csv' WITH CSV HEADER;
INSERT INTO public."$t" SELECT * FROM _tmp_$t
  ON CONFLICT (id) DO UPDATE SET
  $(psql "$DST_DB_URL" -tAc "SELECT string_agg(quote_ident(column_name)||'=EXCLUDED.'||quote_ident(column_name), ',') FROM information_schema.columns WHERE table_schema='public' AND table_name='$t' AND column_name <> 'id'");
DROP TABLE _tmp_$t;
SQL
done

echo
echo "🔄 Resetting sequences ..."
psql "$DST_DB_URL" <<'SQL'
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT n.nspname AS schema, c.relname AS seq, t.relname AS tbl, a.attname AS col
    FROM pg_class c
    JOIN pg_namespace n ON n.oid=c.relnamespace
    JOIN pg_depend d ON d.objid=c.oid
    JOIN pg_class t ON t.oid=d.refobjid
    JOIN pg_attribute a ON a.attrelid=t.oid AND a.attnum=d.refobjsubid
    WHERE c.relkind='S' AND n.nspname='public'
  LOOP
    EXECUTE format('SELECT setval(%L, COALESCE((SELECT MAX(%I)+1 FROM %I.%I), 1), false)',
                   r.schema||'.'||r.seq, r.col, r.schema, r.tbl);
  END LOOP;
END$$;
SQL

echo "✅ Delta sync xong. Chạy verify-migration.sh để xác nhận."