import { LayoutStyle } from '@/lib/industryConfig';

interface FooterProps {
  storeName: string;
  accentColor: string;
  facebookUrl?: string | null;
  zaloUrl?: string | null;
  tiktokUrl?: string | null;
  govRegistrationUrl?: string | null;
  govRegistrationImageUrl?: string | null;
}

const FacebookIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
);

function SocialLinks({ facebookUrl, zaloUrl, tiktokUrl, linkClass }: { facebookUrl?: string | null; zaloUrl?: string | null; tiktokUrl?: string | null; linkClass: string }) {
  return (
    <div className="flex items-center justify-center gap-4">
      {facebookUrl && <a href={facebookUrl} target="_blank" rel="noopener noreferrer" className={linkClass}><FacebookIcon /></a>}
      {zaloUrl && <a href={zaloUrl} target="_blank" rel="noopener noreferrer" className={`text-xs font-medium ${linkClass}`}>Zalo</a>}
      {tiktokUrl && <a href={tiktokUrl} target="_blank" rel="noopener noreferrer" className={`text-xs font-medium ${linkClass}`}>TikTok</a>}
    </div>
  );
}

function GovBadge({ url, imageUrl }: { url?: string | null; imageUrl?: string | null }) {
  if (!url || !imageUrl) return null;
  return (
    <div className="flex justify-center">
      <a href={url} target="_blank" rel="noopener noreferrer" className="inline-block hover:opacity-80 transition-opacity">
        <img src={imageUrl} alt="Đã thông báo Bộ Công Thương" className="h-12 sm:h-14 object-contain" />
      </a>
    </div>
  );
}


function CommonFooter({ storeName, govRegistrationUrl, govRegistrationImageUrl, facebookUrl, zaloUrl, tiktokUrl, linkClass, textClass, wrapperClass }: FooterProps & { linkClass: string; textClass: string; wrapperClass: string }) {
  return (
    <footer className={wrapperClass}>
      <div className="max-w-[1200px] mx-auto px-4 text-center space-y-3">
        <SocialLinks facebookUrl={facebookUrl} zaloUrl={zaloUrl} tiktokUrl={tiktokUrl} linkClass={linkClass} />
        <GovBadge url={govRegistrationUrl} imageUrl={govRegistrationImageUrl} />
        <p className={textClass}>© {new Date().getFullYear()} {storeName}</p>
      </div>
    </footer>
  );
}

export function LayoutFooter({ layoutStyle, ...props }: FooterProps & { layoutStyle: LayoutStyle }) {
  const configs: Record<string, { wrapperClass: string; linkClass: string; textClass: string }> = {
    tgdd: { wrapperClass: 'py-6 border-t-2 border-yellow-400 bg-gray-50', linkClass: 'text-blue-600 hover:text-blue-800 transition-colors', textClass: 'text-xs text-gray-500 font-medium' },
    hasaki: { wrapperClass: 'py-6 bg-gradient-to-r from-pink-50 to-red-50 border-t border-pink-200', linkClass: 'text-pink-600 hover:text-pink-800 transition-colors', textClass: 'text-xs text-pink-400' },
    nike: { wrapperClass: 'py-8 bg-black border-t border-white/10', linkClass: 'text-white/50 hover:text-white transition-colors', textClass: 'text-xs text-white/30 uppercase tracking-wider' },
    canifa: { wrapperClass: 'py-8 bg-black border-t border-white/10', linkClass: 'text-white/50 hover:text-white transition-colors', textClass: 'text-xs text-white/30 uppercase tracking-wider' },
    luxury: { wrapperClass: 'py-10 bg-[#0f0f23] border-t border-amber-900/20', linkClass: 'text-amber-400/50 hover:text-amber-300 transition-colors', textClass: 'text-[10px] text-amber-200/30 tracking-[0.2em] uppercase' },
    minimal: { wrapperClass: 'py-8 bg-[#faf9f6] border-t border-stone-200', linkClass: 'text-stone-400 hover:text-stone-600 transition-colors', textClass: 'text-xs text-stone-400' },
    shopee: { wrapperClass: 'py-6 bg-orange-50 border-t-2 border-orange-300', linkClass: 'text-orange-500 hover:text-orange-700 transition-colors', textClass: 'text-xs text-orange-400 font-medium' },
    organic: { wrapperClass: 'py-8 bg-green-50 border-t border-green-200', linkClass: 'text-green-600 hover:text-green-800 transition-colors', textClass: 'text-xs text-green-500' },
    apple: { wrapperClass: 'py-8 border-t border-black/5 bg-[#f5f5f7]', linkClass: 'text-[#86868b] hover:text-[#1d1d1f] transition-colors', textClass: 'text-xs text-[#86868b]' },
  };
  const cfg = configs[layoutStyle] || configs.apple;
  return <CommonFooter {...props} {...cfg} />;
}
