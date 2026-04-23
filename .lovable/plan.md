

# Kế hoạch Migrate sang Self-host (Supabase tự host)

## 1. Đánh giá file `all_env_secrets.json` hiện tại

**Kết luận: CHƯA ĐỦ.** File hiện tại chỉ là env của sandbox build, thiếu các secret runtime quan trọng nhất.

| Secret | Trạng thái | Ghi chú |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | ❌ THIẾU | Bắt buộc cho ~60 edge functions. Self-host sẽ tự sinh mới khi `supabase start` |
| `EINVOICE_ENCRYPTION_KEY` | ❌ THIẾU | Dùng để mã hóa cấu hình hóa đơn điện tử trong DB |
| `RESEND_API_KEY` | ❌ THIẾU | Dùng cho gửi email (nếu có function dùng Resend) |
| `SUPABASE_ANON_KEY` | ⚠️ Cần đổi | Self-host sinh key mới |
| `SUPABASE_URL` / `SUPABASE_DB_URL` | ⚠️ Cần đổi | Trỏ về domain self-host |
| `ZALO_APP_ID/SECRET`, `SMTP_*`, `CLOUDFLARE_*`, `LOVABLE_API_KEY` | ✅ Đã có | Copy nguyên sang self-host |

## 2. Kiến trúc Self-host đề xuất

```text
VPS (Ubuntu 22.04, 4GB RAM, 80GB SSD) — đề xuất Hetzner CX22 (~€4/tháng) hoặc DigitalOcean 4GB (~$24)
├── Docker + supabase/cli (self-hosted Supabase stack)
│   ├── PostgreSQL 15  (port 5432, internal)
│   ├── PostgREST      (REST API)
│   ├── GoTrue         (Auth)
│   ├── Storage API    + bucket trên local disk hoặc S3/R2
│   ├── Realtime
│   ├── Edge Runtime   (Deno — chạy supabase/functions/*)
│   └── Kong gateway   (port 8000)
├── Caddy / Traefik    (reverse proxy + SSL wildcard *.vkho.vn)
└── App build (Vite SPA)  → serve qua Caddy port 443
```

## 3. Lộ trình thực hiện (7 bước)

### Bước 1 — Hoàn thiện export dữ liệu (làm trên Lovable Cloud trước khi rời)
- Đăng nhập preview với tài khoản **platform_admin** → gọi edge `export-all-data` → tải file `full_selfhost_export_*.json` (chứa **toàn bộ public tables + auth.users + env_secrets động**)
- Backup riêng:
  - `pg_dump` schema + data qua `SUPABASE_DB_URL` đã có sẵn
  - Copy toàn bộ Storage buckets bằng edge `export-storage`

### Bước 2 — Lấy 3 secret còn thiếu
- `SUPABASE_SERVICE_ROLE_KEY`: Lovable Cloud → **Connectors → Lovable Cloud → View Backend** → Project Settings → API → copy `service_role` key. (Hoặc bỏ qua vì self-host sẽ sinh key mới)
- `EINVOICE_ENCRYPTION_KEY`: lấy từ Lovable secret store (UI Connectors). **Bắt buộc copy nguyên** vì dùng để giải mã dữ liệu đã lưu trong DB. Nếu mất → dữ liệu einvoice bị mã hóa không thể đọc.
- `RESEND_API_KEY`: lấy từ tài khoản Resend (nếu có dùng).

### Bước 3 — Dựng Supabase self-host trên VPS
```bash
git clone --depth 1 https://github.com/supabase/supabase
cd supabase/docker
cp .env.example .env
# Chỉnh .env: POSTGRES_PASSWORD, JWT_SECRET, ANON_KEY, SERVICE_ROLE_KEY, SITE_URL, API_EXTERNAL_URL
docker compose up -d
```
Sinh JWT mới: `openssl rand -base64 64` → dùng [supabase JWT generator](https://supabase.com/docs/guides/self-hosting#api-keys) để tạo `ANON_KEY` & `SERVICE_ROLE_KEY` mới.

### Bước 4 — Restore dữ liệu
1. **Restore schema**: chạy lại tất cả file trong `supabase/migrations/` theo thứ tự (`supabase db push` hoặc `psql -f`).
2. **Restore auth.users**: dùng admin API `auth.admin.createUser()` từ `auth_users[]` trong file export (giữ nguyên `id` UUID để FK không vỡ).
3. **Restore public tables**: load `data{}` từ JSON, INSERT theo thứ tự dependency:
   - `companies` → `tenants` → `branches` → `profiles` → `platform_users` → `user_roles`
   - `categories` → `products` → `import_receipts` → `export_receipts` → ...
   - Backup tables và logs cuối cùng.
4. **Restore Storage**: copy file từ bundle export-storage vào `volumes/storage/` của Supabase Docker.

### Bước 5 — Cấu hình env cho self-host
Tạo file `.env` cho stack self-host gồm:
```env
# Từ all_env_secrets.json (giữ nguyên)
ZALO_APP_ID=...
ZALO_APP_SECRET=...
SMTP_USER=...
SMTP_PASSWORD=...
SMTP_USER_2=...
SMTP_PASSWORD_2=...
CLOUDFLARE_API_TOKEN=...
CLOUDFLARE_ZONE_ID=...
LOVABLE_API_KEY=...

# Bổ sung mới
EINVOICE_ENCRYPTION_KEY=<copy từ Lovable secret>
RESEND_API_KEY=<copy từ Resend dashboard>

# Tự sinh mới (KHÁC bản Lovable Cloud)
SUPABASE_URL=https://api.vkho.vn
SUPABASE_ANON_KEY=<JWT mới>
SUPABASE_SERVICE_ROLE_KEY=<JWT mới>
SUPABASE_DB_URL=postgresql://postgres:<pwd>@db:5432/postgres
```

### Bước 6 — Deploy edge functions
```bash
supabase functions deploy --project-ref local
# hoặc copy thư mục supabase/functions/ vào volume edge-runtime
```
Inject env vào edge runtime qua `docker-compose.override.yml`.

### Bước 7 — Build & deploy frontend
- Sửa `.env` của Vite:
  ```
  VITE_SUPABASE_URL=https://api.vkho.vn
  VITE_SUPABASE_ANON_KEY=<anon key mới>
  VITE_SUPABASE_PROJECT_ID=selfhost
  ```
- `npm run build` → upload `dist/` lên VPS → Caddy serve.
- Cấu hình Caddy theo `docs/VPS_DEPLOYMENT_GUIDE.md` đã có sẵn (wildcard `*.vkho.vn`).

## 4. Checklist kiểm thử sau migrate

- [ ] Login bằng tài khoản platform_admin cũ (mật khẩu giữ nguyên do dùng `auth.users.encrypted_password`)
- [ ] Tenant resolve qua subdomain (`storeid.vkho.vn`)
- [ ] Sản phẩm, tồn kho, công nợ hiển thị đúng
- [ ] In tem, xuất Excel hoạt động
- [ ] Gửi mail SMTP, gửi Zalo OA hoạt động
- [ ] Realtime (chat, notification) hoạt động
- [ ] Cron jobs (`pg_cron` cho `daily-backup`) chạy đúng — cần cài extension `pg_cron` trong Postgres self-host
- [ ] Storage upload ảnh sản phẩm, logo

## 5. Rủi ro & lưu ý

- **`pg_cron`** mặc định không bật trong Supabase self-host → chạy `CREATE EXTENSION pg_cron;` và sửa `postgresql.conf`: `cron.database_name = 'postgres'`.
- **`auth.users` passwords**: chỉ migrate được nếu giữ nguyên `JWT_SECRET` cũ. Vì Lovable không cho lấy `JWT_SECRET`, người dùng sẽ phải **đặt lại mật khẩu lần đầu** sau migrate. Hoặc dùng admin API tạo user kèm password gốc (không khả thi vì không có cleartext).
  - **Giải pháp khuyến nghị**: gửi email reset password hàng loạt sau migrate.
- **`EINVOICE_ENCRYPTION_KEY` bắt buộc giống bản cũ**, nếu mất sẽ không giải mã được cấu hình einvoice đã lưu.
- **Storage URLs**: tất cả URL ảnh trong DB đang trỏ về `rodpbhesrwykmpywiiyd.supabase.co` → cần chạy script UPDATE batch để đổi domain sang `api.vkho.vn`.

## 6. Hành động tiếp theo (khi user phê duyệt)

1. Cập nhật edge `export-all-data` để bổ sung cảnh báo về 3 secret thiếu (`SUPABASE_SERVICE_ROLE_KEY`, `EINVOICE_ENCRYPTION_KEY`, `RESEND_API_KEY`) trong `_metadata.notes`.
2. Tạo script `scripts/selfhost-restore.ts`: đọc file export JSON → restore auth.users + tất cả bảng theo đúng thứ tự dependency.
3. Tạo script `scripts/rewrite-storage-urls.sql` để đổi domain ảnh.
4. Bổ sung `docs/SELFHOST_MIGRATION.md` chi tiết lệnh từng bước.

