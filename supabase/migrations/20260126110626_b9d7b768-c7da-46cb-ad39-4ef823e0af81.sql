-- Enum cho vai trò nhân viên
CREATE TYPE public.app_role AS ENUM ('admin', 'staff');

-- Enum cho trạng thái sản phẩm
CREATE TYPE public.product_status AS ENUM ('in_stock', 'sold', 'returned');

-- Enum cho trạng thái phiếu nhập
CREATE TYPE public.receipt_status AS ENUM ('completed', 'cancelled');

-- Enum cho loại thanh toán
CREATE TYPE public.payment_type AS ENUM ('cash', 'bank_card', 'e_wallet', 'debt');

-- Bảng profiles nhân viên
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    phone TEXT,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Bảng user_roles (tách riêng để bảo mật)
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL DEFAULT 'staff',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Bảng danh mục sản phẩm (hỗ trợ phân cấp)
CREATE TABLE public.categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    parent_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Bảng nhà cung cấp
CREATE TABLE public.suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    phone TEXT,
    address TEXT,
    note TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Bảng phiếu nhập hàng
CREATE TABLE public.import_receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    import_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    total_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
    paid_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
    debt_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
    supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    note TEXT,
    status receipt_status NOT NULL DEFAULT 'completed',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Bảng thanh toán phiếu nhập
CREATE TABLE public.receipt_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    receipt_id UUID REFERENCES public.import_receipts(id) ON DELETE CASCADE NOT NULL,
    payment_type payment_type NOT NULL,
    amount NUMERIC(15,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Bảng sản phẩm
CREATE TABLE public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    sku TEXT NOT NULL,
    imei TEXT,
    category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
    import_price NUMERIC(15,2) NOT NULL,
    import_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
    import_receipt_id UUID REFERENCES public.import_receipts(id) ON DELETE SET NULL,
    status product_status NOT NULL DEFAULT 'in_stock',
    note TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index cho IMEI (kiểm tra trùng lặp nhanh hơn)
CREATE INDEX idx_products_imei ON public.products(imei) WHERE imei IS NOT NULL;
CREATE INDEX idx_products_status ON public.products(status);
CREATE INDEX idx_products_category ON public.products(category_id);

-- Enable RLS trên tất cả các bảng
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipt_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Function kiểm tra vai trò (security definer để tránh infinite recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.user_roles
        WHERE user_id = _user_id AND role = _role
    )
$$;

-- Function kiểm tra user đã authenticated
CREATE OR REPLACE FUNCTION public.is_authenticated()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT auth.uid() IS NOT NULL
$$;

-- RLS Policies cho profiles
CREATE POLICY "Users can view all profiles" ON public.profiles
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile" ON public.profiles
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- RLS Policies cho user_roles (chỉ admin có thể quản lý)
CREATE POLICY "Authenticated users can view roles" ON public.user_roles
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage roles" ON public.user_roles
    FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies cho categories (tất cả authenticated users có thể CRUD)
CREATE POLICY "Authenticated users can view categories" ON public.categories
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage categories" ON public.categories
    FOR ALL TO authenticated USING (public.is_authenticated());

-- RLS Policies cho suppliers
CREATE POLICY "Authenticated users can view suppliers" ON public.suppliers
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage suppliers" ON public.suppliers
    FOR ALL TO authenticated USING (public.is_authenticated());

-- RLS Policies cho import_receipts
CREATE POLICY "Authenticated users can view receipts" ON public.import_receipts
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage receipts" ON public.import_receipts
    FOR ALL TO authenticated USING (public.is_authenticated());

-- RLS Policies cho receipt_payments
CREATE POLICY "Authenticated users can view payments" ON public.receipt_payments
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage payments" ON public.receipt_payments
    FOR ALL TO authenticated USING (public.is_authenticated());

-- RLS Policies cho products
CREATE POLICY "Authenticated users can view products" ON public.products
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage products" ON public.products
    FOR ALL TO authenticated USING (public.is_authenticated());

-- Trigger tự động tạo profile khi user đăng ký
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (user_id, display_name)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email));
    
    -- Mặc định gán role staff cho user mới
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'staff');
    
    RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger cập nhật updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON public.categories
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_suppliers_updated_at BEFORE UPDATE ON public.suppliers
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_import_receipts_updated_at BEFORE UPDATE ON public.import_receipts
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();