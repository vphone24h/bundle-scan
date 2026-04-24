# Plan Migrate Lovable Cloud → Self-host (APPROVED)

> Phiên bản đã duyệt — context: 8F42B1C3-5D9E-4A7B-B2E1-9C3F4D5A6E7B
> Downtime mục tiêu: **< 30 phút** | Chiến lược: **Snapshot + Delta sync + DNS swap**

## ✅ Đánh giá secrets (file `all_env_secrets.json` từ function `get-all-secrets`)

### Có sẵn — đủ cho self-host:
| Loại | Secrets | Trạng thái |
|---|---|---|
| Supabase core (auto) | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL`, `SUPABASE_JWT_SECRET` | ✅ (sẽ thay bằng key self-host) |
| Email SMTP | `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_USER_2`, `SMTP_PASSWORD_2` | ✅ |
| Zalo OA | `ZALO_APP_ID`, `ZALO_APP_SECRET` | ✅ |
| Cloudflare | `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ZONE_ID` | ✅ |
| Lovable AI | `LOVABLE_API_KEY` | ⚠️ Mất khi rời Lovable — cần thay |

### ❌ Cần bổ sung trước cutover:
- `OPENAI_API_KEY` hoặc `GEMINI_API_KEY` (thay `LOVABLE_API_KEY`)
- `JWT_SECRET` mới sinh cho self-host (sẽ logout toàn bộ user — gửi mail báo trước 24h)
- `VAPID_*` đã có trong DB table `push_vapid_keys` → giữ nguyên

**Kết luận**: secrets đủ ~95%. Chỉ thiếu 1 key AI thay thế.

---

## 📅 Timeline tổng thể

```
Day -7  ──── Setup VPS + Supabase self-host + smoke test
Day -3  ──── Snapshot lần 1 (full dump + restore + verify)
Day -1  ──── Test cutover trên staging domain
Day  0  ──── Cutover thật (đêm CN, 23:00–23:30 ICT)
Day +7  ──── Pause Cloud project (rollback fallback 30 ngày)
```

---

## Phase 0 — Hạ tầng (2 ngày)

**VPS**: Hetzner CCX23 (4 vCPU dedicated, 16GB RAM, 160GB NVMe) — ~30€/tháng.

**Stack**:
```
Ubuntu 22.04 → Docker → supabase/docker (compose)
              ↓
Caddy reverse proxy + Let's Encrypt
  ├─ api.vkho.vn        → Kong :8000
  ├─ studio.vkho.vn     → Studio :3000 (basic-auth)
  └─ *.vkho.vn          → Cloudflare DNS (giữ nguyên)
```

**Backup**: Backblaze B2 (~$0.005/GB) cho daily pg_dump + storage snapshot.

---

## Phase 1 — Migrate Schema + Data (snapshot lần 1)

**1.1** Lấy connection string Postgres từ Lovable Cloud → Settings → Database
(host: `db.rodpbhesrwykmpywiiyd.supabase.co:5432`).

**1.2** Dump full (~30 phút):
```bash
pg_dump -h db.rodpbhesrwykmpywiiyd.supabase.co -U postgres \
  --schema=public --schema=auth --schema=storage \
  --no-owner --no-privileges -Fc -f full.dump
```

**1.3** Restore vào self-host:
```bash
pg_restore -h localhost -U postgres -d postgres \
  --disable-triggers --no-owner --no-privileges full.dump
psql -c "ANALYZE;"
# Reset toàn bộ sequences về MAX(id)+1
```

**1.4** Verify bằng `scripts/verify-migration.sh` (so sánh COUNT 50 bảng + MAX(created_at) + auth.users count).

---

## Phase 2 — Migrate Storage

```bash
rclone copy supabase-cloud:bucket-name ./storage/ --transfers=16
rclone copy ./storage/ supabase-self:bucket-name
```
Bucket policies đi kèm dump schema `storage` → tự động restore.

---

## Phase 3 — Edge Functions + Secrets

**3.1** Deploy 65 functions:
```bash
for fn in supabase/functions/*/; do
  supabase functions deploy "$(basename $fn)" --project-ref <self-host> --no-verify-jwt
done
```

**3.2** Import secrets từ `all_env_secrets.json` (lọc bỏ `SUPABASE_*`):
```bash
jq -r '.env_secrets | to_entries[]
  | select(.key | startswith("SUPABASE_") | not)
  | "\(.key)=\(.value)"' all_env_secrets.json \
  | xargs -I {} supabase secrets set {} --project-ref <self-host>
```

**3.3** Bổ sung AI key: `supabase secrets set OPENAI_API_KEY=sk-...`

**3.4** Re-create pg_cron jobs trỏ về `https://api.vkho.vn/functions/v1/...`:
- `daily-backup` (23:59 ICT)
- `auto_checkout_expired` (5 phút/lần)
- `run-automations`, `run-email-automations` (15 phút/lần)

---

## Phase 4 — Cutover (30 phút, đêm CN)

| Time | Action |
|---|---|
| 23:00 | Bật maintenance banner |
| 23:02 | Pause pg_cron Cloud + dừng webhook Zalo |
| 23:05 | **Delta dump** 10 bảng nóng (`scripts/delta-dump.sh`) |
| 23:15 | Restore delta + reset sequences |
| 23:20 | Verify (COUNT, login test, tạo phiếu test) |
| 23:25 | Đổi env Lovable: `VITE_SUPABASE_URL=https://api.vkho.vn` + `VITE_SUPABASE_PUBLISHABLE_KEY=<anon mới>` |
| 23:28 | Update Google OAuth redirect → `https://api.vkho.vn/auth/v1/callback` |
| 23:30 | Tắt maintenance, monitor 1 giờ |

**⚠️ Side-effects**:
- Toàn bộ user logout (JWT_SECRET mới) — gửi email báo trước 24h
- Custom domains giữ nguyên DNS frontend → user không cảm nhận

---

## Phase 5 — Hậu kiểm (7 ngày)

- [ ] Daily backup chạy được (verify trên B2)
- [ ] Smoke test 10 functions critical
- [ ] Báo cáo Dashboard chính xác
- [ ] Push notification + Zalo OA hoạt động
- [ ] `pg_stat_statements` không có query > 1s
- [ ] Sau 7 ngày → pause Cloud project (giữ 30 ngày rollback)

---

## 🔧 Scripts đã build sẵn

- `scripts/verify-migration.sh` — so sánh COUNT 50 bảng Cloud ↔ Self-host
- `scripts/delta-dump.sh` — dump rows mới từ snapshot time cho 10 bảng nóng
- `scripts/rollback.sh` — 1 lệnh đổi env về Cloud nếu cutover fail

---

## 💰 Chi phí vận hành

| Hạng mục | $/tháng |
|---|---|
| Hetzner CCX23 | ~32 |
| Block storage 160GB | ~6 |
| Backblaze B2 backup 200GB | ~3 |
| Cloudflare DNS | 0 |
| **Tổng** | **~41** |

---

## ⚠️ Rủi ro & Mitigation

| Rủi ro | Mitigation |
|---|---|
| Mất AI (LOVABLE_API_KEY) | Đăng ký OpenAI/Gemini key trước cutover |
| Sequence chưa reset → duplicate ID | Script auto reset sau restore |
| Storage URL public break | Giữ path identical, proxy qua Caddy |
| pg_cron không chạy | Verify ngay sau cutover + alert Telegram |
| VPS down | Snapshot daily + offsite B2 |

---

## ✅ Checklist Go/No-Go trước cutover

- [ ] Schema khớp 100%
- [ ] Data count khớp ≥ 99.99% (trừ delta)
- [ ] Auth login test pass
- [ ] ≥10 edge functions critical pass
- [ ] Storage files accessible
- [ ] Daily backup job chạy được
- [ ] OpenAI/Gemini key đã set
- [ ] Rollback script test thành công

---

# 📜 Phụ lục: Plan chi tiết ban đầu (giữ tham khảo)

## Mục tiêu

Mục tiêu: chuyển toàn bộ backend (DB Postgres + Auth + Storage + Edge Functions) hiện đang chạy trên Lovable Cloud (Supabase managed) sang một **Supabase self-host** trên VPS riêng, **giữ nguyên 100% dữ liệu**, **không gián đoạn dịch vụ quá 30 phút**, và frontend chỉ cần đổi `VITE_SUPABASE_URL` + `VITE_SUPABASE_PUBLISHABLE_KEY`.

---

## Phase 0 — Chuẩn bị (1–2 ngày)

### 0.1 Inventory hệ thống hiện tại
- [ ] Liệt kê toàn bộ bảng (~200+ tables trong `public`), enum, function, trigger, RLS policy → export schema.
- [ ] Liệt kê tất cả **Edge Functions** đang dùng (xem `supabase/config.toml`): `register-tenant`, `manage-tenant`, `send-*`, `cross-platform-restore-v3`, `zalo-oauth-callback`, `security-password`, `run-automations`, `daily-backup`...
- [ ] Liệt kê **Storage buckets** đang sử dụng (avatars, products, email-assets, backups...).
- [ ] Liệt kê **Secrets** (xem qua `secrets--fetch_secrets`): SMTP, Zalo, VAPID, LOVABLE_API_KEY, CLOUDFLARE...
- [ ] Liệt kê **pg_cron jobs** (daily-backup 23:59 ICT, run-automations, auto_checkout_expired...).
- [ ] Đo dung lượng DB hiện tại (`SELECT pg_database_size('postgres')`) và Storage.

### 0.2 Chọn hạ tầng VPS
| Hạng mục | Khuyến nghị |
|---|---|
| VPS | Hetzner CCX23 / DigitalOcean 4vCPU-8GB / Vultr HF | 
| OS | Ubuntu 22.04 LTS |
| RAM | ≥ 8GB (Postgres + Kong + GoTrue + Realtime + Storage) |
| Disk | ≥ 100GB SSD NVMe (DB + Storage bucket + backups) |
| Backup | Block storage / S3-compatible (Backblaze B2, Wasabi) |
| Domain | `api.vkho.vn` (REST), `studio.vkho.vn` (Studio UI) |

### 0.3 Cài Supabase self-host
- [ ] Clone `https://github.com/supabase/supabase` → `docker/`.
- [ ] Copy `.env.example` → `.env`, sinh `JWT_SECRET`, `ANON_KEY`, `SERVICE_ROLE_KEY`, `POSTGRES_PASSWORD` mới.
- [ ] Cấu hình SMTP (giữ giống Lovable Cloud để không vỡ luồng email).
- [ ] `docker compose up -d` → verify Studio chạy ok.
- [ ] Đặt **Caddy/Nginx** reverse proxy + Let's Encrypt cho `api.vkho.vn` → Kong (port 8000).

---

## Phase 1 — Migrate Schema (0.5 ngày)

### 1.1 Dump schema từ Lovable Cloud
```bash
# Cần xin Supabase connection string trực tiếp (Settings → Database)
pg_dump \
  --host=db.rodpbhesrwykmpywiiyd.supabase.co \
  --port=5432 --username=postgres \
  --schema-only \
  --no-owner --no-privileges \
  --schema=public --schema=auth --schema=storage \
  > schema.sql
```

### 1.2 Apply schema lên server mới
- [ ] Strip các phần thuộc về Supabase managed (extensions đã có sẵn trong image).
- [ ] `psql -h selfhost -f schema.sql`.
- [ ] Verify số bảng/function/policy khớp 100% bằng query so sánh:
  ```sql
  SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY 1;
  ```

---

## Phase 2 — Migrate Data (1 ngày, chạy đêm)

### 2.1 Chiến lược: **dump-restore + delta sync**
- **Window 1 (T-24h)**: dump toàn bộ data ban đầu (read-only snapshot, app vẫn hoạt động trên Cloud).
- **Window 2 (cutover, ~30 phút)**: bật maintenance mode → dump delta → restore → switch DNS.

### 2.2 Dump data
```bash
pg_dump \
  --data-only --disable-triggers \
  --schema=public --schema=auth --schema=storage \
  -h db.rodpbhesrwykmpywiiyd.supabase.co \
  -U postgres -Fc -f data.dump
```

### 2.3 Restore
```bash
pg_restore --data-only --disable-triggers \
  -h selfhost -U postgres -d postgres data.dump
# sau đó re-enable triggers + ANALYZE
psql -c "ANALYZE;"
```

### 2.4 Reset sequences
```sql
SELECT setval(pg_get_serial_sequence(quote_ident(t)||'.'||quote_ident(c), c),
  COALESCE((SELECT MAX(...))) FROM ...;
```

### 2.5 Verify dữ liệu
- [ ] So sánh `COUNT(*)` của 20 bảng quan trọng nhất (`tenants`, `products`, `sale_receipts`, `import_receipts`, `cash_book`, `attendance_records`, `user_roles`, `profiles`, `auth.users`...).
- [ ] So sánh `MAX(created_at)` để chắc chắn không miss record nào.
- [ ] Kiểm tra integrity: foreign keys, RLS active.

---

## Phase 3 — Migrate Auth (0.5 ngày)

- [ ] Auth users đã được dump cùng schema `auth` ở Phase 2 → password hashes (`bcrypt`) chuyển nguyên vẹn → user **không cần đổi mật khẩu**.
- [ ] Cấu hình lại providers: Email (giữ confirm), Google OAuth (đổi redirect URL về `https://api.vkho.vn/auth/v1/callback` + cập nhật trong Google Cloud Console).
- [ ] Migrate **JWT secret**: ⚠️ JWT_SECRET mới ≠ cũ → **tất cả session hiện tại sẽ bị logout** → thông báo trước cho khách hàng.
- [ ] Cập nhật `Site URL` và `Redirect URLs` trong GoTrue config khớp với các domain đang dùng (vkho.vn, *.vkho.vn, custom domains).

---

## Phase 4 — Migrate Storage (0.5 ngày)

### 4.1 Tải toàn bộ files
```bash
# dùng supabase CLI hoặc rclone
rclone copy supabase:bucket-name ./storage-backup/bucket-name
```

### 4.2 Upload lên self-host
```bash
rclone copy ./storage-backup selfhost:storage --transfers=8
```
Hoặc dùng script Node.js gọi `storage.from(bucket).upload()` cho từng object để giữ metadata.

### 4.3 Cấu hình bucket policies (đã được dump cùng schema `storage`).

---

## Phase 5 — Migrate Edge Functions (0.5 ngày)

- [ ] Toàn bộ source đã có trong repo (`supabase/functions/*`) → push lên self-host:
  ```bash
  supabase functions deploy --project-ref selfhost <function-name>
  ```
- [ ] Re-add **Secrets** (toàn bộ list từ 0.1) qua Supabase CLI: `supabase secrets set KEY=...`.
- [ ] Re-create **pg_cron jobs** trỏ tới URL mới (`https://api.vkho.vn/functions/v1/...`).
- [ ] Test từng function quan trọng: register-tenant, send-order-email, send-zalo-message, daily-backup, cross-platform-restore-v3.

---

## Phase 6 — Cutover (~30 phút, đêm chủ nhật)

| Time | Bước |
|---|---|
| T-30m | Bật maintenance banner ("Bảo trì hệ thống đến HH:MM") |
| T-25m | Stop pg_cron jobs trên Cloud |
| T-20m | Dump delta data (dữ liệu sinh ra từ Phase 2 → giờ) |
| T-10m | Restore delta vào self-host |
| T-5m | Update `VITE_SUPABASE_URL` + `VITE_SUPABASE_PUBLISHABLE_KEY` trong Lovable project + rebuild frontend |
| T-2m | Smoke test: login, tạo phiếu bán, xem báo cáo, gửi email |
| T-0 | Tắt maintenance, monitor logs |

⚠️ **Lưu ý**: file `src/integrations/supabase/client.ts` được Lovable auto-generate từ env. Sau cutover, env mới được apply thì client tự trỏ về self-host.

---

## Phase 7 — Hậu kiểm (3–7 ngày)

- [ ] Monitor pg log, edge function log, error rate.
- [ ] Verify backup tự động hoạt động (daily-backup 23:59).
- [ ] Test scenario edge: payment notification, attendance check-in, push notification, Zalo OA.
- [ ] Theo dõi performance: `pg_stat_statements`, slow query log.
- [ ] Sau 7 ngày ổn định → **giữ Cloud project ở trạng thái paused** thêm 30 ngày làm rollback fallback.

---

## Rủi ro & Mitigation

| Rủi ro | Mức độ | Mitigation |
|---|---|---|
| Mất dữ liệu khi dump | Cao | Dump 2 lần (Phase 2 + delta), verify count |
| JWT secret đổi → user logout | Trung | Thông báo trước 24h, gửi email |
| Edge functions secret thiếu | Trung | Checklist đầy đủ ở Phase 0.1, test ở Phase 5 |
| pg_cron không chạy | Trung | Verify ngay sau cutover, có alert |
| Storage URL public bị break | Cao | Giữ path identical, đổi domain qua proxy |
| Custom domain (depadian.com, …) | Cao | Giữ nguyên DNS A record trỏ về VPS, Caddy multi-domain |
| VPS down | Cao | Snapshot daily + offsite backup S3 |

---

## Chi phí ước tính

| Hạng mục | $/tháng |
|---|---|
| VPS Hetzner CCX23 (4vCPU, 16GB) | ~30 |
| Block storage 100GB | ~5 |
| Backup S3 (B2) 200GB | ~3 |
| Cloudflare (DNS + SSL) | 0 |
| **Tổng** | **~38** |

So với Lovable Cloud usage hiện tại → tiết kiệm đáng kể khi quy mô lớn, nhưng phải tự vận hành (monitor, patch, backup).

---

## Checklist Go/No-Go trước cutover

- [ ] Schema khớp 100%
- [ ] Data count khớp ≥ 99.99% (trừ delta)
- [ ] Auth login test pass
- [ ] Edge functions test pass (≥ 10 functions chính)
- [ ] Storage files accessible
- [ ] Backup job chạy được
- [ ] Rollback plan: nếu fail → đổi env về Cloud trong < 5 phút
