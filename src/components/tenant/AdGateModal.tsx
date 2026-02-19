import { useState, useEffect, useRef, useCallback } from 'react';
import { X, ExternalLink, Volume2, VolumeX, ArrowUpCircle } from 'lucide-react';
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

  const handleSkip = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (timerRef.current) clearInterval(timerRef.current);
    onClose();
  };

  const handleUpgrade = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (timerRef.current) clearInterval(timerRef.current);
    onClose();
    navigate('/subscription');
  };

  const skipAfterRemaining = Math.max(0, settings.skip_after_seconds - (settings.display_duration_seconds - countdown));
  const progress = ((settings.display_duration_seconds - countdown) / settings.display_duration_seconds) * 100;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black">
      {/* 9:16 container */}
      <div
        className="relative bg-black overflow-hidden"
        style={{
          aspectRatio: '9/16',
          height: '100dvh',
          width: 'calc(100dvh * 9 / 16)',
        }}
      >
        {/* Ad Content — fills entire 9:16 container, NOT clickable */}
        <div className="absolute inset-0">
          {isVideo && videoUrl ? (
            <>
              {embedUrl ? (
                <iframe
                  src={embedUrl}
                  className="w-full h-full"
                  allow="autoplay; fullscreen"
                  allowFullScreen
                  frameBorder="0"
                  style={{ display: 'block' }}
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
                    className="w-full h-full object-cover"
                  />
                  {/* Mute toggle */}
                  <button
                    onClick={(e) => { e.stopPropagation(); setMuted(!muted); }}
                    className="absolute bottom-28 left-4 bg-black/60 text-white rounded-full p-2.5 hover:bg-black/80 transition z-10"
                  >
                    {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
                  </button>
                </>
              )}
            </>
          ) : (
            /* Banner — full bleed */
            <>
              {currentAd.image_url ? (
                <img
                  src={currentAd.image_url}
                  alt={currentAd.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/30 to-primary/5">
                  <span className="text-3xl font-bold text-white drop-shadow-lg">{currentAd.title}</span>
                </div>
              )}
            </>
          )}

          {/* Dark top gradient for readability of top controls */}
          <div className="absolute top-0 left-0 right-0 h-24 bg-gradient-to-b from-black/60 to-transparent pointer-events-none" />
        </div>

        {/* ── Top controls: countdown + nâng cấp + bỏ qua ── */}
        <div
          className="absolute top-4 right-4 flex items-center gap-2 z-20"
          style={{ pointerEvents: 'all' }}
        >
          {/* Countdown badge */}
          <div className="bg-black/60 text-white text-xs font-semibold rounded-full px-2.5 py-1 tabular-nums">
            {countdown}s
          </div>

          {/* Upgrade button */}
          <button
            type="button"
            onClick={handleUpgrade}
            className="flex items-center gap-1.5 bg-primary text-primary-foreground text-xs font-semibold rounded-full px-3 py-1.5 hover:bg-primary/90 active:scale-95 transition shadow-lg"
          >
            <ArrowUpCircle className="h-3.5 w-3.5" />
            Nâng cấp
          </button>

          {/* Skip button — shown when eligible */}
          {canSkip ? (
            <button
              type="button"
              onClick={handleSkip}
              className="flex items-center gap-1 bg-white/20 backdrop-blur-sm border border-white/30 text-white text-xs font-semibold rounded-full px-3 py-1.5 hover:bg-white/30 active:scale-95 transition shadow-lg"
            >
              <X className="h-3.5 w-3.5" />
              Bỏ qua
            </button>
          ) : settings.is_skippable ? (
            <div className="bg-black/50 backdrop-blur-sm text-white/70 text-xs rounded-full px-3 py-1.5">
              Bỏ qua sau {skipAfterRemaining}s
            </div>
          ) : null}
        </div>

        {/* ── Bottom action bar ── */}
        <div className="absolute bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-black/90 via-black/60 to-transparent pt-8 pb-3 px-4">
          {/* Ad info */}
          <div className="mb-3">
            <h3 className="font-bold text-base text-white line-clamp-1">{currentAd.title}</h3>
            {currentAd.description && (
              <p className="text-xs text-white/70 mt-0.5 line-clamp-1">{currentAd.description}</p>
            )}
          </div>

          {/* 3 action buttons */}
          <div className="flex gap-2 mb-2">
            {/* View ad detail */}
            {currentAd.link_url && (
              <button
                type="button"
                onClick={handleAdClick}
                className="flex-1 flex items-center justify-center gap-1.5 bg-white/15 backdrop-blur-sm border border-white/20 text-white text-xs font-medium rounded-full px-3 py-2 hover:bg-white/25 active:scale-95 transition"
              >
                <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                Xem chi tiết
              </button>
            )}

            {/* Upgrade */}
            <button
              type="button"
              onClick={handleUpgrade}
              className="flex-1 flex items-center justify-center gap-1.5 bg-primary text-primary-foreground text-xs font-semibold rounded-full px-3 py-2 hover:bg-primary/90 active:scale-95 transition shadow-lg"
            >
              <ArrowUpCircle className="h-3.5 w-3.5 shrink-0" />
              Nâng cấp
            </button>

            {/* Skip */}
            {canSkip ? (
              <button
                type="button"
                onClick={handleSkip}
                className="flex-1 flex items-center justify-center gap-1 bg-white/20 backdrop-blur-sm border border-white/30 text-white text-xs font-semibold rounded-full px-3 py-2 hover:bg-white/30 active:scale-95 transition shadow-lg"
              >
                <X className="h-3.5 w-3.5 shrink-0" />
                Bỏ qua
              </button>
            ) : settings.is_skippable ? (
              <div className="flex-1 flex items-center justify-center bg-black/40 backdrop-blur-sm text-white/50 text-xs rounded-full px-3 py-2">
                Bỏ qua sau {skipAfterRemaining}s
              </div>
            ) : null}
          </div>

          {/* Footer note */}
          <p className="text-center text-white/40 text-[10px]">
            Nâng cấp để không còn quảng cáo
          </p>
        </div>

        {/* ── Progress bar ── */}
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/20 z-30">
          <div
            className="h-full bg-primary transition-all duration-1000"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}
