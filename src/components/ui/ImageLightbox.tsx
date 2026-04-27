import { useEffect, useRef, useState, useCallback } from 'react';
import { X, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

interface Props {
  src: string | null;
  onClose: () => void;
}

/**
 * Lightbox xem ảnh với zoom (wheel + pinch + nút) và kéo (drag).
 */
export function ImageLightbox({ src, onClose }: Props) {
  const [scale, setScale] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const dragRef = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);
  const pinchRef = useRef<{ d: number; s: number } | null>(null);

  const reset = useCallback(() => { setScale(1); setTx(0); setTy(0); }, []);

  useEffect(() => {
    if (src) reset();
  }, [src, reset]);

  useEffect(() => {
    if (!src) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === '+' || e.key === '=') setScale(s => Math.min(8, s * 1.2));
      if (e.key === '-') setScale(s => Math.max(0.5, s / 1.2));
      if (e.key === '0') reset();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [src, onClose, reset]);

  if (!src) return null;

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = -e.deltaY;
    setScale(s => {
      const next = delta > 0 ? s * 1.1 : s / 1.1;
      return Math.max(0.5, Math.min(8, next));
    });
  };

  const onMouseDown = (e: React.MouseEvent) => {
    dragRef.current = { x: e.clientX, y: e.clientY, tx, ty };
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragRef.current) return;
    setTx(dragRef.current.tx + (e.clientX - dragRef.current.x));
    setTy(dragRef.current.ty + (e.clientY - dragRef.current.y));
  };
  const onMouseUp = () => { dragRef.current = null; };

  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      pinchRef.current = { d: Math.hypot(dx, dy), s: scale };
    } else if (e.touches.length === 1) {
      dragRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, tx, ty };
    }
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchRef.current) {
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const d = Math.hypot(dx, dy);
      const next = pinchRef.current.s * (d / pinchRef.current.d);
      setScale(Math.max(0.5, Math.min(8, next)));
    } else if (e.touches.length === 1 && dragRef.current) {
      setTx(dragRef.current.tx + (e.touches[0].clientX - dragRef.current.x));
      setTy(dragRef.current.ty + (e.touches[0].clientY - dragRef.current.y));
    }
  };
  const onTouchEnd = () => { dragRef.current = null; pinchRef.current = null; };

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center select-none"
      onClick={onClose}
      onWheel={onWheel}
    >
      {/* Toolbar */}
      <div
        className="absolute top-3 right-3 flex items-center gap-2 z-10"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="h-9 w-9 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center backdrop-blur"
          onClick={() => setScale(s => Math.min(8, s * 1.25))}
          title="Phóng to"
        ><ZoomIn className="h-4 w-4" /></button>
        <button
          className="h-9 w-9 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center backdrop-blur"
          onClick={() => setScale(s => Math.max(0.5, s / 1.25))}
          title="Thu nhỏ"
        ><ZoomOut className="h-4 w-4" /></button>
        <button
          className="h-9 w-9 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center backdrop-blur"
          onClick={reset}
          title="Khôi phục"
        ><RotateCcw className="h-4 w-4" /></button>
        <button
          className="h-9 w-9 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center backdrop-blur"
          onClick={onClose}
          title="Đóng"
        ><X className="h-5 w-5" /></button>
      </div>

      <div
        className="absolute bottom-3 left-1/2 -translate-x-1/2 text-xs text-white/80 bg-black/40 px-2 py-1 rounded backdrop-blur"
        onClick={(e) => e.stopPropagation()}
      >
        {Math.round(scale * 100)}% — kéo để di chuyển, cuộn/pinch để phóng
      </div>

      <img
        src={src}
        alt=""
        draggable={false}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{
          transform: `translate(${tx}px, ${ty}px) scale(${scale})`,
          transition: dragRef.current ? 'none' : 'transform 0.1s',
          maxWidth: '90vw',
          maxHeight: '90vh',
          cursor: dragRef.current ? 'grabbing' : 'grab',
          touchAction: 'none',
        }}
      />
    </div>
  );
}