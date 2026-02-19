import { useState, useEffect, useRef, useCallback } from 'react';
import { X, ExternalLink, Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useActiveAdvertisements, useTrackAdvertisementClick } from '@/hooks/useAdvertisements';
import { AdGateSettings } from '@/hooks/useAdGate';
import { useNavigate } from 'react-router-dom';

interface AdGateModalProps {
  open: boolean;
  onClose: () => void;
  settings: AdGateSettings;
}

export function AdGateModal({ open, onClose, settings }: AdGateModalProps) {
  const { data: ads } = useActiveAdvertisements();
  const trackClick = useTrackAdvertisementClick();
  const navigate = useNavigate();

  const [currentAdIndex, setCurrentAdIndex] = useState(0);
  const [countdown, setCountdown] = useState(settings.display_duration_seconds);
  const [canSkip, setCanSkip] = useState(false);
  const [muted, setMuted] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const pinnedAdId = (settings as any).pinned_ad_id as string | null;
  // Nếu có pinned_ad_id thì dùng quảng cáo đó, ngược lại lấy ngẫu nhiên theo index
  const currentAd = pinnedAdId
    ? (ads?.find(a => a.id === pinnedAdId) ?? ads?.[0] ?? null)
    : (ads?.[currentAdIndex] ?? null);

  const startTimer = useCallback(() => {
    setCountdown(settings.display_duration_seconds);
    setCanSkip(false);

    if (timerRef.current) clearInterval(timerRef.current);

    let elapsed = 0;
    timerRef.current = setInterval(() => {
      elapsed += 1;
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          onClose();
          return 0;
        }
        return prev - 1;
      });
      if (settings.is_skippable && elapsed >= settings.skip_after_seconds) {
        setCanSkip(true);
      }
    }, 1000);
  }, [settings, onClose]);

  useEffect(() => {
    if (!open || !currentAd) return;
    startTimer();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [open, currentAdIndex, currentAd, startTimer]);

  useEffect(() => {
    if (!open) {
      setCurrentAdIndex(0);
      setCanSkip(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  }, [open]);

  if (!open || !currentAd) return null;

  const isVideo = currentAd.ad_type === 'video' || !!(currentAd as any).video_url;
  const videoUrl = (currentAd as any).video_url as string | undefined;

  // Convert YouTube/Vimeo links to embed URLs
  const getEmbedUrl = (url: string): string | null => {
    const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}?autoplay=1&mute=1`;
    const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
    if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}?autoplay=1&muted=1`;
    return null;
  };
  const embedUrl = videoUrl ? getEmbedUrl(videoUrl) : null;

  const handleAdClick = () => {
    if (currentAd.link_url) {
      trackClick.mutate(currentAd.id);
      window.open(currentAd.link_url, '_blank', 'noopener,noreferrer');
    }
  };

  const handleSkip = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    onClose();
  };

  const handleUpgrade = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    onClose();
    navigate('/subscription');
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-lg mx-4 rounded-2xl overflow-hidden shadow-2xl bg-background">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 bg-muted/80 border-b text-xs text-muted-foreground">
          <span className="font-medium">📢 Quảng cáo</span>
          <div className="flex items-center gap-2">
            <span className="text-primary font-semibold">{countdown}s</span>
            {canSkip && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); handleSkip(); }}
                style={{ position: 'relative', zIndex: 10001, pointerEvents: 'all' }}
                className="flex items-center gap-1 bg-background border border-border rounded-md px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted active:bg-muted/80 cursor-pointer select-none min-h-[36px] min-w-[80px] justify-center"
              >
                <X className="h-3.5 w-3.5" />
                Bỏ qua
              </button>
            )}
            {!canSkip && settings.is_skippable && (
              <span className="text-muted-foreground text-xs">
                Bỏ qua sau {Math.max(0, settings.skip_after_seconds - (settings.display_duration_seconds - countdown))}s
              </span>
            )}
          </div>
        </div>

        {/* Ad Content */}
        <div className="relative cursor-pointer" onClick={handleAdClick}>
          {isVideo && videoUrl ? (
            <div className="relative aspect-video bg-black">
              {embedUrl ? (
                <iframe
                  src={embedUrl}
                  className="w-full h-full"
                  allow="autoplay; fullscreen"
                  allowFullScreen
                  frameBorder="0"
                />
              ) : (
                <>
                  <video
                    ref={videoRef}
                    src={videoUrl}
                    autoPlay
                    muted={muted}
                    loop={false}
                    playsInline
                    className="w-full h-full object-contain"
                  />
                  <button
                    onClick={(e) => { e.stopPropagation(); setMuted(!muted); }}
                    className="absolute bottom-3 right-3 bg-black/50 text-white rounded-full p-1.5 hover:bg-black/70 transition"
                  >
                    {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                  </button>
                </>
              )}
            </div>
          ) : (
            <div className="relative aspect-video bg-muted overflow-hidden">
              {currentAd.image_url ? (
                <img
                  src={currentAd.image_url}
                  alt={currentAd.title}
                  className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
                  <span className="text-2xl font-bold text-primary">{currentAd.title}</span>
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
                <h3 className="font-bold text-lg">{currentAd.title}</h3>
                {currentAd.description && (
                  <p className="text-sm opacity-90 line-clamp-2">{currentAd.description}</p>
                )}
              </div>
            </div>
          )}

          {/* Click overlay hint */}
          {currentAd.link_url && (
            <div className="absolute top-3 right-3 flex items-center gap-1 bg-black/50 text-white text-xs rounded-full px-2 py-1">
              <ExternalLink className="h-3 w-3" />
              <span>Nhấn để xem</span>
            </div>
          )}
        </div>

        {/* Footer CTA */}
        <div className="px-4 py-3 bg-muted/50 border-t flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            Nâng cấp gói để loại bỏ quảng cáo
          </p>
          <Button
            size="sm"
            onClick={handleUpgrade}
            className="shrink-0 text-xs h-8"
          >
            Nâng cấp ngay
          </Button>
        </div>

        {/* Progress bar */}
        <div className="h-1 bg-muted">
          <div
            className="h-full bg-primary transition-all duration-1000"
            style={{
              width: `${((settings.display_duration_seconds - countdown) / settings.display_duration_seconds) * 100}%`,
            }}
          />
        </div>
      </div>
    </div>
  );
}
