---
name: KPI Bonus Stacking & Commission Hierarchy
description: KPI tier bonus stacks on base; commissions propagate to category ancestors
type: feature
---
Engine `calculate-payroll` ↔ form `SalaryTemplateEditor`:
- **kpi_personal CỘNG DỒN**: `amount = baseAmt + matchedTierAmt`. Khi đạt threshold → nhận baseAmt; mức vượt cao nhất NV match → cộng thêm `value` của tier đó. VD threshold=50tr base=1tr, tier 100%=2tr → đạt 100tr nhận 3tr.
- **tiers[].percent_over** = % VƯỢT THÊM so với threshold (threshold=50tr, tier 100% = đạt 100tr).
- **commission category hierarchy**: `soldByCategory` propagate doanh số lên TẤT CẢ category tổ tiên qua `getCategoryAncestors()`. Chọn parent "iPhone" sẽ bao gồm sales của leaf "iPhone 15 Pro", "iPhone 15", v.v.
- **commission fixed_amount**: tính theo `value × qty` (mỗi sản phẩm bán ra), KHÔNG phải mỗi đơn. UI label: "Số tiền VNĐ / 1 sản phẩm bán ra".
- **gross_profit**: `userGrossProfit = Σ(sale_price - products.import_price) × qty` cho các đơn NV bán.
- **commission service**: backend xử lý như `product` (cùng `soldByProduct` map).
- **allowance.max_absent_days**: nếu > 0 và `totalAbsent > max_absent_days` → bỏ phụ cấp. = 0 → luôn nhận.
- **kpi_not_met**: form ẩn ô "Số tiền phạt" (chỉ dùng tiers).