

## Phân tích vấn đề

Khi bạn check (tick) tất cả 5 sản phẩm IMEI trong phiếu kiểm kho, bên trong chi tiết hiển thị đúng (actual=1, OK), nhưng **danh sách phiếu vẫn hiện Hệ thống=5, Thực tế=0, Lệch=-5**.

### Nguyên nhân gốc (2 lỗi)

1. **Cập nhật tổng bị silent fail**: Khi check từng item, hệ thống cập nhật tổng trên bảng `stock_counts` nhưng **không kiểm tra lỗi** (dòng 511-518 trong `useStockCounts.tsx`). Nếu RLS hoặc lỗi mạng xảy ra, tổng không được cập nhật mà không có thông báo nào.

2. **Race condition khi check nhanh**: Khi bạn check nhiều item liên tiếp, các mutation chạy song song. Mỗi mutation fetch toàn bộ items rồi tính tổng - nhưng fetch có thể trả về dữ liệu cũ của các item khác (chưa kịp cập nhật). Kết quả: mutation cuối cùng có thể ghi đè tổng bằng giá trị sai.

### Kế hoạch sửa

**File: `src/hooks/useStockCounts.tsx`**

1. **Thêm error handling** cho phần cập nhật tổng `stock_counts` - log lỗi và retry nếu cần.

2. **Thay đổi cách tính tổng**: Thay vì fetch items song song với update (gây race condition), sẽ:
   - Update item trước (await)
   - Sau đó fetch lại tất cả items để tính tổng chính xác
   - Cập nhật tổng stock_counts với error check

3. **Thêm debounce/serial queue**: Đảm bảo các mutation cập nhật tổng chạy tuần tự, không ghi đè lẫn nhau.

4. **Thêm nút "Tính lại tổng"**: Cho phép admin bấm để recalculate tổng từ items thực tế, phòng trường hợp lệch dữ liệu.

### Chi tiết kỹ thuật

```text
Luồng hiện tại (lỗi):
  Check item1 ──┬── Update item1 ──────────────────> Done
                └── Fetch all items (stale!) ──> Calc totals ──> Update stock_counts (wrong!)

Luồng mới (fix):
  Check item1 ──> Update item1 ──> Fetch all items (fresh) ──> Update stock_counts ──> Done
                                                                    ↑ error check + retry
```

Ngoài ra sẽ thêm logic: khi mở detail view, tự động recalculate tổng từ items thực tế và sync lại `stock_counts` nếu phát hiện lệch.

