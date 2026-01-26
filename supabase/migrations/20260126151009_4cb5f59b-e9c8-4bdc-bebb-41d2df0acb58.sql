-- Create debt_payments table to track debt collection/payment history
CREATE TABLE public.debt_payments (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    entity_type TEXT NOT NULL CHECK (entity_type IN ('customer', 'supplier')),
    entity_id UUID NOT NULL,
    payment_type TEXT NOT NULL CHECK (payment_type IN ('payment', 'addition')), -- payment = trả nợ, addition = cộng thêm nợ
    amount NUMERIC NOT NULL,
    payment_source TEXT, -- tiền mặt, thẻ, ví điện tử...
    description TEXT NOT NULL,
    branch_id UUID REFERENCES public.branches(id),
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.debt_payments ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Authenticated users can view debt payments"
ON public.debt_payments FOR SELECT
USING (is_authenticated());

CREATE POLICY "Authenticated users can manage debt payments"
ON public.debt_payments FOR ALL
USING (is_authenticated());

-- Create index for faster queries
CREATE INDEX idx_debt_payments_entity ON public.debt_payments(entity_type, entity_id);
CREATE INDEX idx_debt_payments_created_at ON public.debt_payments(created_at DESC);