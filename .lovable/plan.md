

## Redesign bộ lọc biểu đồ giá trị toàn kho

### Vấn đề hiện tại
Biểu đồ chỉ có 1 bộ lọc thời gian (7 ngày, 30 ngày, Tháng này, 3 tháng, Tùy chọn) và hiển thị mỗi ngày 1 cột. Khi chọn khoảng dài (3 tháng), biểu đồ quá nhiều cột, khó đọc.

### Thiết kế mới: 2 bộ lọc tách biệt

**Bộ lọc 1 — Khoảng thời gian:**
- Tuần này
- Tháng này
- Tháng trước
- Năm nay
- Tùy chỉnh (chọn ngày bắt đầu/kết thúc)
- Toàn bộ (tất cả dữ liệu snapshot)

**Bộ lọc 2 — Nhóm cột (granularity):**
- 1 ngày (mỗi cột = 1 ngày snapshot)
- 7 ngày (mỗi cột = tổng hợp trung bình 7 ngày)
- 30 ngày (mỗi cột = tổng hợp trung bình 30 ngày)

### Chi tiết kỹ thuật

**File: `src/components/reports/WarehouseValueChart.tsx`**
- Thay `TIME_OPTIONS` cũ bằng 2 bộ lọc riêng biệt: `RANGE_OPTIONS` và `GROUP_OPTIONS`
- State mới: `timeRange` (week/month/last_month/year/custom/all) + `groupBy` (1/7/30)
- Tính `fromDate`/`toDate` dựa trên `timeRange` (dùng date-fns: startOfWeek, startOfMonth, startOfYear)
- "Toàn bộ": không truyền giới hạn ngày, lấy tất cả snapshots
- "Tháng trước": startOfMonth(subMonths(now,1)) đến endOfMonth(subMonths(now,1))

**File: `src/hooks/useWarehouseValueSnapshots.ts`**
- Thêm logic aggregate data theo `groupBy`:
  - Nhóm các snapshot theo khoảng (7 ngày hoặc 30 ngày)
  - Mỗi nhóm tính giá trị trung bình (hoặc lấy giá trị cuối cùng trong nhóm)
  - Hiển thị label dạng "01/03 - 07/03" cho nhóm 7 ngày, "Tháng 03" cho nhóm 30 ngày
- Khi `groupBy = 1`: giữ nguyên logic hiện tại (mỗi snapshot 1 điểm)

**Hiệu ứng mặc định:** Mặc định chọn "Tháng này" + "1 ngày" để giữ trải nghiệm tương tự hiện tại.

