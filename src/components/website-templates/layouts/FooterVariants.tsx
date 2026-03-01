import { LayoutStyle } from '@/lib/industryConfig';

interface FooterProps {
  storeName: string;
  accentColor: string;
  facebookUrl?: string | null;
  zaloUrl?: string | null;
  tiktokUrl?: string | null;
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

function AppleFooter({ storeName, facebookUrl, zaloUrl, tiktokUrl }: FooterProps) {
  return (
    <footer className="py-8 border-t border-black/5 bg-[#f5f5f7]">
      <div className="max-w-[1200px] mx-auto px-4 text-center space-y-3">
        <SocialLinks facebookUrl={facebookUrl} zaloUrl={zaloUrl} tiktokUrl={tiktokUrl} linkClass="text-[#86868b] hover:text-[#1d1d1f] transition-colors" />
        <p className="text-xs text-[#86868b]">© {new Date().getFullYear()} {storeName}</p>
      </div>
    </footer>
  );
}

function TGDDFooter({ storeName, facebookUrl, zaloUrl, tiktokUrl }: FooterProps) {
  return (
    <footer className="py-6 border-t-2 border-yellow-400 bg-gray-50">
      <div className="max-w-[1200px] mx-auto px-4 text-center space-y-3">
        <SocialLinks facebookUrl={facebookUrl} zaloUrl={zaloUrl} tiktokUrl={tiktokUrl} linkClass="text-blue-600 hover:text-blue-800 transition-colors" />
        <p className="text-xs text-gray-500 font-medium">© {new Date().getFullYear()} {storeName}</p>
      </div>
    </footer>
  );
}

function HasakiFooter({ storeName, facebookUrl, zaloUrl, tiktokUrl }: FooterProps) {
  return (
    <footer className="py-6 bg-gradient-to-r from-pink-50 to-red-50 border-t border-pink-200">
      <div className="max-w-[1200px] mx-auto px-4 text-center space-y-3">
        <SocialLinks facebookUrl={facebookUrl} zaloUrl={zaloUrl} tiktokUrl={tiktokUrl} linkClass="text-pink-600 hover:text-pink-800 transition-colors" />
        <p className="text-xs text-pink-400">© {new Date().getFullYear()} {storeName}</p>
      </div>
    </footer>
  );
}

function NikeFooter({ storeName, facebookUrl, zaloUrl, tiktokUrl }: FooterProps) {
  return (
    <footer className="py-8 bg-black border-t border-white/10">
      <div className="max-w-[1200px] mx-auto px-4 text-center space-y-3">
        <SocialLinks facebookUrl={facebookUrl} zaloUrl={zaloUrl} tiktokUrl={tiktokUrl} linkClass="text-white/50 hover:text-white transition-colors" />
        <p className="text-xs text-white/30 uppercase tracking-wider">© {new Date().getFullYear()} {storeName}</p>
      </div>
    </footer>
  );
}

function LuxuryFooter({ storeName, facebookUrl, zaloUrl, tiktokUrl }: FooterProps) {
  return (
    <footer className="py-10 bg-[#0f0f23] border-t border-amber-900/20">
      <div className="max-w-[1200px] mx-auto px-4 text-center space-y-4">
        <div className="w-12 h-px bg-amber-400/30 mx-auto" />
        <SocialLinks facebookUrl={facebookUrl} zaloUrl={zaloUrl} tiktokUrl={tiktokUrl} linkClass="text-amber-400/50 hover:text-amber-300 transition-colors" />
        <p className="text-[10px] text-amber-200/30 tracking-[0.2em] uppercase">{storeName} — © {new Date().getFullYear()}</p>
      </div>
    </footer>
  );
}

function MinimalFooter({ storeName, facebookUrl, zaloUrl, tiktokUrl }: FooterProps) {
  return (
    <footer className="py-8 bg-[#faf9f6] border-t border-stone-200">
      <div className="max-w-[1200px] mx-auto px-4 text-center space-y-3">
        <SocialLinks facebookUrl={facebookUrl} zaloUrl={zaloUrl} tiktokUrl={tiktokUrl} linkClass="text-stone-400 hover:text-stone-600 transition-colors" />
        <p className="text-xs text-stone-400">© {new Date().getFullYear()} {storeName}</p>
      </div>
    </footer>
  );
}

function ShopeeFooter({ storeName, facebookUrl, zaloUrl, tiktokUrl }: FooterProps) {
  return (
    <footer className="py-6 bg-orange-50 border-t-2 border-orange-300">
      <div className="max-w-[1200px] mx-auto px-4 text-center space-y-3">
        <SocialLinks facebookUrl={facebookUrl} zaloUrl={zaloUrl} tiktokUrl={tiktokUrl} linkClass="text-orange-500 hover:text-orange-700 transition-colors" />
        <p className="text-xs text-orange-400 font-medium">© {new Date().getFullYear()} {storeName}</p>
      </div>
    </footer>
  );
}

function OrganicFooter({ storeName, facebookUrl, zaloUrl, tiktokUrl }: FooterProps) {
  return (
    <footer className="py-8 bg-green-50 border-t border-green-200">
      <div className="max-w-[1200px] mx-auto px-4 text-center space-y-3">
        <SocialLinks facebookUrl={facebookUrl} zaloUrl={zaloUrl} tiktokUrl={tiktokUrl} linkClass="text-green-600 hover:text-green-800 transition-colors" />
        <p className="text-xs text-green-500">🌿 © {new Date().getFullYear()} {storeName}</p>
      </div>
    </footer>
  );
}

export function LayoutFooter({ layoutStyle, ...props }: FooterProps & { layoutStyle: LayoutStyle }) {
  switch (layoutStyle) {
    case 'tgdd': return <TGDDFooter {...props} />;
    case 'hasaki': return <HasakiFooter {...props} />;
    case 'nike':
    case 'canifa': return <NikeFooter {...props} />;
    case 'luxury': return <LuxuryFooter {...props} />;
    case 'minimal': return <MinimalFooter {...props} />;
    case 'shopee': return <ShopeeFooter {...props} />;
    case 'organic': return <OrganicFooter {...props} />;
    case 'apple':
    default: return <AppleFooter {...props} />;
  }
}
