import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Camera, X, SwitchCamera, Loader2 } from 'lucide-react';

interface CameraScannerProps {
  onScan: (code: string) => void;
  onClose: () => void;
  isOpen: boolean;
  continuous?: boolean;
}

export function CameraScanner({ onScan, onClose, isOpen, continuous = false }: CameraScannerProps) {
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [isScanning, setIsScanning] = useState(false);
  const [scanFeedback, setScanFeedback] = useState<string | null>(null);
  
  const scannerRef = useRef<any>(null);
  const html5QrcodeModuleRef = useRef<any>(null);
  const isMountedRef = useRef(true);
  const lastScannedRef = useRef<string | null>(null);
  const scanCooldownRef = useRef(false);
  const [scannerKey, setScannerKey] = useState(0);

  const playBeep = useCallback(() => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = 1200;
      oscillator.type = 'sine';
      gainNode.gain.value = 0.3;
      
      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.15);
    } catch (e) {
      // Audio not available
    }
  }, []);

  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        const state = scannerRef.current.getState();
        // State 2 = SCANNING, State 1 = PAUSED
        if (state === 2 || state === 1) {
          await scannerRef.current.stop();
        }
      } catch (e) {
        console.log('Scanner stop error (ignored):', e);
      }
      try {
        scannerRef.current.clear();
      } catch (e) {
        // Ignore clear errors
      }
      scannerRef.current = null;
    }
    // Also clear the container to avoid stale DOM issues on reopen
    const el = document.getElementById('qr-reader');
    if (el) el.innerHTML = '';
    setIsScanning(false);
  }, []);

  const startScanner = useCallback(async (currentFacingMode: 'environment' | 'user') => {
    // Check if component is still mounted
    if (!isMountedRef.current) return;
    
    // Check if qr-reader element exists
    const qrReaderElement = document.getElementById('qr-reader');
    if (!qrReaderElement) {
      console.log('QR reader element not found, retrying...');
      // Retry after a short delay
      setTimeout(() => {
        if (isMountedRef.current) {
          startScanner(currentFacingMode);
        }
      }, 100);
      return;
    }
    
    setIsStarting(true);
    setError(null);

    try {
      // Stop existing scanner first
      await stopScanner();
      
      // Small delay to ensure cleanup is complete
      await new Promise(resolve => setTimeout(resolve, 100));

      if (!isMountedRef.current) return;

      // Dynamic import html5-qrcode
      if (!html5QrcodeModuleRef.current) {
        try {
          html5QrcodeModuleRef.current = await import('html5-qrcode');
        } catch (importError) {
          console.error('Failed to import html5-qrcode:', importError);
          setError('Không thể tải thư viện quét mã. Vui lòng tải lại trang.');
          setIsStarting(false);
          return;
        }
      }
      
      if (!isMountedRef.current) return;
      
      const { Html5Qrcode, Html5QrcodeSupportedFormats } = html5QrcodeModuleRef.current;

      // Clear the container before creating new scanner
      qrReaderElement.innerHTML = '';

      // Compute a larger, barcode-friendly scan box based on actual container size.
      // 1D barcodes (CODE128/39/EAN/UPC) are detected more reliably with a wider-than-tall region.
      const rect = qrReaderElement.getBoundingClientRect();
      const containerW = Math.max(0, Math.floor(rect.width));
      const containerH = Math.max(0, Math.floor(rect.height));

      // Fallback sizes in case layout isn't measured yet
      const fallbackW = 320;
      const fallbackH = 320;

      const effectiveW = containerW || fallbackW;
      const effectiveH = containerH || fallbackH;

      const qrBoxWidth = Math.max(220, Math.min(520, Math.floor(effectiveW * 0.9)));
      const qrBoxHeight = Math.max(160, Math.min(300, Math.floor(effectiveH * 0.55)));

      const html5QrCode = new Html5Qrcode('qr-reader', {
        formatsToSupport: [
          Html5QrcodeSupportedFormats.QR_CODE,
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
        ],
        // On Chromium (desktop + Android), BarcodeDetector often improves 1D barcode detection stability.
        // Safe no-op where unsupported.
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: true,
        },
        verbose: false,
      });

      scannerRef.current = html5QrCode;

      // iOS Safari is more strict with media constraints; overly specific width/height ideals
      // can fail to start even though camera permission is granted.
      const isIOS =
        typeof navigator !== 'undefined' &&
        /iPad|iPhone|iPod/.test(navigator.userAgent) &&
        !(window as any).MSStream;

      const preferredConstraints: MediaTrackConstraints = isIOS
        ? { facingMode: currentFacingMode }
        : {
            facingMode: currentFacingMode,
            width: { ideal: 1280 },
            height: { ideal: 720 },
          };

      const fallbackConstraints: MediaTrackConstraints = { facingMode: currentFacingMode };

      const fps = isIOS ? 15 : 20;

      const startWithConstraints = async (constraints: MediaTrackConstraints) =>
        html5QrCode.start(
          constraints,
          {
            fps,
            qrbox: { width: qrBoxWidth, height: qrBoxHeight },
            disableFlip: false,
          },
          (decodedText: string) => {
            const normalized = decodedText?.trim?.() ?? decodedText;
            // Prevent duplicate scans within cooldown period
            if (scanCooldownRef.current) return;
            if (!normalized) return;
            if (lastScannedRef.current === normalized) return;

            scanCooldownRef.current = true;
            lastScannedRef.current = normalized;

            // Play beep sound
            playBeep();

            if (continuous) {
              // Continuous mode: don't close, show feedback, keep scanning
              onScan(normalized);
              setScanFeedback(normalized);
              setTimeout(() => setScanFeedback(null), 1500);
              // Reset cooldown after 1.5 seconds to allow next scan
              setTimeout(() => {
                scanCooldownRef.current = false;
                lastScannedRef.current = null;
              }, 1500);
            } else {
              // Default: stop scanner and close
              stopScanner().then(() => {
                onScan(normalized);
                onClose();
              });
              setTimeout(() => {
                scanCooldownRef.current = false;
                lastScannedRef.current = null;
              }, 2000);
            }
          },
          () => {
            // Ignore scan failures (QR not found) - this is normal
          }
        );

      try {
        await startWithConstraints(preferredConstraints);
      } catch (startErr: any) {
        // Retry once with minimal constraints (helps Safari / iOS)
        const name = startErr?.name || '';
        if (name === 'OverconstrainedError' || name === 'NotSupportedError' || isIOS) {
          await startWithConstraints(fallbackConstraints);
        } else {
          throw startErr;
        }
      }
      
      setIsScanning(true);
    } catch (err: any) {
      console.error('Camera error:', err);
      if (!isMountedRef.current) return;
      
      if (err.message?.includes('NotAllowedError') || err.name === 'NotAllowedError') {
        setError('Vui lòng cho phép truy cập camera để quét mã');
      } else if (err.message?.includes('NotFoundError') || err.name === 'NotFoundError') {
        setError('Không tìm thấy camera trên thiết bị');
      } else if (err.message?.includes('NotReadableError') || err.name === 'NotReadableError') {
        setError('Camera đang được sử dụng bởi ứng dụng khác');
      } else if (err.message?.includes('OverconstrainedError')) {
        // Try with different facing mode
        if (currentFacingMode === 'environment') {
          console.log('Trying user camera instead...');
          startScanner('user');
          return;
        }
        setError('Camera không hỗ trợ cấu hình này');
      } else {
        // Include error name to help diagnose Safari/permission/constraint issues
        const details = [err?.name, err?.message].filter(Boolean).join(' - ');
        setError('Không thể khởi động camera: ' + (details || 'Lỗi không xác định'));
      }
    } finally {
      if (isMountedRef.current) {
        setIsStarting(false);
      }
    }
  }, [onClose, onScan, playBeep, stopScanner]);

  // Use refs to avoid stale closures in the effect
  const startScannerRef = useRef(startScanner);
  startScannerRef.current = startScanner;
  const stopScannerRef = useRef(stopScanner);
  stopScannerRef.current = stopScanner;
  const facingModeRef = useRef(facingMode);
  facingModeRef.current = facingMode;

  // Handle open/close
  useEffect(() => {
    isMountedRef.current = true;
    // Reset cooldown refs when opening
    lastScannedRef.current = null;
    scanCooldownRef.current = false;
    
    if (isOpen) {
      // Bump key to force fresh DOM element
      setScannerKey(k => k + 1);
      // Delay start to ensure DOM is ready
      const timer = setTimeout(() => {
        startScannerRef.current(facingModeRef.current);
      }, 300);
      
      return () => {
        clearTimeout(timer);
        isMountedRef.current = false;
        stopScannerRef.current();
      };
    } else {
      stopScannerRef.current();
      return () => {
        isMountedRef.current = false;
      };
    }
  }, [isOpen]); // Only depend on isOpen

  // Handle camera switch
  const toggleCamera = useCallback(async () => {
    const newFacingMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(newFacingMode);
    await stopScanner();
    startScanner(newFacingMode);
  }, [facingMode, stopScanner, startScanner]);

  const handleClose = useCallback(() => {
    stopScanner();
    onClose();
  }, [stopScanner, onClose]);

  const handleRetry = useCallback(() => {
    startScanner(facingMode);
  }, [startScanner, facingMode]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold flex items-center gap-2">
              <Camera className="h-5 w-5" />
              Quét mã QR / Barcode
            </h3>
            <Button variant="ghost" size="icon" onClick={handleClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>

          <div 
            className="relative bg-muted rounded-lg overflow-hidden"
            style={{ minHeight: '300px' }}
          >
            <div id="qr-reader" key={scannerKey} className="w-full" />
            
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
                  <Button 
                    variant="secondary" 
                    size="sm"
                    onClick={handleRetry}
                  >
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
                <div className="bg-emerald-500 text-white text-xs px-4 py-2 rounded-full font-medium shadow-lg animate-in fade-in zoom-in-95">
                  ✓ Đã quét: {scanFeedback.length > 20 ? scanFeedback.slice(0, 20) + '...' : scanFeedback}
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <Button 
              variant="outline" 
              className="flex-1"
              onClick={toggleCamera}
              disabled={isStarting}
            >
              <SwitchCamera className="h-4 w-4 mr-2" />
              Đổi camera
            </Button>
            <Button 
              variant="destructive" 
              className="flex-1"
              onClick={handleClose}
            >
              Đóng
            </Button>
          </div>

          <p className="text-xs text-muted-foreground text-center">
            Đưa mã QR hoặc mã vạch vào vùng quét • FPS: 15
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
