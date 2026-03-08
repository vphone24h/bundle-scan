
ALTER TABLE public.shop_ctv_settings 
ADD COLUMN IF NOT EXISTS commission_tiers jsonb NOT NULL DEFAULT '[
  {"threshold": 1000000, "rate": 15, "type": "percentage", "label": "Dưới 1 triệu"},
  {"threshold": 3000000, "rate": 12, "type": "percentage", "label": "1 - 3 triệu"},
  {"threshold": 5000000, "rate": 10, "type": "percentage", "label": "3 - 5 triệu"},
  {"threshold": 10000000, "rate": 200000, "type": "fixed", "label": "5 - 10 triệu"},
  {"threshold": null, "rate": 500000, "type": "fixed", "label": "Trên 10 triệu"}
]'::jsonb;

COMMENT ON COLUMN public.shop_ctv_settings.commission_tiers IS 'Các mức hoa hồng theo ngưỡng giá trị đơn hàng. Mảng JSON [{threshold, rate, type, label}]';
