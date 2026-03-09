

## Thêm nhiều nút cuộn dọc theo bảng

### Vấn đề
Hiện tại chỉ có 1 nút cuộn nằm ở giữa bảng (top-1/2), khi bảng dài nhiều dòng thì nút bị "chìm" xuống sâu, khách hàng ở phần trên không nhìn thấy.

### Giải pháp
Thay vì 1 nút ở giữa, hiển thị **3 nút cuộn** phân bố đều theo chiều dọc bên phải (và bên trái khi cần cuộn ngược):
- Nút 1: ở vị trí **trên** (khoảng 20% chiều cao)
- Nút 2: ở vị trí **giữa** (50% chiều cao)  
- Nút 3: ở vị trí **dưới** (khoảng 80% chiều cao)

### Chi tiết kỹ thuật

**File chỉnh sửa:** `src/components/ui/scrollable-table-wrapper.tsx`

- Tạo mảng vị trí `['top-[20%]', 'top-1/2', 'top-[80%]']`
- Dùng `.map()` để render 3 nút cho mỗi bên (trái/phải) thay vì 1 nút duy nhất
- Giữ nguyên style nút tròn, màu primary, shadow, hiệu ứng hover/active
- Tất cả các nút đều gọi cùng hàm `scroll()` để cuộn 300px

Không ảnh hưởng đến các trang khác đang dùng `ScrollableTableWrapper`.

