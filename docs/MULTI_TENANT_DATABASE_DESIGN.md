# Multi-Tenant Database Design Documentation

## Tổng Quan Kiến Trúc

Hệ thống sử dụng kiến trúc **Multi-Tenant SaaS** với data isolation tuyệt đối thông qua Row Level Security (RLS) của PostgreSQL/Supabase.

```
┌─────────────────────────────────────────────────────────────┐
│                    Platform Admin                            │
│              (Quản lý toàn bộ hệ thống)                      │
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌───────────────┐     ┌───────────────┐     ┌───────────────┐
│   Tenant A    │     │   Tenant B    │     │   Tenant C    │
│   (Shop A)    │     │   (Shop B)    │     │   (Shop C)    │
├───────────────┤     ├───────────────┤     ├───────────────┤
│ - Products    │     │ - Products    │     │ - Products    │
│ - Branches    │     │ - Branches    │     │ - Branches    │
│ - Customers   │     │ - Customers   │     │ - Customers   │
│ - Users       │     │ - Users       │     │ - Users       │
│ - Cash Book   │     │ - Cash Book   │     │ - Cash Book   │
│ - Reports     │     │ - Reports     │     │ - Reports     │
└───────────────┘     └───────────────┘     └───────────────┘
```

---

## 1. Core Tables

### 1.1 Tenants (Cửa hàng/Doanh nghiệp)

```sql
CREATE TABLE public.tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    subdomain TEXT UNIQUE NOT NULL,  -- VD: "shopA" -> shopA.vkho.vn
    email TEXT,
    phone TEXT,
    address TEXT,
    
    -- Subscription
    status tenant_status NOT NULL DEFAULT 'trial',  -- trial, active, expired, locked
    subscription_start_date TIMESTAMPTZ,
    subscription_end_date TIMESTAMPTZ,
    max_users INTEGER DEFAULT 5,
    max_branches INTEGER DEFAULT 3,
    
    -- Metadata
    locked_at TIMESTAMPTZ,
    locked_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enum cho status
CREATE TYPE tenant_status AS ENUM ('trial', 'active', 'expired', 'locked');
```

### 1.2 Platform Users (Chủ cửa hàng - Tenant Admin)

```sql
CREATE TABLE public.platform_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    tenant_id UUID REFERENCES public.tenants(id),
    
    platform_role platform_role NOT NULL DEFAULT 'tenant_admin',
    display_name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    is_active BOOLEAN DEFAULT true,
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    UNIQUE(user_id, tenant_id)
);

-- Enum cho platform role
CREATE TYPE platform_role AS ENUM ('platform_admin', 'tenant_admin');
```

### 1.3 User Roles (Nhân viên trong từng cửa hàng)

```sql
-- Enum cho vai trò trong cửa hàng
CREATE TYPE user_role AS ENUM ('super_admin', 'branch_admin', 'staff', 'cashier');
CREATE TYPE app_role AS ENUM ('admin', 'staff', 'cashier');

CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    tenant_id UUID REFERENCES public.tenants(id),
    branch_id UUID REFERENCES public.branches(id),
    
    user_role user_role NOT NULL DEFAULT 'staff',
    role app_role NOT NULL DEFAULT 'staff',
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    UNIQUE(user_id, tenant_id)
);
```

### 1.4 Profiles (Thông tin cá nhân)

```sql
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    tenant_id UUID REFERENCES public.tenants(id),
    
    display_name TEXT NOT NULL,
    phone TEXT,
    avatar_url TEXT,
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
```

---

## 2. Business Tables (Có tenant_id)

### 2.1 Branches (Chi nhánh)

```sql
CREATE TABLE public.branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id),
    
    name TEXT NOT NULL,
    address TEXT,
    phone TEXT,
    note TEXT,
    is_default BOOLEAN DEFAULT false,
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
```

### 2.2 Categories (Danh mục sản phẩm)

```sql
CREATE TABLE public.categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id),
    parent_id UUID REFERENCES public.categories(id),  -- Hỗ trợ cấu trúc cha-con
    
    name TEXT NOT NULL,
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
```

### 2.3 Suppliers (Nhà cung cấp)

```sql
CREATE TABLE public.suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id),
    
    name TEXT NOT NULL,
    phone TEXT,
    address TEXT,
    note TEXT,
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
```

### 2.4 Customers (Khách hàng)

```sql
CREATE TYPE membership_tier AS ENUM ('regular', 'silver', 'gold', 'vip');
CREATE TYPE customer_status AS ENUM ('active', 'inactive');

CREATE TABLE public.customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id),
    preferred_branch_id UUID REFERENCES public.branches(id),
    
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT,
    address TEXT,
    birthday DATE,
    note TEXT,
    
    -- Loyalty
    membership_tier membership_tier DEFAULT 'regular',
    status customer_status DEFAULT 'active',
    total_spent NUMERIC DEFAULT 0,
    current_points INTEGER DEFAULT 0,
    pending_points INTEGER DEFAULT 0,
    total_points_earned INTEGER DEFAULT 0,
    total_points_used INTEGER DEFAULT 0,
    last_purchase_date TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
```

### 2.5 Products (Sản phẩm)

```sql
CREATE TYPE product_status AS ENUM ('in_stock', 'sold', 'returned', 'transferred');

CREATE TABLE public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id),
    branch_id UUID REFERENCES public.branches(id),
    category_id UUID REFERENCES public.categories(id),
    supplier_id UUID REFERENCES public.suppliers(id),
    import_receipt_id UUID REFERENCES public.import_receipts(id),
    
    name TEXT NOT NULL,
    sku TEXT NOT NULL,
    imei TEXT,  -- NULL cho hàng không có IMEI
    
    import_price NUMERIC NOT NULL,
    quantity INTEGER DEFAULT 1,  -- Cho hàng không IMEI
    total_import_cost NUMERIC DEFAULT 0,
    
    status product_status DEFAULT 'in_stock',
    import_date TIMESTAMPTZ DEFAULT now(),
    note TEXT,
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
```

### 2.6 Import Receipts (Phiếu nhập kho)

```sql
CREATE TYPE receipt_status AS ENUM ('draft', 'completed', 'cancelled');

CREATE TABLE public.import_receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id),
    branch_id UUID REFERENCES public.branches(id),
    supplier_id UUID REFERENCES public.suppliers(id),
    created_by UUID REFERENCES auth.users(id),
    
    code TEXT NOT NULL,
    import_date TIMESTAMPTZ DEFAULT now(),
    
    total_amount NUMERIC DEFAULT 0,
    paid_amount NUMERIC DEFAULT 0,
    debt_amount NUMERIC DEFAULT 0,
    
    status receipt_status DEFAULT 'completed',
    note TEXT,
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
```

### 2.7 Export Receipts (Phiếu xuất/bán hàng)

```sql
CREATE TABLE public.export_receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id),
    branch_id UUID REFERENCES public.branches(id),
    customer_id UUID REFERENCES public.customers(id),
    created_by UUID REFERENCES auth.users(id),
    
    code TEXT NOT NULL,
    export_date TIMESTAMPTZ DEFAULT now(),
    
    total_amount NUMERIC DEFAULT 0,
    paid_amount NUMERIC DEFAULT 0,
    debt_amount NUMERIC DEFAULT 0,
    
    -- Points
    points_earned INTEGER DEFAULT 0,
    points_redeemed INTEGER DEFAULT 0,
    points_discount NUMERIC DEFAULT 0,
    
    status TEXT DEFAULT 'completed',
    note TEXT,
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.export_receipt_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    receipt_id UUID NOT NULL REFERENCES public.export_receipts(id),
    product_id UUID REFERENCES public.products(id),
    category_id UUID REFERENCES public.categories(id),
    
    product_name TEXT NOT NULL,
    sku TEXT NOT NULL,
    imei TEXT,
    sale_price NUMERIC NOT NULL,
    
    status TEXT DEFAULT 'sold',
    note TEXT,
    
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.export_receipt_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    receipt_id UUID NOT NULL REFERENCES public.export_receipts(id),
    
    payment_type TEXT NOT NULL,  -- 'cash', 'bank_transfer', 'card'
    amount NUMERIC NOT NULL,
    
    created_at TIMESTAMPTZ DEFAULT now()
);
```

### 2.8 Cash Book (Sổ quỹ)

```sql
CREATE TYPE cash_book_type AS ENUM ('income', 'expense');

CREATE TABLE public.cash_book (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id),
    branch_id UUID REFERENCES public.branches(id),
    created_by UUID REFERENCES auth.users(id),
    
    type cash_book_type NOT NULL,
    category TEXT NOT NULL,
    description TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    payment_source TEXT NOT NULL,  -- 'cash', 'bank', 'wallet'
    
    transaction_date TIMESTAMPTZ DEFAULT now(),
    reference_type TEXT,  -- 'import', 'export', 'debt_payment'
    reference_id UUID,
    
    is_business_accounting BOOLEAN DEFAULT true,  -- Có tính vào báo cáo KD không
    note TEXT,
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
```

### 2.9 Returns (Trả hàng)

```sql
CREATE TYPE return_fee_type AS ENUM ('none', 'percentage', 'fixed');

-- Trả hàng bán (khách trả lại)
CREATE TABLE public.export_returns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id),
    branch_id UUID REFERENCES public.branches(id),
    customer_id UUID REFERENCES public.customers(id),
    export_receipt_id UUID REFERENCES public.export_receipts(id),
    export_receipt_item_id UUID REFERENCES public.export_receipt_items(id),
    product_id UUID NOT NULL REFERENCES public.products(id),
    created_by UUID REFERENCES auth.users(id),
    new_import_receipt_id UUID REFERENCES public.import_receipts(id),
    
    code TEXT NOT NULL,
    product_name TEXT NOT NULL,
    sku TEXT NOT NULL,
    imei TEXT,
    
    import_price NUMERIC NOT NULL,
    sale_price NUMERIC NOT NULL,
    refund_amount NUMERIC DEFAULT 0,
    store_keep_amount NUMERIC DEFAULT 0,
    
    fee_type return_fee_type DEFAULT 'none',
    fee_percentage NUMERIC DEFAULT 0,
    fee_amount NUMERIC DEFAULT 0,
    
    original_sale_date TIMESTAMPTZ,
    return_date TIMESTAMPTZ DEFAULT now(),
    is_business_accounting BOOLEAN DEFAULT true,
    note TEXT,
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Trả hàng nhập (trả NCC)
CREATE TABLE public.import_returns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id),
    branch_id UUID REFERENCES public.branches(id),
    supplier_id UUID REFERENCES public.suppliers(id),
    import_receipt_id UUID REFERENCES public.import_receipts(id),
    product_id UUID NOT NULL REFERENCES public.products(id),
    created_by UUID REFERENCES auth.users(id),
    
    code TEXT NOT NULL,
    product_name TEXT NOT NULL,
    sku TEXT NOT NULL,
    imei TEXT,
    
    import_price NUMERIC NOT NULL,
    total_refund_amount NUMERIC DEFAULT 0,
    
    original_import_date TIMESTAMPTZ,
    return_date TIMESTAMPTZ DEFAULT now(),
    note TEXT,
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
```

### 2.10 Audit Logs (Nhật ký thao tác)

```sql
CREATE TABLE public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id),
    branch_id UUID REFERENCES public.branches(id),
    user_id UUID REFERENCES auth.users(id),
    
    action_type TEXT NOT NULL,  -- 'create', 'update', 'delete'
    table_name TEXT,
    record_id UUID,
    description TEXT,
    
    old_data JSONB,
    new_data JSONB,
    ip_address TEXT,
    
    created_at TIMESTAMPTZ DEFAULT now()
);
```

---

## 3. Security Functions

### 3.1 Core Functions

```sql
-- Kiểm tra user có phải Platform Admin không
CREATE OR REPLACE FUNCTION public.is_platform_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.platform_users 
        WHERE user_id = _user_id 
        AND platform_role = 'platform_admin'
        AND is_active = true
    )
$$;

-- Lấy tenant_id của user hiện tại (an toàn)
CREATE OR REPLACE FUNCTION public.get_user_tenant_id_secure()
RETURNS UUID
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    (SELECT tenant_id FROM public.platform_users 
     WHERE user_id = auth.uid() AND is_active = true LIMIT 1),
    (SELECT tenant_id FROM public.user_roles 
     WHERE user_id = auth.uid() LIMIT 1)
  )
$$;

-- Kiểm tra user có thuộc tenant không
CREATE OR REPLACE FUNCTION public.user_belongs_to_tenant(_tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    _tenant_id IS NOT NULL 
    AND (
      public.is_platform_admin(auth.uid()) 
      OR public.get_user_tenant_id_secure() = _tenant_id
    )
$$;

-- Kiểm tra user có role cụ thể không
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.user_roles
        WHERE user_id = _user_id AND role = _role
    )
$$;

-- Lấy role của user
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS user_role
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT user_role FROM public.user_roles WHERE user_id = _user_id LIMIT 1
$$;

-- Lấy branch_id của user
CREATE OR REPLACE FUNCTION public.get_user_branch(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT branch_id FROM public.user_roles WHERE user_id = _user_id LIMIT 1
$$;

-- Kiểm tra user có quyền truy cập branch không
CREATE OR REPLACE FUNCTION public.can_access_branch(_user_id UUID, _branch_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = _user_id 
    AND (
      user_role = 'super_admin' 
      OR branch_id = _branch_id
      OR _branch_id IS NULL
    )
  )
$$;

-- Kiểm tra user đã đăng nhập chưa
CREATE OR REPLACE FUNCTION public.is_authenticated()
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
    SELECT auth.uid() IS NOT NULL
$$;
```

---

## 4. RLS Policies Template

### 4.1 Standard Tenant-Isolated Table Policy

```sql
-- Bật RLS
ALTER TABLE public.{table_name} ENABLE ROW LEVEL SECURITY;

-- Policy SELECT
CREATE POLICY "Users can view own tenant {table_name}" 
ON public.{table_name} 
FOR SELECT 
USING (
  is_platform_admin(auth.uid()) 
  OR tenant_id = get_user_tenant_id_secure()
);

-- Policy INSERT
CREATE POLICY "Users can insert own tenant {table_name}" 
ON public.{table_name} 
FOR INSERT 
WITH CHECK (
  is_platform_admin(auth.uid()) 
  OR tenant_id = get_user_tenant_id_secure()
);

-- Policy UPDATE
CREATE POLICY "Users can update own tenant {table_name}" 
ON public.{table_name} 
FOR UPDATE 
USING (
  is_platform_admin(auth.uid()) 
  OR tenant_id = get_user_tenant_id_secure()
)
WITH CHECK (
  is_platform_admin(auth.uid()) 
  OR tenant_id = get_user_tenant_id_secure()
);

-- Policy DELETE
CREATE POLICY "Users can delete own tenant {table_name}" 
ON public.{table_name} 
FOR DELETE 
USING (
  is_platform_admin(auth.uid()) 
  OR tenant_id = get_user_tenant_id_secure()
);

-- Policy ALL (optional - thay thế tất cả policies trên)
CREATE POLICY "Users can manage own tenant {table_name}" 
ON public.{table_name} 
FOR ALL 
USING (
  is_platform_admin(auth.uid()) 
  OR tenant_id = get_user_tenant_id_secure()
);
```

### 4.2 Admin-Only Policy (VD: Membership Tier Settings)

```sql
-- Chỉ Admin mới được thêm/sửa/xóa
CREATE POLICY "Admins can manage own tenant {table_name}" 
ON public.{table_name} 
FOR ALL 
USING (
  is_platform_admin(auth.uid()) 
  OR (
    tenant_id = get_user_tenant_id_secure() 
    AND has_role(auth.uid(), 'admin')
  )
);

-- Tất cả user trong tenant được xem
CREATE POLICY "Users can view own tenant {table_name}" 
ON public.{table_name} 
FOR SELECT 
USING (
  is_platform_admin(auth.uid()) 
  OR tenant_id = get_user_tenant_id_secure()
);
```

### 4.3 Audit Logs Policy (Chỉ Insert + Select)

```sql
-- Chỉ cho insert, không cho update/delete
CREATE POLICY "Authenticated users can insert audit logs" 
ON public.audit_logs 
FOR INSERT 
WITH CHECK (is_authenticated());

CREATE POLICY "Users can view own tenant audit_logs" 
ON public.audit_logs 
FOR SELECT 
USING (
  is_platform_admin(auth.uid()) 
  OR tenant_id = get_user_tenant_id_secure()
);
```

---

## 5. Authentication Flow

### 5.1 Đăng ký Tenant mới

```
1. User vào trang /register
2. Nhập: Tên cửa hàng, Subdomain, Email, Password, SĐT
3. Edge Function "register-tenant":
   a. Tạo user trong auth.users (Supabase Auth)
   b. Tạo record trong tenants
   c. Tạo record trong platform_users (role = tenant_admin)
   d. Tạo default branch
   e. Tạo default point_settings
4. Redirect về trang đăng nhập
```

### 5.2 Đăng nhập

```
1. User vào trang /auth
2. Nhập: Store ID (subdomain), Email, Password
3. Frontend:
   a. Supabase auth.signIn(email, password)
   b. Lấy user.id
   c. Query platform_users hoặc user_roles để verify tenant_id
   d. Nếu user không thuộc tenant -> reject
4. Redirect về dashboard
```

### 5.3 Tạo nhân viên

```
1. Super Admin/Branch Admin vào /users
2. Nhập: Email, Password, Họ tên, SĐT, Role, Branch
3. Edge Function "create-user":
   a. Kiểm tra email đã tồn tại chưa (toàn hệ thống)
   b. Nếu email đã tồn tại:
      - Kiểm tra xem user đã thuộc tenant này chưa
      - Nếu chưa -> liên kết user với tenant (tạo user_roles mới)
   c. Nếu email chưa tồn tại:
      - Tạo user mới trong auth.users
      - Tạo profile
      - Tạo user_roles
4. Refresh danh sách nhân viên
```

---

## 6. Role-Based Access Control

### 6.1 Phân quyền theo vai trò

| Vai trò | Quyền hạn |
|---------|-----------|
| **Platform Admin** | Toàn quyền hệ thống, quản lý tất cả tenant |
| **Super Admin** (Tenant) | Toàn quyền trong cửa hàng, tất cả chi nhánh |
| **Branch Admin** | Quản lý nhân sự + dữ liệu trong 1 chi nhánh |
| **Cashier** | Xuất hàng, xem tồn kho, sổ quỹ, báo cáo bán hàng |
| **Staff** | Chỉ xuất hàng, xem tồn kho (không xem giá nhập) |

### 6.2 Ma trận quyền chi tiết

| Tính năng | Super Admin | Branch Admin | Cashier | Staff |
|-----------|:-----------:|:------------:|:-------:|:-----:|
| Xem Dashboard | ✅ | ✅ (chi nhánh) | ✅ (chi nhánh) | ❌ |
| Quản lý sản phẩm | ✅ | ✅ | ❌ | ❌ |
| Nhập hàng | ✅ | ✅ | ❌ | ❌ |
| Xuất/Bán hàng | ✅ | ✅ | ✅ | ✅ |
| Xem giá nhập | ✅ | ✅ | ❌ | ❌ |
| Xem tồn kho | ✅ | ✅ | ✅ | ✅ |
| Sổ quỹ | ✅ | ✅ | ✅ | ❌ |
| Báo cáo | ✅ | ✅ | ✅ (bán hàng) | ❌ |
| Quản lý nhân viên | ✅ | ✅ (chi nhánh) | ❌ | ❌ |
| Audit Logs | ✅ | ✅ (chi nhánh) | ❌ | ❌ |
| Cài đặt | ✅ | ❌ | ❌ | ❌ |

---

## 7. Data Flow Diagram

### 7.1 Nhập hàng

```
┌─────────┐    ┌──────────────────┐    ┌──────────────┐
│ Supplier│───▶│ Import Receipt   │───▶│ Products     │
└─────────┘    │ (phiếu nhập)     │    │ (sản phẩm)   │
               └──────────────────┘    └──────────────┘
                        │
                        ▼
               ┌──────────────────┐    ┌──────────────┐
               │ Receipt Payments │    │ Cash Book    │
               │ (thanh toán)     │───▶│ (sổ quỹ)     │
               └──────────────────┘    └──────────────┘
                        │
                        ▼
               ┌──────────────────┐
               │ Supplier Debt    │
               │ (công nợ NCC)    │
               └──────────────────┘
```

### 7.2 Xuất/Bán hàng

```
┌──────────┐    ┌──────────────────┐    ┌──────────────┐
│ Customer │◀──▶│ Export Receipt   │───▶│ Products     │
└──────────┘    │ (phiếu bán)      │    │ status=sold  │
     │          └──────────────────┘    └──────────────┘
     │                   │
     │                   ▼
     │          ┌──────────────────┐    ┌──────────────┐
     │          │ Receipt Payments │    │ Cash Book    │
     │          │ (thanh toán)     │───▶│ (sổ quỹ)     │
     │          └──────────────────┘    └──────────────┘
     │                   │
     ▼                   ▼
┌──────────┐    ┌──────────────────┐
│ Points   │    │ Customer Debt    │
│ (điểm)   │    │ (công nợ KH)     │
└──────────┘    └──────────────────┘
```

---

## 8. Deployment Checklist

### 8.1 Database Setup

```bash
# 1. Tạo database trên Supabase/PostgreSQL
# 2. Chạy các migration theo thứ tự:
#    - 001_create_enums.sql
#    - 002_create_core_tables.sql
#    - 003_create_business_tables.sql
#    - 004_create_functions.sql
#    - 005_create_rls_policies.sql
#    - 006_create_triggers.sql
#    - 007_seed_data.sql
```

### 8.2 Environment Variables

```env
# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR...

# App
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR...
```

### 8.3 Edge Functions cần deploy

- `register-tenant` - Đăng ký cửa hàng mới
- `create-user` - Tạo nhân viên
- `update-user` - Cập nhật thông tin nhân viên
- `manage-tenant` - Platform Admin quản lý tenant
- `approve-payment` - Duyệt thanh toán
- `cancel-payment` - Hủy thanh toán

---

## 9. Best Practices

### 9.1 Khi thêm bảng mới

1. **LUÔN** thêm cột `tenant_id` nếu dữ liệu thuộc về từng cửa hàng
2. **LUÔN** bật RLS và thêm policies
3. **LUÔN** thêm `created_at` và `updated_at`
4. **CÂN NHẮC** thêm `branch_id` nếu dữ liệu cần phân chia theo chi nhánh
5. **CÂN NHẮC** thêm `created_by` cho audit trail

### 9.2 Khi query dữ liệu

```typescript
// ❌ SAI - Không filter tenant
const { data } = await supabase.from('products').select('*');

// ✅ ĐÚNG - RLS sẽ tự động filter, nhưng nên explicit
const { data } = await supabase
  .from('products')
  .select('*')
  .eq('tenant_id', tenantId);
```

### 9.3 Khi insert dữ liệu

```typescript
// ❌ SAI - Thiếu tenant_id
await supabase.from('products').insert({ name: 'iPhone', sku: 'IP15' });

// ✅ ĐÚNG - Luôn có tenant_id
const tenantId = await getCurrentTenantId();
await supabase.from('products').insert({ 
  name: 'iPhone', 
  sku: 'IP15',
  tenant_id: tenantId 
});
```

---

## 10. Troubleshooting

### 10.1 "new row violates row-level security policy"

**Nguyên nhân:** Insert thiếu `tenant_id` hoặc `tenant_id` không khớp với user hiện tại.

**Giải pháp:**
```typescript
const tenantId = await getCurrentTenantId();
// Thêm tenant_id vào insert
```

### 10.2 User không thấy dữ liệu

**Nguyên nhân:** RLS policy không đúng hoặc user chưa được liên kết với tenant.

**Kiểm tra:**
```sql
-- Kiểm tra user có trong platform_users hoặc user_roles không
SELECT * FROM platform_users WHERE user_id = 'xxx';
SELECT * FROM user_roles WHERE user_id = 'xxx';

-- Kiểm tra tenant_id của user
SELECT get_user_tenant_id_secure();
```

### 10.3 Infinite recursion in RLS

**Nguyên nhân:** Policy query lại chính bảng đó.

**Giải pháp:** Sử dụng `SECURITY DEFINER` function.

---

*Document Version: 1.0*
*Last Updated: 2025-01-26*
