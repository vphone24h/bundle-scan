---
name: KPI Bonus No Stacking
description: KPI personal bonus tiers replace (not stack) base bonus, percent_over = % over threshold
type: feature
---
Engine `calculate-payroll` ↔ form `SalaryTemplateEditor`:
- **kpi_personal**: `threshold` = doanh thu đạt KPI 100%. `tiers[].percent_over` = % VƯỢT THÊM so với threshold (VD threshold=50tr, tier 100% = đạt 100tr). KHÔNG cộng dồn: `amount = max(baseAmt, matchedTierAmt)`.
- **gross_profit**: tính `userGrossProfit = Σ(sale_price - products.import_price) × qty` cho các đơn NV bán. So sánh với `threshold`. Lấy `import_price` từ bảng `products`.
- **commission service**: backend xử lý như `product` (cùng `soldByProduct` map).
- **allowance.max_absent_days**: cột mới trên `salary_template_allowances`. Nếu > 0 và `totalAbsent > max_absent_days` → bỏ phụ cấp đó (amount=0, skipped_reason). Nếu = 0 → luôn nhận.
- **kpi_not_met**: form ẩn ô "Số tiền phạt" khi loại = kpi_not_met (chỉ dùng tiers).