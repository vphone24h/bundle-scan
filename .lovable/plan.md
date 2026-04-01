

# Kế hoạch: Chỉnh sửa ngày nhập/xuất ở cấp phiếu + Thêm trường ngày giờ xuất khi bán hàng

## Tổng quan
3 yêu cầu:
1. **Phiếu nhập**: Thêm trường ngày giờ nhập vào dialog "Chỉnh sửa phiếu nhập" → đồng bộ tất cả sản phẩm bên trong
2. **Phiếu xuất**: Tạo dialog "Chỉnh sửa phiếu xuất" tương tự → cho sửa ngày bán ở cấp phiếu
3. **Xuất hàng mới**: Thêm trường chọn ngày giờ xuất vào form bán hàng (ExportNewPage)

Tất cả đều yêu cầu: mật khẩu bảo mật (nếu bật), ghi audit log việt hóa, highlight xanh lá.

---

## Chi tiết kỹ thuật

### 1. Database Migration
- Thêm cột `import_date_modified` (boolean, default false) vào bảng `import_receipts` — để highlight phiếu nhập đã sửa ngày

### 2. Chỉnh sửa phiếu nhập — `EditImportReceiptDialog.tsx`
- Thêm trường `datetime-local` cho ngày nhập (lấy từ `receipt.import_date`)
- Khi lưu: cập nhật `import_receipts.import_date` + `import_date_modified = true`
- Đồng bộ tất cả `products` trong phiếu: cập nhật `products.import_date` + `products.import_date_modified = true`
- Yêu cầu mật khẩu bảo mật nếu đã bật (dùng `useSecurityPasswordStatus` + `SecurityPasswordDialog`)
- Ghi audit log: action_type = `UPDATE_IMPORT_DATE`, description việt hóa (ngày trước → ngày sau)

### 3. Tạo `EditExportReceiptDialog.tsx` — Chỉnh sửa phiếu xuất
- Dialog mới cho phép sửa ngày bán ở cấp phiếu (tương tự đã có ở cấp sản phẩm)
- Cập nhật `export_receipts.export_date` + `export_date_modified = true`
- Yêu cầu mật khẩu bảo mật + ghi audit log
- Tích hợp vào `ExportHistoryPage.tsx` tab "Theo phiếu xuất" — thêm nút sửa

### 4. Highlight xanh lá cho phiếu
- Tab "Theo phiếu nhập" (`ImportHistoryPage`): highlight `bg-green-50` cho phiếu có `import_date_modified = true`
- Tab "Theo phiếu xuất" (`ExportHistoryPage`): đã có `export_date_modified` → chỉ cần áp highlight

### 5. Thêm trường ngày giờ xuất khi bán hàng — `ExportNewPage.tsx`
- Thêm input `datetime-local` vào form bán hàng (mặc định = thời điểm hiện tại)
- Truyền `export_date` vào `useCreateExportReceipt` → insert vào `export_receipts.export_date`
- Cập nhật hook `useCreateExportReceipt` để nhận tham số `exportDate` tùy chọn

### 6. Cập nhật `useUpdateImportReceipt` hook
- Thêm tham số `importDate` tùy chọn để cập nhật ngày nhập phiếu + đồng bộ products

