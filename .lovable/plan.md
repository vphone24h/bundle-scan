
## Mục tiêu
Thêm "Tần suất gửi tối đa" (max_sends_per_recipient) cho từng kịch bản email tự động — mỗi người chỉ nhận tối đa N lần (mặc định 1). Áp dụng cho cả hệ thống Platform (admin gốc) và hệ thống công ty/shop (admin công ty), đồng bộ logic dedup ở edge functions.

## Phạm vi
**2 hệ thống email automation:**
1. `platform_email_automations` (Platform Admin gốc)
2. `email_automations` (Admin công ty/shop)

## Thay đổi

### 1. Database (migration)
Thêm cột `max_sends_per_recipient INTEGER DEFAULT 1 NOT NULL CHECK (max_sends_per_recipient >= 1 AND max_sends_per_recipient <= 10)` cho 2 bảng:
- `platform_email_automations`
- `email_automations`

### 2. UI Form (2 chỗ)
- `src/components/platform/PlatformEmailAutomationManagement.tsx` — form tạo/sửa kịch bản platform
- `src/components/admin/EmailAutomationTab.tsx` — form tạo/sửa kịch bản công ty

Thêm field **"Số lần gửi tối đa cho mỗi người"** (Select: 1, 2, 3, 5 lần) ngay dưới "Số ngày". Hiển thị badge "Gửi tối đa X lần" trên card kịch bản.

### 3. Hook types (TS)
- `src/hooks/usePlatformEmailAutomations.tsx` — thêm `max_sends_per_recipient` vào interface
- `src/hooks/useEmailAutomations.tsx` — thêm `max_sends_per_recipient` vào interface

### 4. Edge functions — logic dedup theo tần suất
**`supabase/functions/run-platform-email-automations/index.ts`:**
- Trước khi gửi, đếm số log đã gửi cho `(automation_id, tenant_id)` với status='sent'.
- Nếu `count >= max_sends_per_recipient` → skip.
- Vẫn giữ dedup "đã gửi hôm nay" để tránh gửi nhiều lần trong cùng 1 ngày.

**`supabase/functions/run-email-automations/index.ts`:**
- Trong block `oncePerCustomerTriggers` và block else, thay điều kiện `count > 0 → skip` bằng `count >= automation.max_sends_per_recipient → skip`.
- Áp dụng đồng nhất cho cả triggers per-customer và per-receipt.

### 5. Đồng bộ
- Field tự động xuất hiện trong cả 2 trang quản lý (Platform Admin và Admin Công ty).
- Logic gửi tự động đọc field từ DB → áp dụng giới hạn ngay vòng cron tiếp theo.
- Không cần migrate dữ liệu cũ — kịch bản hiện tại default = 1 lần (giữ nguyên hành vi cũ).

## Ghi chú kỹ thuật
- Dùng `count` query với `head: true` để hiệu năng tốt.
- CHECK constraint giới hạn 1-10 để tránh spam.
- Default = 1 → an toàn cho mọi kịch bản đang chạy (không thay đổi hành vi).
