import { useState, useEffect, useRef } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Camera, X, SwitchCamera, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CameraScannerProps {
  onScan: (code: string) => void;
  onClose: () => void;
  isOpen: boolean;
}

export function CameraScanner({ onScan, onClose, isOpen }: CameraScannerProps) {
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      startScanner();
    } else {
      stopScanner();
    }

    return () => {
      stopScanner();
    };
  }, [isOpen, facingMode]);

  const startScanner = async () => {
    if (!containerRef.current) return;
    
    setIsStarting(true);
    setError(null);

    try {
      // Stop existing scanner first
      await stopScanner();

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
        { facingMode },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1,
        },
        (decodedText) => {
          // Play beep sound
          playBeep();
          onScan(decodedText);
          stopScanner();
          onClose();
        },
        () => {
          // Ignore scan failures (QR not found)
        }
      );
    } catch (err: any) {
      console.error('Camera error:', err);
      if (err.message?.includes('NotAllowedError') || err.name === 'NotAllowedError') {
        setError('Vui lòng cho phép truy cập camera để quét mã');
      } else if (err.message?.includes('NotFoundError') || err.name === 'NotFoundError') {
        setError('Không tìm thấy camera trên thiết bị');
      } else {
        setError('Không thể khởi động camera: ' + (err.message || 'Lỗi không xác định'));
      }
    } finally {
      setIsStarting(false);
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        const state = scannerRef.current.getState();
        if (state === 2) { // SCANNING
          await scannerRef.current.stop();
        }
        scannerRef.current.clear();
      } catch (e) {
        // Ignore errors during stop
      }
      scannerRef.current = null;
    }
  };

  const playBeep = () => {
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
  };

  const toggleCamera = () => {
    setFacingMode(prev => prev === 'environment' ? 'user' : 'environment');
  };

  const handleClose = () => {
    stopScanner();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-background">
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
            ref={containerRef}
            className="relative bg-black rounded-lg overflow-hidden"
            style={{ minHeight: '300px' }}
          >
            <div id="qr-reader" className="w-full" />
            
            {isStarting && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                <div className="text-center text-white space-y-2">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto" />
                  <p className="text-sm">Đang khởi động camera...</p>
                </div>
              </div>
            )}

            {error && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/80 p-4">
                <div className="text-center text-white space-y-3">
                  <p className="text-sm text-red-400">{error}</p>
                  <Button 
                    variant="secondary" 
                    size="sm"
                    onClick={startScanner}
                  >
                    Thử lại
                  </Button>
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
            Đưa mã QR hoặc mã vạch vào vùng quét
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
