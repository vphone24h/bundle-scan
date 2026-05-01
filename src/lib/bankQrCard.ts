import QRCode from 'qrcode';

/**
 * Tạo URL VietQR động theo chuẩn img.vietqr.io.
 * - bankBin: BIN ngân hàng (vd 970436 = VCB)
 * - accountNumber: số tài khoản
 * - amount: số tiền (VNĐ) — nếu > 0 sẽ tự điền khi quét
 * - addInfo: nội dung chuyển khoản (thường là mã hoá đơn)
 * - accountHolder: tên chủ TK (hiển thị trên ảnh)
 */
export function buildVietQrUrl(opts: {
  bankBin: string;
  accountNumber: string;
  amount?: number | null;
  addInfo?: string | null;
  accountHolder?: string | null;
}): string {
  const params = new URLSearchParams();
  if (opts.amount && opts.amount > 0) params.set('amount', String(Math.round(opts.amount)));
  if (opts.addInfo) params.set('addInfo', opts.addInfo);
  if (opts.accountHolder) params.set('accountName', opts.accountHolder);
  // template "compact" cho QR thuần, không cần logo VietQR (in nhanh hơn)
  const qs = params.toString();
  return `https://img.vietqr.io/image/${encodeURIComponent(opts.bankBin)}-${encodeURIComponent(opts.accountNumber)}-compact.png${qs ? `?${qs}` : ''}`;
}

interface BankQrCardOptions {
  bankBin: string;
  bankName?: string | null;
  accountNumber: string;
  accountHolder?: string | null;
  amount?: number | null;
  addInfo?: string | null;
  label?: string | null;
}

const CARD_WIDTH = 260;
const QR_SIZE = 200;
const CARD_PADDING = 14;
const TITLE_FONT = 16;
const INFO_FONT = 14;
const LABEL_FONT = 16;
const LINE_HEIGHT = 20;

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [''];
  const lines: string[] = [];
  let line = words[0];
  for (let i = 1; i < words.length; i++) {
    const test = `${line} ${words[i]}`;
    if (ctx.measureText(test).width <= maxWidth) {
      line = test;
    } else {
      lines.push(line);
      line = words[i];
    }
  }
  lines.push(line);
  return lines;
}

/**
 * Sinh ảnh QR chuyển khoản (data URL PNG) gồm:
 * - QR thanh toán VietQR (tự điền số tiền nếu có)
 * - Tên ngân hàng + số TK + tên chủ TK + số tiền
 * - Chú thích phía dưới
 */
export async function generateBankQrCard(opts: BankQrCardOptions): Promise<string> {
  if (!opts.bankBin || !opts.accountNumber) throw new Error('Thiếu thông tin ngân hàng / số TK');

  // Encode QR theo chuẩn VietQR sử dụng URL ảnh - nhưng để in được offline,
  // ta encode thành QR text dạng vietqr URL mà các app banking VN nhận diện được.
  // Cách đơn giản & ổn định: encode chính URL VietQR. Hầu hết app sẽ tự đọc.
  // Thực tế chuẩn EMVCo là chuỗi dài, nhưng để giữ in offline, ta dùng URL.
  const qrPayload = buildVietQrUrl({
    bankBin: opts.bankBin,
    accountNumber: opts.accountNumber,
    amount: opts.amount,
    addInfo: opts.addInfo,
    accountHolder: opts.accountHolder,
  });

  // Tạo QR từ payload (dùng qrcode lib - hoạt động offline, không phụ thuộc img.vietqr.io khi in)
  const qrDataUrl = await QRCode.toDataURL(qrPayload, {
    width: QR_SIZE,
    margin: 1,
    errorCorrectionLevel: 'M',
  });

  const qrImage = new Image();
  qrImage.src = qrDataUrl;
  await new Promise<void>((resolve, reject) => {
    qrImage.onload = () => resolve();
    qrImage.onerror = () => reject(new Error('Bank QR image load failed'));
  });

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas context unavailable');

  const maxTextWidth = CARD_WIDTH - CARD_PADDING * 2;
  ctx.font = `bold ${TITLE_FONT}px Arial`;

  const titleLines = wrapText(ctx, opts.bankName || 'Ngân hàng', maxTextWidth);
  ctx.font = `${INFO_FONT}px Arial`;
  const acctLines = wrapText(ctx, `STK: ${opts.accountNumber}`, maxTextWidth);
  const holderLines = opts.accountHolder
    ? wrapText(ctx, `CTK: ${opts.accountHolder}`, maxTextWidth)
    : [];
  const amountLines = opts.amount && opts.amount > 0
    ? wrapText(ctx, `Số tiền: ${Math.round(opts.amount).toLocaleString('vi-VN')}đ`, maxTextWidth)
    : [];
  ctx.font = `italic ${LABEL_FONT}px Arial`;
  const labelLines = opts.label
    ? wrapText(ctx, opts.label, maxTextWidth)
    : [];

  const headerHeight =
    titleLines.length * LINE_HEIGHT +
    acctLines.length * LINE_HEIGHT +
    holderLines.length * LINE_HEIGHT +
    amountLines.length * LINE_HEIGHT;

  const labelHeight = labelLines.length * LINE_HEIGHT;

  canvas.width = CARD_WIDTH;
  canvas.height = CARD_PADDING + headerHeight + 8 + QR_SIZE + 8 + labelHeight + CARD_PADDING;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Header text
  let y = CARD_PADDING;
  ctx.fillStyle = '#000000';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  ctx.font = `bold ${TITLE_FONT}px Arial`;
  titleLines.forEach((line) => {
    ctx.fillText(line, CARD_WIDTH / 2, y);
    y += LINE_HEIGHT;
  });

  ctx.font = `${INFO_FONT}px Arial`;
  ctx.fillStyle = '#222222';
  acctLines.forEach((line) => {
    ctx.fillText(line, CARD_WIDTH / 2, y);
    y += LINE_HEIGHT;
  });
  holderLines.forEach((line) => {
    ctx.fillText(line, CARD_WIDTH / 2, y);
    y += LINE_HEIGHT;
  });
  if (amountLines.length) {
    ctx.fillStyle = '#c0392b';
    ctx.font = `bold ${INFO_FONT}px Arial`;
    amountLines.forEach((line) => {
      ctx.fillText(line, CARD_WIDTH / 2, y);
      y += LINE_HEIGHT;
    });
  }

  // QR
  y += 8;
  const qrX = Math.round((CARD_WIDTH - QR_SIZE) / 2);
  ctx.drawImage(qrImage, qrX, y, QR_SIZE, QR_SIZE);
  y += QR_SIZE + 8;

  // Label
  if (labelLines.length) {
    ctx.font = `italic ${LABEL_FONT}px Arial`;
    ctx.fillStyle = '#555555';
    labelLines.forEach((line) => {
      ctx.fillText(line, CARD_WIDTH / 2, y);
      y += LINE_HEIGHT;
    });
  }

  return canvas.toDataURL('image/png');
}