import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { CameraScanner } from '@/components/export/CameraScanner';
import { ScanLine } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

export interface VKHOQRData {
  imei?: string;
  productName?: string;
  sku?: string;
  importPrice?: number;
  salePrice?: number;
  note?: string;
}

/**
 * Parse VKHO QR code format.
 * Supported formats:
 *  - "IMEI|Price"
 *  - "IMEI|Name|Price"
 *  - "IMEI|Name|SKU|Price"
 *  - JSON { imei, name, sku, import_price, sale_price, note }
 *  - Plain IMEI/barcode string
 */
export function parseVKHOQR(raw: string): VKHOQRData | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Try JSON format first
  if (trimmed.startsWith('{')) {
    try {
      const obj = JSON.parse(trimmed);
      if (!obj.imei && !obj.name && !obj.sku) return null;
      return {
        imei: obj.imei || undefined,
        productName: obj.name || obj.productName || undefined,
        sku: obj.sku || undefined,
        // QR price = giá bán kho cũ → map to salePrice, NOT importPrice (tránh lộ giá vốn)
        importPrice: undefined,
        salePrice: obj.sale_price != null ? Number(obj.sale_price) : (obj.salePrice != null ? Number(obj.salePrice) : (obj.import_price != null ? Number(obj.import_price) : (obj.importPrice != null ? Number(obj.importPrice) : undefined))),
        note: obj.note || undefined,
      };
    } catch {
      // Not JSON, try pipe format
    }
  }

  // Pipe-delimited format
  const parts = trimmed.split('|').map(s => s.trim()).filter(Boolean);

  if (parts.length === 1) {
    return { imei: parts[0] };
  }

  if (parts.length === 2) {
    const price = Number(parts[1]);
    if (!isNaN(price) && price > 0) {
      // Price from QR = giá bán kho cũ → salePrice
      return { imei: parts[0], salePrice: price };
    }
    return { imei: parts[0], productName: parts[1] };
  }

  // 3+ parts: last part is always price
  const lastPart = parts[parts.length - 1];
  const price = Number(lastPart);

  if (parts.length === 3) {
    if (!isNaN(price) && price > 0) {
      return { imei: parts[0], productName: parts[1], salePrice: price };
    }
    return { imei: parts[0], productName: parts[1], sku: parts[2] };
  }

  if (parts.length >= 4) {
    if (!isNaN(price) && price > 0) {
      return { imei: parts[0], productName: parts[1], sku: parts[2], salePrice: price };
    }
    return { imei: parts[0], productName: parts[1], sku: parts[2] };
  }

  return null;
}

interface ImportQRScannerProps {
  /** Called with parsed QR data. `continuous` indicates scanner mode. */
  onScanResult: (data: VKHOQRData, continuous: boolean) => void;
}

export function ImportQRScanner({ onScanResult }: ImportQRScannerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [continuous, setContinuous] = useState(false);

  const handleScan = useCallback((code: string) => {
    const parsed = parseVKHOQR(code);
    if (!parsed) {
      toast({
        title: 'QR không đúng định dạng VKHO',
        description: `Nội dung: ${code.length > 60 ? code.slice(0, 60) + '...' : code}`,
        variant: 'destructive',
      });
      return;
    }
    onScanResult(parsed, continuous);
    if (!continuous) {
      setIsOpen(false);
    }
  }, [onScanResult, continuous]);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={() => setIsOpen(true)}
        title="Quét QR nhập hàng nhanh"
        className="shrink-0"
      >
        <ScanLine className="h-4 w-4" />
      </Button>

      {isOpen && (
        <div className="fixed inset-0 z-[60] bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-card border rounded-xl shadow-lg overflow-hidden">
            {/* Continuous toggle */}
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <ScanLine className="h-4 w-4" />
                Quét QR nhập hàng
              </h3>
              <div className="flex items-center gap-2">
                <Label htmlFor="continuous-toggle" className="text-xs text-muted-foreground cursor-pointer">
                  Quét liên tục
                </Label>
                <Switch
                  id="continuous-toggle"
                  checked={continuous}
                  onCheckedChange={setContinuous}
                />
              </div>
            </div>

            {/* Embedded camera - using the scanner directly without CameraScanner's own overlay */}
            <ImportQRCameraInner
              continuous={continuous}
              onScan={handleScan}
              onClose={() => setIsOpen(false)}
            />
          </div>
        </div>
      )}
    </>
  );
}

/**
 * Inner camera component that reuses the html5-qrcode scanner logic
 * without the full CameraScanner overlay (we provide our own).
 */
import { useEffect, useRef } from 'react';
import { Camera, X, SwitchCamera, Loader2 } from 'lucide-react';

function ImportQRCameraInner({
  continuous,
  onScan,
  onClose,
}: {
  continuous: boolean;
  onScan: (code: string) => void;
  onClose: () => void;
}) {
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [isScanning, setIsScanning] = useState(false);
  const [scanFeedback, setScanFeedback] = useState<string | null>(null);
  const [scannerKey, setScannerKey] = useState(0);

  const scannerRef = useRef<any>(null);
  const html5QrcodeModuleRef = useRef<any>(null);
  const isMountedRef = useRef(true);
  const lastScannedRef = useRef<string | null>(null);
  const scanCooldownRef = useRef(false);
  const continuousRef = useRef(continuous);
  continuousRef.current = continuous;

  const playBeep = useCallback(() => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 1200;
      osc.type = 'sine';
      gain.gain.value = 0.3;
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } catch {}
  }, []);

  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        const state = scannerRef.current.getState();
        if (state === 2 || state === 1) await scannerRef.current.stop();
      } catch {}
      try { scannerRef.current.clear(); } catch {}
      scannerRef.current = null;
    }
    const el = document.getElementById('import-qr-reader');
    if (el) el.innerHTML = '';
    setIsScanning(false);
  }, []);

  const startScanner = useCallback(async (currentFacing: 'environment' | 'user') => {
    if (!isMountedRef.current) return;
    const el = document.getElementById('import-qr-reader');
    if (!el) {
      setTimeout(() => isMountedRef.current && startScanner(currentFacing), 100);
      return;
    }

    setIsStarting(true);
    setError(null);

    try {
      await stopScanner();
      await new Promise(r => setTimeout(r, 100));
      if (!isMountedRef.current) return;

      if (!html5QrcodeModuleRef.current) {
        html5QrcodeModuleRef.current = await import('html5-qrcode');
      }
      if (!isMountedRef.current) return;

      const { Html5Qrcode, Html5QrcodeSupportedFormats } = html5QrcodeModuleRef.current;
      el.innerHTML = '';

      const rect = el.getBoundingClientRect();
      const effectiveW = rect.width || 320;
      const effectiveH = rect.height || 320;
      const qrBoxWidth = Math.max(220, Math.min(520, Math.floor(effectiveW * 0.9)));
      const qrBoxHeight = Math.max(160, Math.min(300, Math.floor(effectiveH * 0.55)));

      const scanner = new Html5Qrcode('import-qr-reader', {
        formatsToSupport: [
          Html5QrcodeSupportedFormats.QR_CODE,
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
        ],
        experimentalFeatures: { useBarCodeDetectorIfSupported: true },
        verbose: false,
      });
      scannerRef.current = scanner;

      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const constraints: MediaTrackConstraints = isIOS
        ? { facingMode: currentFacing }
        : { facingMode: currentFacing, width: { ideal: 1280 }, height: { ideal: 720 } };

      await scanner.start(
        constraints,
        { fps: isIOS ? 15 : 20, qrbox: { width: qrBoxWidth, height: qrBoxHeight }, disableFlip: false },
        (decoded: string) => {
          const normalized = decoded?.trim?.() ?? decoded;
          if (scanCooldownRef.current || !normalized) return;
          if (lastScannedRef.current === normalized) return;

          scanCooldownRef.current = true;
          lastScannedRef.current = normalized;
          playBeep();

          onScan(normalized);
          setScanFeedback(normalized);
          setTimeout(() => setScanFeedback(null), 1500);
          setTimeout(() => {
            scanCooldownRef.current = false;
            lastScannedRef.current = null;
          }, 1500);
        },
        () => {}
      );
      setIsScanning(true);
    } catch (err: any) {
      if (!isMountedRef.current) return;
      if (err.name === 'OverconstrainedError' && currentFacing === 'environment') {
        startScanner('user');
        return;
      }
      setError(err.name === 'NotAllowedError' ? 'Vui lòng cho phép truy cập camera' :
               err.name === 'NotFoundError' ? 'Không tìm thấy camera' :
               'Không thể khởi động camera');
    } finally {
      if (isMountedRef.current) setIsStarting(false);
    }
  }, [stopScanner, playBeep, onScan]);

  const startScannerRef = useRef(startScanner);
  startScannerRef.current = startScanner;
  const stopScannerRef = useRef(stopScanner);
  stopScannerRef.current = stopScanner;
  const facingModeRef = useRef(facingMode);
  facingModeRef.current = facingMode;

  useEffect(() => {
    isMountedRef.current = true;
    lastScannedRef.current = null;
    scanCooldownRef.current = false;
    stopScannerRef.current().then(() => setScannerKey(k => k + 1));
    return () => {
      isMountedRef.current = false;
      stopScannerRef.current();
    };
  }, []);

  useEffect(() => {
    if (scannerKey > 0) {
      const t = setTimeout(() => isMountedRef.current && startScannerRef.current(facingModeRef.current), 400);
      return () => clearTimeout(t);
    }
  }, [scannerKey]);

  const handleClose = useCallback(() => {
    stopScanner();
    onClose();
  }, [stopScanner, onClose]);

  return (
    <div className="p-4 space-y-3">
      <div
        className="relative bg-muted rounded-lg overflow-hidden"
        style={{ minHeight: '280px' }}
      >
        <div id="import-qr-reader" key={scannerKey} className="w-full" />

        {isStarting && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/50">
            <div className="text-center space-y-2">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
              <p className="text-sm text-muted-foreground">Đang khởi động camera...</p>
            </div>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 p-4">
            <div className="text-center space-y-3">
              <p className="text-sm text-destructive">{error}</p>
              <Button variant="secondary" size="sm" onClick={() => startScanner(facingMode)}>
                Thử lại
              </Button>
            </div>
          </div>
        )}

        {isScanning && !error && !scanFeedback && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2">
            <div className="bg-primary/90 text-primary-foreground text-xs px-3 py-1 rounded-full animate-pulse">
              Đang quét...
            </div>
          </div>
        )}

        {scanFeedback && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10">
            <div className="bg-primary text-primary-foreground text-xs px-4 py-2 rounded-full font-medium shadow-lg animate-in fade-in zoom-in-95">
              ✓ Đã quét thành công
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <Button
          variant="outline"
          className="flex-1"
          onClick={() => {
            const newMode = facingMode === 'environment' ? 'user' : 'environment';
            setFacingMode(newMode);
            stopScanner().then(() => startScanner(newMode));
          }}
          disabled={isStarting}
        >
          <SwitchCamera className="h-4 w-4 mr-2" />
          Đổi camera
        </Button>
        <Button variant="destructive" className="flex-1" onClick={handleClose}>
          <X className="h-4 w-4 mr-2" />
          Đóng
        </Button>
      </div>
    </div>
  );
}
