# 🚀 Kế hoạch Migrate Lovable Cloud → Self-host (Tối ưu)

> Mục tiêu: Zero data loss, downtime ≤ 20 phút, có rollback < 5 phút.
> Dữ liệu hiện tại: ~200+ tables `public` + `auth` + `storage` + 28+ Edge Functions + pg_cron jobs + nhiều custom domain (vkho.vn, vphone.vn, depadian.com, …).

---

## 📋 Secrets Checklist (làm TRƯỚC mọi thứ)

### Đã có ✅
`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ZONE_ID`, `SMTP_USER(_2)`, `SMTP_PASSWORD(_2)`, `ZALO_APP_ID`, `ZALO_APP_SECRET`

### Cần thêm trước khi bắt đầu ❌
| Secret | Cách lấy |
|---|---|
| `SUPABASE_DB_URL_SOURCE` | Cloud Settings → Database → Connection string (Session pooler, port 5432) |
| `SUPABASE_SERVICE_ROLE_KEY_SOURCE` | Cloud Settings → API → service_role key |
| `VPS_HOST` / `VPS_SSH_USER` | IP + user của VPS đã thuê |
| `NEW_POSTGRES_PASSWORD` | Tự sinh 32 ký tự random |
| `NEW_JWT_SECRET` | `openssl rand -base64 64` |
| `NEW_ANON_KEY` / `NEW_SERVICE_ROLE_KEY` | Sinh bằng https://supabase.com/docs/guides/self-hosting#generate-api-keys |
| `OPENAI_API_KEY` (hoặc `GEMINI_API_KEY`) | Thay `LOVABLE_API_KEY` (Lovable AI Gateway sẽ không còn truy cập sau khi rời Cloud) |
| `S3_BACKUP_ACCESS_KEY` / `S3_BACKUP_SECRET_KEY` | Backblaze B2 hoặc Wasabi (offsite backup) |

---

## Phase 0 — Chuẩn bị hạ tầng (Day 1)

### 0.1 Chọn VPS
- **Khuyến nghị**: Hetzner CCX23 (4 vCPU dedicated, 16GB, 160GB NVMe, ~€30/tháng) hoặc DigitalOcean Premium 4vCPU/8GB.
- OS: **Ubuntu 24.04 LTS**.
- Mở port: 22 (SSH), 80, 443.
- Cài Docker + Docker Compose + Caddy.

### 0.2 Setup Supabase self-host stack
```bash
git clone --depth 1 https://github.com/supabase/supabase /opt/supabase
cd /opt/supabase/docker
cp .env.example .env
# Điền: POSTGRES_PASSWORD, JWT_SECRET, ANON_KEY, SERVICE_ROLE_KEY,
#       SMTP_*, SITE_URL=https://vkho.vn,
#       ADDITIONAL_REDIRECT_URLS=https://*.vkho.vn,https://depadian.com,...
docker compose pull
docker compose up -d
```

### 0.3 Cấu hình Caddy (multi-domain wildcard)
```caddyfile
api.vkho.vn {
  reverse_proxy localhost:8000   # Kong (Supabase API gateway)
}
studio.vkho.vn {
  basicauth { admin <hashed> }
  reverse_proxy localhost:3000
}
# App frontend
vkho.vn, www.vkho.vn, *.vkho.vn,
depadian.com, *.depadian.com,
vphone.vn, *.vphone.vn,
nguyenkieuanh.net, www.nguyenkieuanh.net,
iphonebaonoxau.com, www.iphonebaonoxau.com,
tuanapple.com, www.tuanapple.com,
thkho.com, www.thkho.com {
  tls { dns cloudflare {env.CLOUDFLARE_API_TOKEN} }
  reverse_proxy localhost:5173
}
```

### 0.4 Cấu hình backup tự động
- Cron daily 02:00 ICT: `pg_dump | gzip | rclone copy → b2:vkho-backups/`
- Giữ 30 ngày.

---

## Phase 1 — Migrate Schema (2 giờ)

```bash
# Trên máy local, KHÔNG dump data
pg_dump "$SUPABASE_DB_URL_SOURCE" \
  --schema-only --no-owner --no-privileges \
  --schema=public --schema=auth --schema=storage \
  --exclude-schema=supabase_functions \
  -f schema.sql

# Strip extension creates đã có sẵn trong image
sed -i '/CREATE EXTENSION/d' schema.sql

# Apply lên self-host
psql "postgres://postgres:$NEW_POSTGRES_PASSWORD@$VPS_HOST:5432/postgres" -f schema.sql
```

**Verify**:
```sql
SELECT schemaname, COUNT(*) FROM pg_tables
WHERE schemaname IN ('public','auth','storage') GROUP BY 1;
-- Phải khớp 100% giữa source và target
```

---

## Phase 2 — Initial Data Sync (đêm trước cutover, app vẫn live)

Chiến lược: **dump full data đêm T-1, delta sync ở cutover**.

```bash
# T-24h: dump toàn bộ data (app vẫn chạy bình thường)
pg_dump "$SUPABASE_DB_URL_SOURCE" \
  --data-only --disable-triggers \
  --schema=public --schema=auth --schema=storage \
  --exclude-table-data='auth.audit_log_entries' \
  --exclude-table-data='public.audit_logs' \
  -Fc -f data_initial.dump

pg_restore --data-only --disable-triggers \
  -h $VPS_HOST -U postgres -d postgres \
  -j 4 data_initial.dump

# Reset sequences
psql -h $VPS_HOST -c "
SELECT 'SELECT setval(''' || sequence_schema || '.' || sequence_name || ''','
  || 'COALESCE((SELECT MAX(' || quote_ident(column_name) || ')+1 FROM '
  || table_schema || '.' || table_name || '), 1), false);'
FROM information_schema.sequences ...;" | psql -h $VPS_HOST -f -

ANALYZE;
```

### Migrate Storage (parallel với DB)
```bash
# Dùng rclone với supabase remote
rclone sync supabase-source:/ supabase-target:/ \
  --transfers=16 --checkers=32 --progress
```

---

## Phase 3 — Edge Functions & Cron (ngày T-1)

### 3.1 Deploy Edge Functions
```bash
# 28 functions trong supabase/config.toml
supabase link --project-ref selfhost
supabase functions deploy --project-ref selfhost
```

### 3.2 Set runtime secrets trên self-host
```bash
supabase secrets set \
  SMTP_USER=... SMTP_PASSWORD=... \
  ZALO_APP_ID=... ZALO_APP_SECRET=... \
  OPENAI_API_KEY=... \   # thay LOVABLE_API_KEY
  CLOUDFLARE_API_TOKEN=... \
  VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=...
```

### 3.3 Re-create pg_cron jobs
```sql
-- Trỏ tới URL mới
SELECT cron.schedule('daily-backup', '59 23 * * *',
  $$SELECT net.http_post('https://api.vkho.vn/functions/v1/daily-backup',
    headers:='{"Authorization":"Bearer ...service_role..."}'::jsonb)$$);
-- Lặp lại cho: run-automations, auto-checkout, run-email-automations, ...
```

### 3.4 Tìm & thay tham chiếu `LOVABLE_API_KEY` trong code edge functions
```bash
grep -r "LOVABLE_API_KEY\|ai.gateway.lovable" supabase/functions/
# Thay bằng OpenAI/Gemini SDK trực tiếp
```

---

## Phase 4 — Cutover (Sunday 02:00 ICT, ~20 phút)

| Time | Bước | Owner |
|---|---|---|
| T-30m | Bật banner bảo trì trên frontend | Dev |
| T-25m | Disable pg_cron jobs trên Cloud (tránh ghi mới) | Dev |
| T-25m | Set DB Cloud về **read-only**: `ALTER DATABASE postgres SET default_transaction_read_only = on;` | Dev |
| T-20m | Dump **delta** (data từ T-24h đến giờ): `pg_dump --data-only --where="updated_at > '<T-24h>'"` cho các bảng nóng (sale_receipts, cash_book, attendance_records, products, …) | Script |
| T-15m | Restore delta vào self-host | Script |
| T-12m | rclone sync Storage delta | Script |
| T-10m | Verify counts: chạy script so sánh `COUNT(*)` + `MAX(updated_at)` cho 30 bảng nóng | Script |
| T-7m | Update `VITE_SUPABASE_URL=https://api.vkho.vn` + `VITE_SUPABASE_PUBLISHABLE_KEY=$NEW_ANON_KEY` trong Lovable env | Dev |
| T-5m | Trigger Lovable rebuild (publish) | Dev |
| T-3m | Đổi DNS các custom domain (Cloudflare) trỏ về VPS IP — TTL đã set 60s từ trước | Dev |
| T-2m | Smoke test: login (3 role), tạo phiếu bán, in tem, gửi email test, chấm công, push notification | QA |
| T-0 | Tắt banner bảo trì | Dev |

⚠️ **JWT secret đổi → tất cả user hiện đang đăng nhập sẽ bị logout**. Gửi email báo trước 24h.

---

## Phase 5 — Hậu kiểm (Day +1 đến +7)

- [ ] Monitor `docker logs supabase-db` không có ERROR
- [ ] Verify `daily-backup` chạy lúc 23:59
- [ ] Check Edge Function logs: error rate < 0.1%
- [ ] So sánh báo cáo doanh thu hôm nay với cùng kỳ tuần trước
- [ ] Test Zalo OAuth callback URL mới
- [ ] Test Google OAuth (cập nhật redirect URI trong Google Cloud Console: `https://api.vkho.vn/auth/v1/callback`)
- [ ] Verify push notification hoạt động (VAPID key mới)
- [ ] Sau 7 ngày ổn định → **archive** Cloud project (không xóa, giữ làm fallback 30 ngày)

---

## 🔄 Rollback (< 5 phút)

Nếu cutover fail:
1. Revert env Lovable: `VITE_SUPABASE_URL` về Cloud cũ → publish.
2. Revert DNS custom domain về Lovable IP.
3. `ALTER DATABASE postgres SET default_transaction_read_only = off;` trên Cloud.
4. Re-enable pg_cron trên Cloud.

Tổng thời gian rollback: **3–5 phút**. Đó là lý do giữ Cloud project paused 30 ngày.

---

## 🚨 Rủi ro & Mitigation

| # | Rủi ro | Mức | Mitigation |
|---|---|---|---|
| 1 | Mất data delta | Cao | Dump 2 lần (initial + delta) + read-only mode khi cutover |
| 2 | Lovable AI Gateway mất | Cao | Thay bằng OpenAI/Gemini direct trước cutover, test kỹ |
| 3 | JWT mới → user logout | Trung | Email thông báo 24h trước |
| 4 | DNS propagation chậm | Trung | Set TTL=60s từ T-48h |
| 5 | Custom domain SSL fail | Cao | Pre-provision certs bằng Caddy + Cloudflare DNS challenge từ T-24h |
| 6 | pg_cron không chạy | Trung | Verify ngay sau cutover bằng `SELECT * FROM cron.job_run_details` |
| 7 | Storage URL trong DB hardcode domain Cloud | Cao | Search & replace: `UPDATE products SET image_url = REPLACE(image_url, 'rodpbhesrwykmpywiiyd.supabase.co', 'api.vkho.vn')` |
| 8 | Edge function timeout do cold start | Thấp | Warm-up cron mỗi 5 phút cho function nóng |
| 9 | VPS down | Cao | Snapshot daily Hetzner + offsite B2 backup |

---

## 💰 Chi phí ước tính

| Hạng mục | $/tháng |
|---|---|
| VPS Hetzner CCX23 | ~32 |
| Volume backup 100GB | ~5 |
| Backblaze B2 (200GB) | ~3 |
| OpenAI API (~thay Lovable AI) | tùy usage, ~10–50 |
| Cloudflare | 0 |
| **Tổng** | **~50/tháng** |

---

## ✅ Go/No-Go Checklist (chạy ngay trước cutover)

- [ ] Tất cả 8 secret thiếu đã được thêm
- [ ] Schema diff = 0
- [ ] Initial data count khớp ≥ 99.9% (trừ delta đang sinh)
- [ ] Storage count khớp 100%
- [ ] Login test pass với 3 role (super_admin, branch_admin, staff)
- [ ] 10 Edge Function chính test pass: register-tenant, send-order-email, send-zalo-message, daily-backup, run-automations, send-push, security-password, manage-tenant, approve-payment, cross-platform-restore-v3
- [ ] Backup script đã chạy thành công ít nhất 1 lần
- [ ] Rollback đã được rehearsal trên môi trường staging
- [ ] Email thông báo bảo trì đã gửi 24h trước
