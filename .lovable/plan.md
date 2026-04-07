
## Bước 1: Database + Admin UI cho Companies

### 1.1 Database Migration
- Tạo bảng `companies` (id, domain, name, status, default_domain_id, created_at, updated_at)
- Thêm cột `company_id` vào bảng `tenants` (nullable ban đầu để không break dữ liệu cũ)
- Tạo record company mặc định cho "vkho.vn" và gán tất cả tenant hiện tại vào company đó
- RLS policies cho bảng companies (chỉ platform_admin CRUD)

### 1.2 Admin UI - Tab "Công ty" trong Platform Admin
- Danh sách companies: domain, name, status, số shop, ngày tạo
- Thêm company mới (domain, name)
- Sửa company (đổi domain, name, status)
- Xóa company (confirm + reset tenants về company mặc định)
- Gán/bỏ gán tenant vào company

### 1.3 Cập nhật tab Domains hiện tại
- Liên kết custom_domains với companies thay vì trực tiếp tenant
- Hoặc giữ nguyên custom_domains hiện tại và companies là tầng logic riêng

### Chưa làm ở bước này (bước sau):
- Runtime domain resolution (detect company từ hostname)
- Refactor queries thêm company_id filter
- RLS policies cho data tables theo company_id
