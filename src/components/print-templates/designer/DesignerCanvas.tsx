import { useRef, useEffect, useState } from 'react';
import { Image as ImageIcon } from 'lucide-react';
import { GRID_COLS, GRID_ROWS, getFieldLabel, type TemplateElement } from './types';

interface Props {
  elements: TemplateElement[];
  selectedId: string | null;
  paperSize: { width: number; height: number };
  onSelect: (id: string | null) => void;
  onUpdate: (id: string, updates: Partial<TemplateElement>) => void;
}

function getClientPos(e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent) {
  if ('touches' in e) {
    const t = e.touches[0] || (e as TouchEvent).changedTouches[0];
    return { x: t.clientX, y: t.clientY };
  }
  return { x: (e as MouseEvent).clientX, y: (e as MouseEvent).clientY };
}

export function DesignerCanvas({ elements, selectedId, paperSize, onSelect, onUpdate }: Props) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<{ id: string; startX: number; startY: number; elX: number; elY: number } | null>(null);
  const [resizing, setResizing] = useState<{ id: string; startX: number; startY: number; elW: number; elH: number } | null>(null);

  const handleCanvasPointerDown = (e: React.MouseEvent | React.TouchEvent) => {
    if (e.target === canvasRef.current) onSelect(null);
  };

  const handleElementPointerDown = (e: React.MouseEvent | React.TouchEvent, el: TemplateElement) => {
    e.stopPropagation();
    if ('preventDefault' in e && 'touches' in e) e.preventDefault();
    onSelect(el.id);
    const pos = getClientPos(e);
    setDragging({ id: el.id, startX: pos.x, startY: pos.y, elX: el.x, elY: el.y });
  };

  const handleResizePointerDown = (e: React.MouseEvent | React.TouchEvent, el: TemplateElement) => {
    e.stopPropagation();
    if ('preventDefault' in e && 'touches' in e) e.preventDefault();
    const pos = getClientPos(e);
    setResizing({ id: el.id, startX: pos.x, startY: pos.y, elW: el.w, elH: el.h });
  };

  useEffect(() => {
    if (!dragging && !resizing) return;

    const handleMove = (e: MouseEvent | TouchEvent) => {
      const pos = getClientPos(e);
      if (dragging && canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect();
        const dx = ((pos.x - dragging.startX) / rect.width) * GRID_COLS;
        const dy = ((pos.y - dragging.startY) / rect.height) * GRID_ROWS;
        onUpdate(dragging.id, {
          x: Math.max(0, Math.min(GRID_COLS - 10, Math.round(dragging.elX + dx))),
          y: Math.max(0, Math.min(GRID_ROWS - 3, Math.round(dragging.elY + dy))),
        });
      }
      if (resizing && canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect();
        const dw = ((pos.x - resizing.startX) / rect.width) * GRID_COLS;
        const dh = ((pos.y - resizing.startY) / rect.height) * GRID_ROWS;
        onUpdate(resizing.id, {
          w: Math.max(5, Math.round(resizing.elW + dw)),
          h: Math.max(3, Math.round(resizing.elH + dh)),
        });
      }
      if ('touches' in e) e.preventDefault();
    };

    const handleEnd = () => { setDragging(null); setResizing(null); };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleEnd);
    window.addEventListener('touchmove', handleMove, { passive: false });
    window.addEventListener('touchend', handleEnd);
    window.addEventListener('touchcancel', handleEnd);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleEnd);
      window.removeEventListener('touchcancel', handleEnd);
    };
  }, [dragging, resizing, onUpdate]);

  return (
    <div className="flex-1 min-w-0">
      <div
        className="bg-white border shadow-sm mx-auto relative overflow-hidden touch-none"
        style={{ aspectRatio: `${paperSize.width} / ${paperSize.height}`, maxWidth: '600px' }}
        ref={canvasRef}
        onMouseDown={handleCanvasPointerDown}
        onTouchStart={handleCanvasPointerDown}
      >
        <div className="absolute inset-0 pointer-events-none" style={{
          backgroundImage: `linear-gradient(to right, hsl(var(--border) / 0.15) 1px, transparent 1px), linear-gradient(to bottom, hsl(var(--border) / 0.15) 1px, transparent 1px)`,
          backgroundSize: `${100 / 20}% ${100 / 20}%`,
        }} />

        {elements.map((el) => {
          const isSelected = el.id === selectedId;
          return (
            <div
              key={el.id}
              className={`absolute cursor-move group ${isSelected ? 'ring-2 ring-primary z-10' : 'hover:ring-1 hover:ring-primary/50'}`}
              style={{
                left: `${(el.x / GRID_COLS) * 100}%`,
                top: `${(el.y / GRID_ROWS) * 100}%`,
                width: `${(el.w / GRID_COLS) * 100}%`,
                height: `${(el.h / GRID_ROWS) * 100}%`,
              }}
              onMouseDown={(e) => handleElementPointerDown(e, el)}
              onTouchStart={(e) => handleElementPointerDown(e, el)}
            >
              <div className="w-full h-full overflow-hidden flex items-start" style={{
                fontFamily: el.fontFamily ? `'${el.fontFamily}', sans-serif` : undefined,
                fontSize: `${(el.fontSize || 12) * 0.6}px`,
                fontWeight: el.fontWeight || 'normal',
                fontStyle: el.fontStyle || 'normal',
                textDecoration: el.textDecoration || 'none',
                textAlign: (el.textAlign as any) || 'left',
                textTransform: (el.textTransform as any) || 'none',
                color: '#000',
              }}>
                {el.type === 'text' && <span className="w-full whitespace-pre-wrap">{el.content || 'Text'}</span>}
                {el.type === 'dynamic' && (
                  <span className="w-full text-blue-600 border border-dashed border-blue-300 bg-blue-50/50 px-0.5 rounded-sm">
                    {`{${el.field}}`} <span className="text-blue-400 text-[8px]">{getFieldLabel(el.field || '')}</span>
                  </span>
                )}
                {el.type === 'image' && (
                  <div className="w-full h-full border border-dashed border-muted-foreground/30 bg-muted/20 flex items-center justify-center">
                    {el.imageUrl ? <img src={el.imageUrl} className="max-w-full max-h-full object-contain" alt="" /> : <ImageIcon className="h-6 w-6 text-muted-foreground/40" />}
                  </div>
                )}
                {el.type === 'line' && <div className="w-full border-t border-black mt-[50%]" />}
                {el.type === 'table' && (
                  <div className="w-full text-[7px] border border-black/30">
                    <div className="flex bg-muted/50 border-b border-black/30">
                      {(el.tableColumns || []).map((col, i) => (
                        <div key={i} className="px-0.5 py-px border-r border-black/20 font-bold truncate" style={{ width: `${col.width}%` }}>{col.label}</div>
                      ))}
                    </div>
                    {[1, 2].map((row) => (
                      <div key={row} className="flex border-b border-black/10">
                        {(el.tableColumns || []).map((col, i) => (
                          <div key={i} className="px-0.5 py-px border-r border-black/10 truncate text-muted-foreground" style={{ width: `${col.width}%` }}>{`{${col.field}}`}</div>
                        ))}
                      </div>
                    ))}
                    <div className="text-center py-px text-muted-foreground italic">... auto lặp ...</div>
                  </div>
                )}
              </div>
              {isSelected && (
                <div
                  className="absolute bottom-0 right-0 w-5 h-5 sm:w-3 sm:h-3 bg-primary cursor-se-resize rounded-tl-sm"
                  onMouseDown={(e) => handleResizePointerDown(e, el)}
                  onTouchStart={(e) => handleResizePointerDown(e, el)}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
