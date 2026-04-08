
## Module Sửa chữa (Repair Management System)

### Giai đoạn 1: Database & Cấu trúc dữ liệu
- Tạo bảng `repair_orders` (phiếu sửa chữa chính)
- Tạo bảng `repair_order_items` (dịch vụ & linh kiện)
- Tạo bảng `repair_request_types` (loại yêu cầu: sửa chữa, bảo hành...)
- Tạo bảng `repair_status_history` (lịch sử trạng thái)
- RLS policies theo tenant_id
- Enum trạng thái: received, pending_check, repairing, waiting_parts, completed, returned

### Giai đoạn 2: Menu & Routing
- Thêm menu "Sửa chữa" vào sidebar
- Route `/repair/new` - Tạo phiếu sửa
- Route `/repair/list` - Danh sách sửa chữa
- Cập nhật appRoutes, phân quyền

### Giai đoạn 3: Tạo phiếu sửa (Check-in - B1)
- Form tiếp nhận: search sản phẩm, IMEI, model, khách hàng
- Loại yêu cầu (CRUD)
- Trạng thái, giá dự kiến, ghi chú, upload hình
- Thông tin khách hàng (tìm/thêm)
- Nhân viên tiếp nhận, ngày hẹn trả
- In phiếu + QR code

### Giai đoạn 4: Xử lý sửa chữa (Processing - B2)
- Danh sách phiếu theo trạng thái
- Kỹ thuật viên cập nhật trạng thái realtime
- Thêm dịch vụ/linh kiện (2 loại: thay linh kiện từ kho, chỉ sửa)
- Popup nhập linh kiện mới → ghi sổ quỹ
- Highlight khi hoàn thành

### Giai đoạn 5: Trả khách & Thanh toán (B3)
- Chuyển phiếu sửa → đơn bán hàng
- Thanh toán (tiền mặt, CK, combo)
- Logic tài chính: lợi nhuận sửa vs thay linh kiện
- Ghi sổ quỹ, doanh thu, lịch sử bán
- Filter "Đơn sửa chữa" trong bán hàng & báo cáo

### Giai đoạn 6: Tra cứu & Bảo hành
- Tra cứu online: SĐT, mã phiếu (dùng chung hệ thống bảo hành)
- Bảo hành sau sửa: chọn lại phiếu cũ, xem lịch sử
- Bộ lọc "Sửa chữa" trong báo cáo doanh thu/lợi nhuận
