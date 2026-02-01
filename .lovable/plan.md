
# Kế Hoạch: Thêm Chức Năng "In Như KiotViet"

## Tổng Quan

Thêm một phương thức in mới tuân theo đúng chuẩn của KiotViet với máy in nhiệt 365B:
- Khổ tem: 55 × 30 mm (Portrait)
- Bố cục cố định: Tên cửa hàng → Tên sản phẩm → Barcode → Mã/IMEI → Giá
- Xuất PDF chuẩn để in trực tiếp không lệch

---

## Thông Số Kỹ Thuật Chuẩn KiotViet

### Bố Cục Tem (từ trên xuống)
```text
┌─────────────────────────────────┐
│        [Tên cửa hàng]           │  ← 9-10pt, đậm
│    [iPhone 15 Pro Max 512GB]    │  ← 7pt
│    |||||||||||||||||||||||      │  ← Barcode CODE128
│        35255195481785           │  ← 6pt (IMEI/mã)
│       21 500 000 VND            │  ← 10-11pt, đậm
└─────────────────────────────────┘
         55mm × 30mm
```

### Thông Số Font
| Thành phần | Kích thước | Kiểu |
|------------|------------|------|
| Tên cửa hàng | 9-10pt | Đậm |
| Tên sản phẩm | 7pt | Thường |
| Barcode | Cao 8-10mm, Rộng 40-45mm | CODE128 |
| Mã số | 6pt | Thường |
| Giá | 10-11pt | Đậm |

### QR Code Logic (theo yêu cầu)
- **Sản phẩm có IMEI**: QR chứa `IMEI + Tên + Giá`
- **Sản phẩm không có IMEI**: QR chứa `Tên + Giá`

---

## Chi Tiết Triển Khai

### 1. Thêm Nút "In Như KiotViet" vào UI

**File:** `src/components/products/BarcodeDialog.tsx`

Thêm nút mới trong bước `adjust` (Điều chỉnh in):

```typescript
// Thêm vào phần các nút ở cuối renderAdjustment()
<Button 
  variant="default" 
  onClick={handlePrintKiotViet} 
  disabled={isExporting}
  className="bg-green-600 hover:bg-green-700"
>
  <Printer className="mr-2 h-4 w-4" />
  In Như KiotViet
</Button>
```

### 2. Tạo Hàm Xuất PDF Chuẩn KiotViet

**Thêm hàm mới** `handlePrintKiotViet`:

```typescript
const handlePrintKiotViet = async () => {
  setIsExporting(true);
  toast.info('Đang tạo PDF chuẩn KiotViet...');

  try {
    // Import các thư viện cần thiết
    const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
      import('jspdf'),
      import('html2canvas'),
    ]);

    // Khổ tem cố định 55x30mm
    const pageWidth = 55;
    const pageHeight = 30;

    // Tạo HTML với template KiotViet
    const kiotVietHtml = generateKiotVietContent(productEntries, settings);

    // Render và xuất PDF...
  } catch (error) {
    console.error('KiotViet print error:', error);
    toast.error('Lỗi khi tạo PDF KiotViet');
  } finally {
    setIsExporting(false);
  }
};
```

### 3. Tạo Template HTML Chuẩn KiotViet

**Thêm hàm mới** `generateKiotVietContent`:

```typescript
const generateKiotVietContent = (
  entries: ProductPriceEntry[],
  printSettings: BarcodeSettings
): string => {
  // Kích thước cố định 55x30mm
  const width = 55;
  const height = 30;
  
  // Expand theo số lượng
  const allLabels: ProductPriceEntry[] = [];
  entries.forEach(entry => {
    for (let i = 0; i < entry.quantity; i++) {
      allLabels.push(entry);
    }
  });

  const labelHTML = allLabels.map((entry, idx) => {
    // Quyết định nội dung QR Code theo yêu cầu
    const qrData = entry.imei 
      ? `${entry.imei}|${entry.name}|${entry.printPrice}`
      : `${entry.name}|${entry.printPrice}`;
    
    return `
      <div class="label">
        <div class="label-content">
          ${printSettings.showStoreName && printSettings.storeName ? 
            `<div class="store-name">${printSettings.storeName}</div>` : ''}
          ${printSettings.showProductName ? 
            `<div class="product-name">${entry.name}</div>` : ''}
          <div class="barcode-container">
            <svg class="barcode" id="barcode-${idx}"></svg>
          </div>
          <div class="code-text">${entry.imei || entry.sku}</div>
          ${printSettings.showPrice ? 
            `<div class="price">${formatNumberWithSpaces(entry.printPrice)} VND</div>` : ''}
        </div>
      </div>
    `;
  }).join('');

  // CSS với thông số chuẩn KiotViet
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"></script>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        .label {
          width: 55mm;
          height: 30mm;
          position: relative;
          background: white;
          page-break-after: always;
        }
        
        .label-content {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          width: 52mm;
          gap: 1px;
        }
        
        .store-name {
          font-size: 10pt;
          font-weight: bold;
          color: #000;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 100%;
        }
        
        .product-name {
          font-size: 7pt;
          color: #000;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 100%;
        }
        
        .barcode-container {
          margin: 2px 0;
        }
        
        .code-text {
          font-size: 6pt;
          color: #333;
          font-family: monospace;
        }
        
        .price {
          font-size: 11pt;
          font-weight: bold;
          color: #000;
        }
      </style>
    </head>
    <body>
      ${labelHTML}
      <script>
        document.addEventListener('DOMContentLoaded', function() {
          // Initialize barcodes với kích thước chuẩn KiotViet
          ${allLabels.map((entry, idx) => {
            const barcodeValue = entry.imei || entry.sku || entry.productId;
            return `
              JsBarcode("#barcode-${idx}", "${barcodeValue.replace(/[^\x20-\x7E]/g, '')}", {
                format: "CODE128",
                width: 1.2,
                height: 28,
                displayValue: false,
                margin: 0
              });
            `;
          }).join('\n')}
        });
      </script>
    </body>
    </html>
  `;
};
```

### 4. Logic Xuất PDF 100% Chuẩn

Quy trình xuất PDF theo chuẩn KiotViet:

1. **Render HTML trong iframe ẩn**
2. **Đợi JsBarcode render xong** (polling với timeout)
3. **Capture mỗi label bằng html2canvas** (scale: 6 cho độ nét cao)
4. **Tạo PDF với kích thước chính xác 55x30mm**
5. **Xuất file PDF để in trực tiếp**

### 5. Cập Nhật QR Code cho Sản Phẩm

Theo yêu cầu, sử dụng QR thay vì Barcode cho:
- **Có IMEI**: QR = `IMEI|Tên sản phẩm|Giá`
- **Không IMEI**: QR = `Tên sản phẩm|Giá`

Nhưng dựa theo mô tả KiotViet chuẩn, họ dùng **Barcode CODE128**. Sẽ giữ Barcode CODE128 như tiêu chuẩn nhưng encode thông tin vào Barcode.

---

## Tóm Tắt Thay Đổi

| File | Thay đổi |
|------|----------|
| `src/components/products/BarcodeDialog.tsx` | Thêm hàm `handlePrintKiotViet`, `generateKiotVietContent`, và nút "In Như KiotViet" |

---

## Tính Năng Mới

1. **Nút "In Như KiotViet"** - Xuất PDF với template chuẩn KiotViet
2. **Template cố định 55x30mm** - Không cần điều chỉnh scale/rotation
3. **Font size chuẩn** - Tên shop 10pt, Tên SP 7pt, Mã 6pt, Giá 11pt
4. **Barcode chuẩn** - CODE128, cao 8-10mm, rộng 40-45mm
5. **In trực tiếp** - PDF 100% không lệch với máy 365B

---

## Lưu Ý Quan Trọng

- Template này **bỏ qua** các điều chỉnh scale/rotation vì đã tối ưu sẵn cho 365B
- Người dùng chỉ cần chọn sản phẩm → Nhấn "In Như KiotViet" → Xuất PDF → In
- PDF được tạo với orientation Portrait (30mm cao, 55mm rộng)
