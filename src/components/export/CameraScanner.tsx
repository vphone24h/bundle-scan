import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Camera, X, SwitchCamera, Loader2 } from 'lucide-react';

interface CameraScannerProps {
  onScan: (code: string) => void;
  onClose: () => void;
  isOpen: boolean;
}

export function CameraScanner({ onScan, onClose, isOpen }: CameraScannerProps) {
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [isScanning, setIsScanning] = useState(false);
  
  const scannerRef = useRef<any>(null);
  const html5QrcodeModuleRef = useRef<any>(null);
  const isMountedRef = useRef(true);
  const lastScannedRef = useRef<string | null>(null);
  const scanCooldownRef = useRef(false);

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
        verbose: false,
      });

      scannerRef.current = html5QrCode;

      await html5QrCode.start(
        { facingMode: currentFacingMode },
        {
          fps: 15, // Increased FPS for better detection
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1,
          disableFlip: false,
        },
        (decodedText: string) => {
          // Prevent duplicate scans within cooldown period
          if (scanCooldownRef.current) return;
          if (lastScannedRef.current === decodedText) return;
          
          scanCooldownRef.current = true;
          lastScannedRef.current = decodedText;
          
          // Play beep sound
          playBeep();
          
          // Stop scanner before callback
          stopScanner().then(() => {
            onScan(decodedText);
            onClose();
          });
          
          // Reset cooldown after 2 seconds
          setTimeout(() => {
            scanCooldownRef.current = false;
            lastScannedRef.current = null;
          }, 2000);
        },
        () => {
          // Ignore scan failures (QR not found) - this is normal
        }
      );
      
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
        setError('Không thể khởi động camera: ' + (err.message || 'Lỗi không xác định'));
      }
    } finally {
      if (isMountedRef.current) {
        setIsStarting(false);
      }
    }
  }, [onClose, onScan, playBeep, stopScanner]);

  // Handle open/close
  useEffect(() => {
    isMountedRef.current = true;
    
    if (isOpen) {
      // Delay start to ensure DOM is ready
      const timer = setTimeout(() => {
        startScanner(facingMode);
      }, 150);
      
      return () => {
        clearTimeout(timer);
        stopScanner();
      };
    } else {
      stopScanner();
    }

    return () => {
      isMountedRef.current = false;
      stopScanner();
    };
  }, [isOpen]); // Only depend on isOpen, not startScanner/stopScanner

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
            <div id="qr-reader" className="w-full" />
            
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
            
            {isScanning && !error && (
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2">
                <div className="bg-primary/90 text-primary-foreground text-xs px-3 py-1 rounded-full animate-pulse">
                  Đang quét...
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
