import QRCode from 'qrcode';

interface WarrantyQrCardOptions {
  label: string;
  qrUrl: string;
}

const CARD_WIDTH = 240;
const QR_SIZE = 180;
const CARD_PADDING = 16;
const LABEL_FONT_SIZE = 22;
const LABEL_LINE_HEIGHT = 30;
const LABEL_MAX_WIDTH = CARD_WIDTH - CARD_PADDING * 2;

function wrapText(context: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [''];

  const lines: string[] = [];
  let currentLine = words[0];

  for (let index = 1; index < words.length; index += 1) {
    const testLine = `${currentLine} ${words[index]}`;
    if (context.measureText(testLine).width <= maxWidth) {
      currentLine = testLine;
      continue;
    }

    lines.push(currentLine);
    currentLine = words[index];
  }

  lines.push(currentLine);
  return lines;
}

export async function generateWarrantyQrCard({ label, qrUrl }: WarrantyQrCardOptions): Promise<string> {
  const qrDataUrl = await QRCode.toDataURL(qrUrl, {
    width: QR_SIZE,
    margin: 1,
    errorCorrectionLevel: 'M',
  });

  const qrImage = new Image();
  qrImage.src = qrDataUrl;
  await new Promise<void>((resolve, reject) => {
    qrImage.onload = () => resolve();
    qrImage.onerror = () => reject(new Error('QR image load failed'));
  });

  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas context unavailable');

  context.font = `italic ${LABEL_FONT_SIZE}px Arial`;
  const safeLabel = label.trim() || 'Quét mã để tra cứu bảo hành';
  const labelLines = wrapText(context, safeLabel, LABEL_MAX_WIDTH);
  const labelHeight = Math.max(labelLines.length, 1) * LABEL_LINE_HEIGHT;

  canvas.width = CARD_WIDTH;
  canvas.height = CARD_PADDING + QR_SIZE + 10 + labelHeight + CARD_PADDING;

  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);

  const qrX = Math.round((CARD_WIDTH - QR_SIZE) / 2);
  context.drawImage(qrImage, qrX, CARD_PADDING, QR_SIZE, QR_SIZE);

  context.font = `italic ${LABEL_FONT_SIZE}px Arial`;
  context.fillStyle = '#555555';
  context.textAlign = 'center';
  context.textBaseline = 'top';

  labelLines.forEach((line, index) => {
    context.fillText(line, CARD_WIDTH / 2, CARD_PADDING + QR_SIZE + 10 + index * LABEL_LINE_HEIGHT);
  });

  return canvas.toDataURL('image/png');
}