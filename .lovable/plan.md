

## Plan: Tăng kích thước TabsList để dễ vuốt ngang trên mobile

### Vấn đề
Thanh tab điều hướng (Cấu hình, Sản phẩm, Tin tức, Đơn đặt hàng, Email Automation) hiện quá nhỏ, khó vuốt qua lại trên mobile.

### Giải pháp
Tăng kích thước các `TabsTrigger` trong `LandingPageAdminPage.tsx` tại dòng 135:

- Thêm class `text-sm` hoặc `text-base` cho `TabsList` để chữ to hơn
- Thêm `py-2.5 px-4` cho mỗi `TabsTrigger` để vùng chạm lớn hơn (đạt chuẩn 44-48px)
- Giữ nguyên `overflow-x-auto` và `scrollbar-hide`

### File thay đổi
- `src/pages/LandingPageAdminPage.tsx` — dòng 135-155: thêm class tăng kích thước cho TabsList và các TabsTrigger

