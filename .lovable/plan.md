

# Đánh giá secrets & Plan migrate tối ưu Lovable Cloud → Self-host

## ✅ Phần 1: Đánh giá `all_env_secrets` (qua function `get-all-secrets`)

Khi gọi function `get-all-secrets` (đã deploy sẵn, chỉ platform_admin), file JSON tải về sẽ chứa **toàn bộ `Deno.env.toObject()`** — bao gồm cả secrets do Lovable inject lẫn secrets user tự thêm.

### Có sẵn — đủ cho self-host:
| Loại | Secrets | Trạng thái |
|---|---|---|
| **Supabase core** (auto-inject) | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL`, `SUPABASE_JWT_SECRET` | ✅ Có (Lovable tự inject vào edge runtime) |
| **Email SMTP** | `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_USER_2`, `SMTP_PASSWORD_2` | ✅ |
| **Zalo OA** | `ZALO_APP_ID`, `ZALO_APP_SECRET` | ✅ |
| **Cloudflare** (custom domain) | `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ZONE_ID` | ✅ |
| **Lovable AI** | `LOVABLE_API_KEY` | ⚠️ Chỉ chạy được trên Lovable platform — self-host **mất tính năng AI** trừ khi đổi sang OpenAI/Gemini API key riêng |

### ❌ Cần bổ sung sau cutover:
- `OPENAI_API_KEY` hoặc `GEMINI_API_KEY` (thay LOVABLE_API_KEY) — dùng cho `generate-product-description`, `generate-product-images`.
- `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` — kiểm tra trong DB table `push_vapid_keys` thay vì env (đã sinh sẵn → vẫn dùng được).
- **JWT_SECRET mới** — bắt buộc sinh mới khi tự host (≠ secret cũ → toàn bộ user phải đăng nhập lại).

**Kết luận**: `all_env_secrets` **đã đủ ~95%** để migrate. Chỉ thiếu key AI thay thế và phải sinh JWT/keys mới cho self-host instance.

---

## 📋 Phần 2: Plan migrate tối ưu (downtime < 30 phút)

### 🎯 Chiến lược cốt lõi: **Snapshot + Delta sync + DNS swap**

```text
Day -7  ──── Setup VPS, cài Supabase self-host, smoke test
Day -3  ──── Dump full snapshot lần 1, restore vào self-host, verify
Day -1  ──── Test cutover thử trên staging domain
Day  0  ──── Cutover thật (đêm CN, 23:00–23:30 ICT)
Day +7  ──── Pause Cloud project (rollback fallback 30 ngày)
```

---

### Phase 0 — Chuẩn bị hạ tầng (2 ngày)

**VPS khuyến nghị**: Hetzner CCX23 (4 vCPU dedicated, 16GB RAM, 160GB NVMe) — ~30€/tháng — đủ cho ~50 tenants.

**Stack**:
```
Ubuntu 22.04 → Docker → supabase/docker (compose)
              ↓
Caddy reverse proxy + Let's Encrypt (auto SSL)
  ├─ api.vkho.vn        → Kong :8000
  ├─ studio.vkho.vn     → Studio :3000  (basic-auth bảo vệ)
  └─ *.vkho.vn          → giữ Cloudflare DNS
```

**Backup layer**: Backblaze B2 (~$0.005/GB) cho daily pg_dump + storage snapshot.

---

### Phase 1 — Migrate Schema + Data (snapshot lần 1)

**1.1 Lấy connection string Postgres trực tiếp** từ Lovable Cloud → **Settings → Database** (Lovable hiển thị `db.rodpbhesrwykmpywiiyd.supabase.co:5432`).

**1.2 Dump schema + data đầy đủ** (chạy trên VPS, ~30 phút tùy size):
```bash
# Schema gồm public + auth + storage (giữ password hashes)
pg_dump -h db.rodpbhesrwykmpywiiyd.supabase.co -U postgres \
  --schema=public --schema=auth --schema=storage \
  --no-owner --no-privileges -Fc -f full.dump
```

**1.3 Restore vào self-host**:
```bash
pg_restore -h localhost -U postgres -d postgres \
  --disable-triggers --no-owner --no-privileges full.dump
psql -c "ANALYZE;"
# Reset toàn bộ sequences về MAX(id)+1
```

**1.4 Verify** (script tự động):
- COUNT(*) 30 bảng quan trọng nhất phải khớp 100%
- MAX(created_at) khớp
- `auth.users` count khớp → user **không cần đổi password** (bcrypt hash chuyển nguyên)

---

### Phase 2 — Migrate Storage

```bash
# Tải toàn bộ buckets từ Cloud về VPS
rclone copy supabase-cloud:bucket-name ./storage/ --transfers=16

# Push vào self-host storage (giữ nguyên path)
rclone copy ./storage/ supabase-self:bucket-name
```
Bucket policies đã đi kèm trong dump schema `storage` → tự động khôi phục.

---

### Phase 3 — Migrate Edge Functions + Secrets

**3.1 Deploy code** (đã có sẵn trong repo):
```bash
supabase functions deploy --project-ref <self-host> --no-verify-jwt
# Loop qua 65 functions trong supabase/functions/
```

**3.2 Import secrets** từ `all_env_secrets.json`:
```bash
# Lọc bỏ các SUPABASE_* (sẽ tự sinh mới), giữ lại user secrets
jq -r '.env_secrets | to_entries[] 
  | select(.key | startswith("SUPABASE_") | not)
  | "\(.key)=\(.value)"' all_env_secrets.json \
  | xargs -I {} supabase secrets set {} --project-ref <self-host>
```

**3.3 Bổ sung key AI mới** (nếu cần): `supabase secrets set OPENAI_API_KEY=sk-...`

**3.4 Re-create pg_cron jobs** trỏ về `https://api.vkho.vn/functions/v1/...`:
- `daily-backup` (23:59 ICT)
- `auto_checkout_expired` (mỗi 5 phút)
- `run-automations`, `run-email-automations` (mỗi 15 phút)

---

### Phase 4 — Cutover (30 phút, đêm CN)

| Time | Action |
|---|---|
| **23:00** | Bật banner bảo trì (deploy frontend với flag `MAINTENANCE=true`) |
| **23:02** | Pause pg_cron trên Cloud, dừng nhận webhook Zalo |
| **23:05** | **Dump delta** — chỉ data sinh ra từ Phase 1 đến giờ (`WHERE updated_at > snapshot_time`) cho ~10 bảng nóng (sale_receipts, cash_book, attendance_records, chat_messages, landing_orders) |
| **23:15** | Restore delta vào self-host, re-run sequence reset |
| **23:20** | Verify: COUNT khớp, login test, tạo phiếu test |
| **23:25** | **Đổi env trong Lovable**: `VITE_SUPABASE_URL=https://api.vkho.vn`, `VITE_SUPABASE_PUBLISHABLE_KEY=<anon mới>` → Lovable tự rebuild frontend |
| **23:28** | Update Google OAuth redirect URL trong Google Cloud Console → `https://api.vkho.vn/auth/v1/callback` |
| **23:30** | Tắt maintenance, monitor logs 1 giờ |

**⚠️ Side-effect không tránh được**:
- Toàn bộ session user bị logout (JWT_SECRET mới) → gửi email thông báo trước 24h
- Custom domains (`depadian.com`, `vphone.vn`...): giữ nguyên DNS frontend, chỉ backend đổi → **user không cảm nhận được**

---

### Phase 5 — Hậu kiểm (7 ngày)

- [ ] Daily backup chạy được (verify file trên B2)
- [ ] Edge functions: smoke test 10 functions critical
- [ ] Báo cáo Dashboard hiển thị chính xác
- [ ] Push notification, Zalo OA hoạt động
- [ ] Performance: `pg_stat_statements` không có query > 1s
- [ ] Sau 7 ngày ổn định → Cloud project chuyển trạng thái paused (giữ 30 ngày làm rollback)

---

## 🔧 Tools cần build trước cutover

1. **Script verify** (`scripts/verify-migration.sh`): so sánh COUNT 50 bảng giữa Cloud ↔ Self-host
2. **Script delta dump** (`scripts/delta-dump.sh`): dump only rows mới từ snapshot time
3. **Maintenance banner**: feature flag trong frontend để bật/tắt nhanh
4. **Rollback script**: 1 lệnh đổi env về Cloud nếu fail

---

## 💰 Chi phí vận hành

| Hạng mục | $/tháng |
|---|---|
| Hetzner CCX23 (4vCPU, 16GB) | ~32 |
| Block storage 160GB | ~6 |
| Backblaze B2 backup 200GB | ~3 |
| Cloudflare DNS | 0 |
| **Tổng** | **~41** |

---

## ⚠️ Rủi ro chính & mitigation

| Rủi ro | Mitigation |
|---|---|
| Mất tính năng AI (LOVABLE_API_KEY) | Đăng ký OpenAI/Gemini API key riêng trước cutover |
| Sequence chưa reset → duplicate ID | Script auto reset all sequences sau restore |
| Storage URL public bị break | Giữ path identical, đổi qua Caddy proxy |
| pg_cron không chạy | Verify ngay sau cutover, alert qua Telegram |
| VPS down 1 instance | Backup snapshot daily + offsite B2 |

---

## ✅ Trả lời ngắn gọn câu hỏi của bạn

> *"all_env_secrets đã đủ chưa?"*

**Đủ ~95%**. File chứa đầy đủ SMTP, Zalo, Cloudflare + các SUPABASE_* (sẽ thay bằng key của self-host instance). **Chỉ cần bổ sung 1 key AI thay thế** (OpenAI/Gemini) nếu muốn giữ tính năng AI sau khi rời Lovable platform.

