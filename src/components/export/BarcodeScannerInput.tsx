import { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScanBarcode, Keyboard, Volume2, VolumeX, Camera } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CameraScanner } from './CameraScanner';
import { useIsMobile } from '@/hooks/use-mobile';

interface BarcodeScannerInputProps {
  onScan: (barcode: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function BarcodeScannerInput({
  onScan,
  placeholder = 'Quét mã vạch hoặc nhập IMEI...',
  disabled = false,
  className,
}: BarcodeScannerInputProps) {
  const [value, setValue] = useState('');
  const [isListening, setIsListening] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [lastScan, setLastScan] = useState<string | null>(null);
  const [showCameraScanner, setShowCameraScanner] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const isMobile = useIsMobile();

  // Play beep sound
  const playBeep = () => {
    if (soundEnabled) {
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
        oscillator.stop(audioContext.currentTime + 0.1);
      } catch (e) {
        console.log('Audio not available');
      }
    }
  };

  // Handle barcode scanner input (usually sends Enter after scan)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && value.trim()) {
      e.preventDefault();
      handleScan(value.trim());
    }
  };

  const handleScan = (barcode: string) => {
    if (barcode && barcode.length >= 3) {
      playBeep();
      setLastScan(barcode);
      onScan(barcode);
      setValue('');
      
      // Clear last scan indicator after 3 seconds
      setTimeout(() => setLastScan(null), 3000);
    }
  };

  // Handle camera scan result
  const handleCameraScan = (code: string) => {
    handleScan(code);
  };

  // Auto-focus when listening mode is enabled
  useEffect(() => {
    if (isListening && inputRef.current && !isMobile) {
      inputRef.current.focus();
    }
  }, [isListening, isMobile]);

  // Global keyboard listener for barcode scanners
  useEffect(() => {
    if (!isListening) return;

    let buffer = '';
    let timeout: NodeJS.Timeout;

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Skip if focus is on an input element (let it handle naturally)
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return;
      }

      // Barcode scanners typically type very fast
      clearTimeout(timeout);

      if (e.key === 'Enter' && buffer.length >= 3) {
        handleScan(buffer);
        buffer = '';
        return;
      }

      // Only accept alphanumeric characters
      if (e.key.length === 1 && /[a-zA-Z0-9]/.test(e.key)) {
        buffer += e.key;
      }

      // Clear buffer after 100ms of inactivity (barcode scanners are fast)
      timeout = setTimeout(() => {
        buffer = '';
      }, 100);
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown);
      clearTimeout(timeout);
    };
  }, [isListening, onScan, soundEnabled]);

  return (
    <>
      <div className={cn('space-y-2', className)}>
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <ScanBarcode className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              ref={inputRef}
              placeholder={placeholder}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={disabled || !isListening}
              className="pl-10 pr-4 font-mono"
            />
          </div>
          
          {/* Camera Scanner Button - more prominent on mobile */}
          <Button
            type="button"
            variant={isMobile ? 'default' : 'outline'}
            size="icon"
            onClick={() => setShowCameraScanner(true)}
            title="Quét bằng camera"
            className={cn(isMobile && 'bg-primary text-primary-foreground')}
          >
            <Camera className="h-4 w-4" />
          </Button>
          
          <Button
            type="button"
            variant={isListening ? 'default' : 'outline'}
            size="icon"
            onClick={() => setIsListening(!isListening)}
            title={isListening ? 'Đang lắng nghe quét mã' : 'Bật quét mã vạch'}
          >
            <Keyboard className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setSoundEnabled(!soundEnabled)}
            title={soundEnabled ? 'Tắt âm thanh' : 'Bật âm thanh'}
          >
            {soundEnabled ? (
              <Volume2 className="h-4 w-4" />
            ) : (
              <VolumeX className="h-4 w-4" />
            )}
          </Button>
        </div>

        <div className="flex items-center gap-2 text-xs flex-wrap">
          {isListening ? (
            <Badge variant="default" className="animate-pulse gap-1">
              <span className="w-2 h-2 bg-primary-foreground rounded-full" />
              Đang chờ quét mã vạch
            </Badge>
          ) : (
            <Badge variant="secondary" className="gap-1">
              <span className="w-2 h-2 bg-muted-foreground rounded-full" />
              Tạm dừng
            </Badge>
          )}
          
          {isMobile && (
            <Badge variant="outline" className="gap-1 cursor-pointer" onClick={() => setShowCameraScanner(true)}>
              <Camera className="h-3 w-3" />
              Nhấn để quét QR
            </Badge>
          )}
          
          {lastScan && (
            <Badge variant="outline" className="text-primary border-primary/30 bg-primary/10">
              ✓ Đã quét: {lastScan}
            </Badge>
          )}
        </div>
      </div>

      {/* Camera Scanner Modal */}
      <CameraScanner
        isOpen={showCameraScanner}
        onScan={handleCameraScan}
        onClose={() => setShowCameraScanner(false)}
      />
    </>
  );
}
