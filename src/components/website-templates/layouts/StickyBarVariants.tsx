import { LayoutStyle } from '@/lib/industryConfig';
import { MessageCircle, Phone } from 'lucide-react';

interface StickyBarProps {
  layoutStyle: LayoutStyle;
  accentColor: string;
  zaloUrl?: string | null;
  warrantyHotline?: string | null;
  chatLabel: string;
  callLabel: string;
}

function AppleStickyBar({ accentColor, zaloUrl, warrantyHotline, chatLabel, callLabel }: Omit<StickyBarProps, 'layoutStyle'>) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-xl border-t border-black/5 py-2 px-4 sm:hidden" style={{ paddingBottom: 'max(8px, env(safe-area-inset-bottom))' }}>
      <div className="flex items-center gap-2">
        {zaloUrl && <a href={zaloUrl} target="_blank" rel="noopener noreferrer" className="flex-1 text-white rounded-xl py-2.5 text-center text-sm font-medium flex items-center justify-center gap-1.5" style={{ backgroundColor: accentColor }}><MessageCircle className="h-4 w-4" />{chatLabel}</a>}
        {warrantyHotline && <a href={`tel:${warrantyHotline}`} className="flex-1 bg-[#1d1d1f] text-white rounded-xl py-2.5 text-center text-sm font-medium flex items-center justify-center gap-1.5"><Phone className="h-4 w-4" />{callLabel}</a>}
      </div>
    </div>
  );
}

function TGDDStickyBar({ zaloUrl, warrantyHotline, chatLabel, callLabel }: Omit<StickyBarProps, 'layoutStyle' | 'accentColor'>) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-yellow-400/95 backdrop-blur-xl border-t border-yellow-500 py-2 px-4 sm:hidden" style={{ paddingBottom: 'max(8px, env(safe-area-inset-bottom))' }}>
      <div className="flex items-center gap-2">
        {zaloUrl && <a href={zaloUrl} target="_blank" rel="noopener noreferrer" className="flex-1 bg-blue-600 text-white rounded-lg py-2.5 text-center text-sm font-bold flex items-center justify-center gap-1.5"><MessageCircle className="h-4 w-4" />{chatLabel}</a>}
        {warrantyHotline && <a href={`tel:${warrantyHotline}`} className="flex-1 bg-red-600 text-white rounded-lg py-2.5 text-center text-sm font-bold flex items-center justify-center gap-1.5"><Phone className="h-4 w-4" />{callLabel}</a>}
      </div>
    </div>
  );
}

function HasakiStickyBar({ zaloUrl, warrantyHotline, chatLabel, callLabel }: Omit<StickyBarProps, 'layoutStyle' | 'accentColor'>) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-xl border-t border-pink-200 py-2 px-4 sm:hidden" style={{ paddingBottom: 'max(8px, env(safe-area-inset-bottom))' }}>
      <div className="flex items-center gap-2">
        {zaloUrl && <a href={zaloUrl} target="_blank" rel="noopener noreferrer" className="flex-1 bg-gradient-to-r from-pink-500 to-red-500 text-white rounded-full py-2.5 text-center text-sm font-bold flex items-center justify-center gap-1.5"><MessageCircle className="h-4 w-4" />{chatLabel}</a>}
        {warrantyHotline && <a href={`tel:${warrantyHotline}`} className="flex-1 bg-gray-900 text-white rounded-full py-2.5 text-center text-sm font-bold flex items-center justify-center gap-1.5"><Phone className="h-4 w-4" />{callLabel}</a>}
      </div>
    </div>
  );
}

function NikeStickyBar({ zaloUrl, warrantyHotline, chatLabel, callLabel }: Omit<StickyBarProps, 'layoutStyle' | 'accentColor'>) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-black/95 backdrop-blur-xl border-t border-white/10 py-2 px-4 sm:hidden" style={{ paddingBottom: 'max(8px, env(safe-area-inset-bottom))' }}>
      <div className="flex items-center gap-2">
        {zaloUrl && <a href={zaloUrl} target="_blank" rel="noopener noreferrer" className="flex-1 bg-white text-black rounded-full py-2.5 text-center text-sm font-bold flex items-center justify-center gap-1.5"><MessageCircle className="h-4 w-4" />{chatLabel}</a>}
        {warrantyHotline && <a href={`tel:${warrantyHotline}`} className="flex-1 border border-white/30 text-white rounded-full py-2.5 text-center text-sm font-bold flex items-center justify-center gap-1.5"><Phone className="h-4 w-4" />{callLabel}</a>}
      </div>
    </div>
  );
}

function LuxuryStickyBar({ zaloUrl, warrantyHotline, chatLabel, callLabel }: Omit<StickyBarProps, 'layoutStyle' | 'accentColor'>) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#0f0f23]/95 backdrop-blur-xl border-t border-amber-900/20 py-2 px-4 sm:hidden" style={{ paddingBottom: 'max(8px, env(safe-area-inset-bottom))' }}>
      <div className="flex items-center gap-2">
        {zaloUrl && <a href={zaloUrl} target="_blank" rel="noopener noreferrer" className="flex-1 bg-amber-600 text-white rounded-none py-2.5 text-center text-[11px] font-medium tracking-[0.1em] uppercase flex items-center justify-center gap-1.5"><MessageCircle className="h-4 w-4" />{chatLabel}</a>}
        {warrantyHotline && <a href={`tel:${warrantyHotline}`} className="flex-1 border border-amber-600/50 text-amber-200 rounded-none py-2.5 text-center text-[11px] font-medium tracking-[0.1em] uppercase flex items-center justify-center gap-1.5"><Phone className="h-4 w-4" />{callLabel}</a>}
      </div>
    </div>
  );
}

function MinimalStickyBar({ accentColor, zaloUrl, warrantyHotline, chatLabel, callLabel }: Omit<StickyBarProps, 'layoutStyle'>) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#faf9f6]/95 backdrop-blur-xl border-t border-stone-200 py-2 px-4 sm:hidden" style={{ paddingBottom: 'max(8px, env(safe-area-inset-bottom))' }}>
      <div className="flex items-center gap-2">
        {zaloUrl && <a href={zaloUrl} target="_blank" rel="noopener noreferrer" className="flex-1 text-white rounded-xl py-2.5 text-center text-sm font-medium flex items-center justify-center gap-1.5" style={{ backgroundColor: accentColor }}><MessageCircle className="h-4 w-4" />{chatLabel}</a>}
        {warrantyHotline && <a href={`tel:${warrantyHotline}`} className="flex-1 bg-stone-800 text-white rounded-xl py-2.5 text-center text-sm font-medium flex items-center justify-center gap-1.5"><Phone className="h-4 w-4" />{callLabel}</a>}
      </div>
    </div>
  );
}

function ShopeeStickyBar({ zaloUrl, warrantyHotline, chatLabel, callLabel }: Omit<StickyBarProps, 'layoutStyle' | 'accentColor'>) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-xl border-t-2 border-orange-400 py-2 px-4 sm:hidden" style={{ paddingBottom: 'max(8px, env(safe-area-inset-bottom))' }}>
      <div className="flex items-center gap-2">
        {zaloUrl && <a href={zaloUrl} target="_blank" rel="noopener noreferrer" className="flex-1 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-lg py-2.5 text-center text-sm font-bold flex items-center justify-center gap-1.5"><MessageCircle className="h-4 w-4" />{chatLabel}</a>}
        {warrantyHotline && <a href={`tel:${warrantyHotline}`} className="flex-1 bg-gray-800 text-white rounded-lg py-2.5 text-center text-sm font-bold flex items-center justify-center gap-1.5"><Phone className="h-4 w-4" />{callLabel}</a>}
      </div>
    </div>
  );
}

function OrganicStickyBar({ zaloUrl, warrantyHotline, chatLabel, callLabel }: Omit<StickyBarProps, 'layoutStyle' | 'accentColor'>) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-green-50/95 backdrop-blur-xl border-t border-green-200 py-2 px-4 sm:hidden" style={{ paddingBottom: 'max(8px, env(safe-area-inset-bottom))' }}>
      <div className="flex items-center gap-2">
        {zaloUrl && <a href={zaloUrl} target="_blank" rel="noopener noreferrer" className="flex-1 bg-green-600 text-white rounded-xl py-2.5 text-center text-sm font-medium flex items-center justify-center gap-1.5"><MessageCircle className="h-4 w-4" />{chatLabel}</a>}
        {warrantyHotline && <a href={`tel:${warrantyHotline}`} className="flex-1 bg-green-900 text-white rounded-xl py-2.5 text-center text-sm font-medium flex items-center justify-center gap-1.5"><Phone className="h-4 w-4" />{callLabel}</a>}
      </div>
    </div>
  );
}

export function LayoutStickyBar({ layoutStyle, ...props }: StickyBarProps) {
  if (!props.zaloUrl && !props.warrantyHotline) return null;
  switch (layoutStyle) {
    case 'tgdd': return <TGDDStickyBar {...props} />;
    case 'hasaki': return <HasakiStickyBar {...props} />;
    case 'nike':
    case 'canifa': return <NikeStickyBar {...props} />;
    case 'luxury': return <LuxuryStickyBar {...props} />;
    case 'minimal': return <MinimalStickyBar {...props} />;
    case 'shopee': return <ShopeeStickyBar {...props} />;
    case 'organic': return <OrganicStickyBar {...props} />;
    case 'apple':
    default: return <AppleStickyBar {...props} />;
  }
}
