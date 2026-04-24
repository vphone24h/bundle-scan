

## Thiết kế lại nhãn sản phẩm theo phong cách "Giảm 4%" / "Trả góp 0%"

Áp dụng phong cách nhãn từ ảnh tham khảo (CellphoneS): **viên thuốc bo tròn 2 đầu, nền màu đặc, chữ trắng đậm, có một từ được nhấn mạnh** — cho nhãn New / Hot / Trending... trên website.

### Thay đổi hình ảnh (chỉ 1 file: `ProductCardVariants.tsx` → component `ProductBadges`)

**Bỏ kiểu "ribbon" hiện tại**, thay bằng **pill (viên thuốc)**:

- Hình dạng: `border-radius: 999px` (bo tròn cả 2 đầu, không dính mép ảnh nữa).
- Vị trí: cách mép ảnh `top: 8px`, `left: 8px` cho nhãn 1 và `right: 8px` cho nhãn 2 (đứng độc lập, không dán vào cạnh).
- Kích thước: padding `4px 10px`, font-size `11px`, font-weight `800`, letter-spacing nhẹ.
- Đổ bóng: `box-shadow: 0 2px 6px rgba(0,0,0,0.18)` → nổi khỏi ảnh nền.
- Màu nền đặc (không gradient rối mắt), giữ bảng màu đặc trưng cho từng loại:
  - New → đỏ `#dc2626`
  - Hot → cam `#ea580c`
  - Trending → tím `#7c3aed`
  - Best choice → xanh dương `#2563eb`
  - Sale/Deal → hồng `#db2777`
  - Chính hãng → xanh lá `#16a34a`
  - Limited → đen `#111827`
  - … (giữ nguyên map sẵn có)
- **Nhấn mạnh 1 từ khóa** giống "Giảm **4%**": tách label thành 2 phần, ví dụ:
  - "Hàng **NEW**", "Đang **HOT**", "**TRENDING**", "**BEST** choice", "**SALE**", "**LIMITED**"...
  - Phần nhấn: `font-weight: 900`, hơi to hơn 1px; phần còn lại nhẹ hơn (`font-weight: 700`, opacity 0.95).
- Hiệu ứng: giữ `animate-badge-pulse` nhưng giảm cường độ (scale 1 → 1.04) để mượt, không giật.

### Vị trí & xử lý chồng chéo

- Nhãn "% giảm" tự động (ribbon góc phải) đã được ẩn khi có badge thủ công → giữ nguyên logic này.
- Trong **trang chi tiết sản phẩm**: pill mới sẽ tự động đẹp hơn (component dùng chung), vẫn chỉ hiện ở ảnh đầu tiên.

### Kết quả mong đợi

```
[● Hàng NEW]              [● Đang HOT ●]
   ─────── ảnh sản phẩm ───────
```

Pill bo tròn nổi, chữ in đậm có điểm nhấn — đồng nhất phong cách với badge "Giảm %" / "Trả góp 0%" trong ảnh tham khảo, nhưng vẫn giữ màu sắc thương hiệu cho từng loại nhãn.

