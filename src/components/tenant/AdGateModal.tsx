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

/** Extract YouTube video ID */
function getYouTubeId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : null;
}

function getVimeoId(url: string): string | null {
  const m = url.match(/vimeo\.com\/(\d+)/);
  return m ? m[1] : null;
}

/**
 * EmbedVideoPlayer — iframe autoplay muted. Mute state controlled by parent.
 */
function EmbedVideoPlayer({ videoUrl, muted }: { videoUrl: string; muted: boolean }) {
  const ytId = getYouTubeId(videoUrl);
  const vimeoId = getVimeoId(videoUrl);

  const getIframeSrc = (muteVal: boolean) => {
    if (ytId) return `https://www.youtube.com/embed/${ytId}?autoplay=1&mute=${muteVal ? 1 : 0}&playsinline=1&rel=0&modestbranding=1`;
    if (vimeoId) return `https://player.vimeo.com/video/${vimeoId}?autoplay=1&muted=${muteVal ? 1 : 0}&playsinline=1`;
    return videoUrl;
  };

  return (
    <iframe
      key={`embed-${muted}`}
      src={getIframeSrc(muted)}
      className="w-full h-full"
      allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
      allowFullScreen
      frameBorder="0"
      style={{ display: 'block' }}
    />
  );
}

export function AdGateModal({ open, onClose, settings }: AdGateModalProps) {
  const { data: ads } = useActiveAdvertisements();
  const trackClick = useTrackAdvertisementClick();
  const navigate = useNavigate();

  const [currentAdIndex, setCurrentAdIndex] = useState(0);
  const [countdown, setCountdown] = useState(settings.display_duration_seconds);
  const [canSkip, setCanSkip] = useState(false);
  const [muted, setMuted] = useState(true);
  const [embedMuted, setEmbedMuted] = useState(true);
  const [hasUnmuted, setHasUnmuted] = useState(false);
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
      setHasUnmuted(false);
      setMuted(true);
      setEmbedMuted(true);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  }, [open]);

  if (!open || !currentAd) return null;

  const isVideo = currentAd.ad_type === 'video' || !!(currentAd as any).video_url;
  const videoUrl = (currentAd as any).video_url as string | undefined;
  const isEmbedVideo = videoUrl ? (!!getYouTubeId(videoUrl) || !!getVimeoId(videoUrl)) : false;

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
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60"
      style={{ padding: 'max(20px, env(safe-area-inset-top, 20px)) 16px max(20px, env(safe-area-inset-bottom, 20px)) 16px' }}
    >
      {/* Popup: 82% chiều cao, thấy app VKho phía sau */}
      <div
        className="relative bg-black overflow-hidden rounded-2xl shadow-2xl"
        style={{
          aspectRatio: '9/16',
          height: '82%',
          maxHeight: 'calc(100dvh - 100px)',
          width: 'auto',
          maxWidth: 'calc(100vw - 32px)',
        }}
      >
        {/* Ad Content */}
        <div className="absolute inset-0">
          {isVideo && videoUrl ? (
            <>
              {isEmbedVideo ? (
                <EmbedVideoPlayer videoUrl={videoUrl} muted={embedMuted} />
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
                  {muted && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setMuted(false); setHasUnmuted(true); }}
                      className="absolute bottom-28 left-4 bg-black/60 text-white rounded-full p-2.5 hover:bg-black/80 transition z-10"
                    >
                      <VolumeX className="h-5 w-5" />
                    </button>
                  )}
                  {!muted && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setMuted(true); }}
                      className="absolute bottom-28 left-4 bg-black/60 text-white rounded-full p-2.5 hover:bg-black/80 transition z-10"
                    >
                      <Volume2 className="h-5 w-5" />
                    </button>
                  )}
                </>
              )}
            </>
          ) : (
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

          {/* Dark top gradient */}
          <div className="absolute top-0 left-0 right-0 h-24 bg-gradient-to-b from-black/60 to-transparent pointer-events-none" />
        </div>

        {/* ── Top controls ── */}
        <div
          className="absolute top-4 right-4 flex items-center gap-2 z-20"
          style={{ pointerEvents: 'all' }}
        >
          <div className="bg-black/60 text-white text-xs font-semibold rounded-full px-2.5 py-1 tabular-nums">
            {countdown}s
          </div>

          {/* Mute toggle for embed video */}
          {isEmbedVideo && (
            <button
              type="button"
              onClick={() => setEmbedMuted(v => !v)}
              className="bg-black/60 text-white rounded-full p-1.5 hover:bg-black/80 transition"
              title={embedMuted ? 'Bật âm thanh' : 'Tắt âm thanh'}
            >
              {embedMuted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
            </button>
          )}
          {/* Mute toggle for direct video */}
          {isVideo && videoUrl && !isEmbedVideo && (
            <button
              type="button"
              onClick={() => { setMuted(v => !v); setHasUnmuted(true); }}
              className="bg-black/60 text-white rounded-full p-1.5 hover:bg-black/80 transition"
              title={muted ? 'Bật âm thanh' : 'Tắt âm thanh'}
            >
              {muted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
            </button>
          )}

          <button
            type="button"
            onClick={handleUpgrade}
            className="flex items-center gap-1.5 bg-primary text-primary-foreground text-xs font-semibold rounded-full px-3 py-1.5 hover:bg-primary/90 active:scale-95 transition shadow-lg"
          >
            <ArrowUpCircle className="h-3.5 w-3.5" />
            Nâng cấp
          </button>

          {canSkip ? (
            <button
              type="button"
              onClick={handleSkip}
              className="flex items-center gap-1 bg-white/20 backdrop-blur-sm border border-white/30 text-white text-xs font-semibold rounded-full px-3 py-1.5 hover:bg-white/30 active:scale-95 transition shadow-lg"
            >
              <X className="h-3.5 w-3.5" />
              Trở lại VKho
            </button>
          ) : settings.is_skippable ? (
            <div className="bg-black/50 backdrop-blur-sm text-white/70 text-xs rounded-full px-3 py-1.5">
              Trở về VKho sau {skipAfterRemaining}s
            </div>
          ) : null}
        </div>

        {/* ── Bottom action bar ── */}
        <div className="absolute bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-black/90 via-black/60 to-transparent pt-6 pb-2 px-3">
          <div className="mb-2">
            <h3 className="font-bold text-sm text-white line-clamp-1">{currentAd.title}</h3>
            {currentAd.description && (
              <p className="text-[11px] text-white/70 mt-0.5 line-clamp-1">{currentAd.description}</p>
            )}
          </div>

          <div className="flex gap-1.5 mb-1.5">
            {currentAd.link_url && (
              <button
                type="button"
                onClick={handleAdClick}
                className="flex-1 flex items-center justify-center gap-1 bg-white/15 backdrop-blur-sm border border-white/20 text-white text-[11px] font-medium rounded-full px-2 py-1.5 hover:bg-white/25 active:scale-95 transition whitespace-nowrap"
              >
                <ExternalLink className="h-3 w-3 shrink-0" />
                Xem chi tiết
              </button>
            )}

            <button
              type="button"
              onClick={handleUpgrade}
              className="flex-1 flex items-center justify-center gap-1 bg-primary text-primary-foreground text-[11px] font-semibold rounded-full px-2 py-1.5 hover:bg-primary/90 active:scale-95 transition shadow-lg whitespace-nowrap"
            >
              <ArrowUpCircle className="h-3 w-3 shrink-0" />
              Nâng cấp
            </button>

            {canSkip ? (
              <button
                type="button"
                onClick={handleSkip}
                className="shrink-0 flex items-center justify-center gap-1 bg-white/20 backdrop-blur-sm border border-white/30 text-white text-[11px] font-semibold rounded-full px-3 py-1.5 hover:bg-white/30 active:scale-95 transition shadow-lg whitespace-nowrap"
              >
                <X className="h-3 w-3 shrink-0" />
                Trở lại VKho
              </button>
            ) : settings.is_skippable ? (
              <div className="flex-1 flex items-center justify-center bg-black/40 backdrop-blur-sm text-white/50 text-[10px] rounded-full px-2 py-1.5 whitespace-nowrap">
                VKho sau {skipAfterRemaining}s
              </div>
            ) : null}
          </div>

          <p className="text-center text-white/40 text-[9px]">
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
