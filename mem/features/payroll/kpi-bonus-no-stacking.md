---
name: KPI Bonus No Stacking
description: KPI personal bonus tiers replace (not stack) base bonus, percent_over = % over threshold
type: feature
---
Bonus KPI cá nhân (`kpi_personal`) trong calculate-payroll:
- `threshold` = mức doanh thu đạt KPI 100%
- `tiers[].percent_over` = % VƯỢT THÊM so với threshold (không phải % đạt KPI). VD: threshold=50tr, tier 100% = đạt 100tr (vượt thêm 50tr). Tier 0% = vừa đạt KPI.
- KHÔNG cộng dồn: `amount = max(baseAmt, matchedTierAmt)` — tier thay thế thưởng cơ bản, lấy mức có lợi nhất cho NV.
- Match tier cao nhất NV đạt (sort desc by percent_over).
UI: SalaryTemplateEditor.tsx có chú thích semantic "Vượt KPI (%)".