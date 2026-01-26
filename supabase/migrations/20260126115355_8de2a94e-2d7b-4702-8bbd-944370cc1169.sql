
-- Bảng chi nhánh
CREATE TABLE public.branches (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    address TEXT,
    phone TEXT,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Thêm cột branch_id vào các bảng cần thiết
ALTER TABLE public.products ADD COLUMN branch_id UUID REFERENCES public.branches(id);
ALTER TABLE public.import_receipts ADD COLUMN branch_id UUID REFERENCES public.branches(id);
ALTER TABLE public.export_receipts ADD COLUMN branch_id UUID REFERENCES public.branches(id);

-- Bảng Sổ quỹ (Cash Book) - ghi nhận chi phí và thu nhập khác
CREATE TYPE public.cash_book_type AS ENUM ('expense', 'income');

CREATE TABLE public.cash_book (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    transaction_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    type cash_book_type NOT NULL,
    category TEXT NOT NULL, -- Loại: lương, ship, xăng, tiếp khách, thu nhập khác...
    description TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    payment_source TEXT NOT NULL CHECK (payment_source IN ('cash', 'bank_card', 'e_wallet')),
    is_business_accounting BOOLEAN DEFAULT true, -- Hạch toán kinh doanh
    branch_id UUID REFERENCES public.branches(id),
    reference_id UUID, -- Liên kết với phiếu xuất/nhập nếu có
    reference_type TEXT,
    created_by UUID,
    note TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Bảng danh mục chi phí/thu nhập
CREATE TABLE public.cash_book_categories (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    type cash_book_type NOT NULL,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Insert default categories
INSERT INTO public.cash_book_categories (name, type, is_default) VALUES
('Lương nhân viên', 'expense', true),
('Ship hàng', 'expense', true),
('Xăng xe', 'expense', true),
('Tiếp khách', 'expense', true),
('Ăn uống', 'expense', true),
('Điện nước', 'expense', true),
('Thuê mặt bằng', 'expense', true),
('Chi phí khác', 'expense', true),
('Khách bo thêm', 'income', true),
('Tiền hỗ trợ', 'income', true),
('Thu nhập khác', 'income', true);

-- Insert default branch
INSERT INTO public.branches (name, is_default) VALUES ('Chi nhánh chính', true);

-- Enable RLS
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_book ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_book_categories ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Authenticated users can view branches" ON public.branches FOR SELECT USING (is_authenticated());
CREATE POLICY "Authenticated users can manage branches" ON public.branches FOR ALL USING (is_authenticated());

CREATE POLICY "Authenticated users can view cash book" ON public.cash_book FOR SELECT USING (is_authenticated());
CREATE POLICY "Authenticated users can manage cash book" ON public.cash_book FOR ALL USING (is_authenticated());

CREATE POLICY "Authenticated users can view categories" ON public.cash_book_categories FOR SELECT USING (is_authenticated());
CREATE POLICY "Authenticated users can manage categories" ON public.cash_book_categories FOR ALL USING (is_authenticated());

-- Indexes
CREATE INDEX idx_cash_book_date ON public.cash_book(transaction_date DESC);
CREATE INDEX idx_cash_book_type ON public.cash_book(type);
CREATE INDEX idx_cash_book_branch ON public.cash_book(branch_id);
CREATE INDEX idx_products_branch ON public.products(branch_id);
CREATE INDEX idx_import_receipts_branch ON public.import_receipts(branch_id);
CREATE INDEX idx_export_receipts_branch ON public.export_receipts(branch_id);

-- Update triggers
CREATE TRIGGER update_branches_updated_at BEFORE UPDATE ON public.branches FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_cash_book_updated_at BEFORE UPDATE ON public.cash_book FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
