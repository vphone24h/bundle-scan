import QRCode from 'qrcode';

/**
 * Tính CRC16-CCITT (FALSE) — chuẩn dùng cho VietQR / EMVCo.
 */
function crc16CCITT(input: string): string {
  let crc = 0xffff;
  for (let i = 0; i < input.length; i++) {
    crc ^= input.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if (crc & 0x8000) crc = ((crc << 1) ^ 0x1021) & 0xffff;
      else crc = (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

/** TLV helper: id (2) + length (2) + value */
function tlv(id: string, value: string): string {
  const len = value.length.toString().padStart(2, '0');
  return `${id}${len}${value}`;
}

/**
 * Build chuỗi VietQR theo chuẩn EMVCo (NAPAS 247) — chuỗi này
 * khi encode thành QR thì các app banking VN (MoMo, Vietcombank,
 * MB, Techcombank, OCB...) sẽ tự nhận diện và điền sẵn TK + số tiền.
 *
 * Tham khảo: https://vietqr.net/portal-service/resources/icons/CDTT_QR.pdf
 */
export function buildVietQrPayload(opts: {
  bankBin: string;            // BIN NAPAS, vd 970448 = OCB
  accountNumber: string;
  amount?: number | null;
  addInfo?: string | null;    // nội dung chuyển khoản
  serviceCode?: 'QRIBFTTA' | 'QRIBFTTC'; // TA = chuyển TK, TC = chuyển thẻ
}): string {
  const service = opts.serviceCode || 'QRIBFTTA';

  // Merchant Account Information (id 38) cho NAPAS
  // 00: GUID = "A000000727"
  // 01: Beneficiary Org = TLV( 00=acquirerBIN, 01=accountNumber )
  // 02: Service code
  const guid = tlv('00', 'A000000727');
  const beneficiary = tlv(
    '01',
    tlv('00', opts.bankBin) + tlv('01', opts.accountNumber),
  );
  const svc = tlv('02', service);
  const merchantAccountInfo = tlv('38', guid + beneficiary + svc);

  const payloadFormat = tlv('00', '01');
  // 11 = static (không có amount), 12 = dynamic (có amount). Ta dùng 12 nếu có amount.
  const hasAmount = !!(opts.amount && opts.amount > 0);
  const pointOfInit = tlv('01', hasAmount ? '12' : '11');
  const currency = tlv('53', '704'); // VND
  const amountField = hasAmount ? tlv('54', String(Math.round(opts.amount as number))) : '';
  const country = tlv('58', 'VN');

  // Additional data (id 62) — 08: nội dung chuyển khoản
  let additional = '';
  if (opts.addInfo) {
    // chỉ giữ ASCII, tránh dấu tiếng Việt làm app banking từ chối
    const safe = opts.addInfo
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .replace(/[^\x20-\x7e]/g, '')
      .slice(0, 25);
    if (safe) additional = tlv('62', tlv('08', safe));
  }

  const base =
    payloadFormat +
    pointOfInit +
    merchantAccountInfo +
    currency +
    amountField +
    country +
    additional +
    '6304'; // CRC tag + length placeholder

  const crc = crc16CCITT(base);
  return base + crc;
}

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

  // Encode QR theo CHUẨN EMVCo / NAPAS 247 (VietQR) — chuỗi này
  // mới được app banking (MoMo, VCB, MB, OCB...) nhận diện và tự
  // điền số tiền + nội dung. KHÔNG dùng URL img.vietqr.io vì khi
  // quét app banking sẽ báo "Mã không được hỗ trợ thanh toán".
  const qrPayload = buildVietQrPayload({
    bankBin: opts.bankBin,
    accountNumber: opts.accountNumber,
    amount: opts.amount,
    addInfo: opts.addInfo,
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