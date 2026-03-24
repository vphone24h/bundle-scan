import { LayoutStyle, getFooterWhyChooseTitle } from '@/lib/industryConfig';
import { BranchInfo } from '@/hooks/useTenantLanding';
import { Phone, Mail, MapPin, Building2, MessageCircle, ExternalLink } from 'lucide-react';

interface FooterProps {
  storeName: string;
  accentColor: string;
  templateId?: string;
  footerContentEnabled?: boolean;
  facebookUrl?: string | null;
  zaloUrl?: string | null;
  tiktokUrl?: string | null;
  govRegistrationUrl?: string | null;
  govRegistrationImageUrl?: string | null;
  storePhone?: string | null;
  storeEmail?: string | null;
  storeAddress?: string | null;
  additionalAddresses?: string[] | null;
  branches?: BranchInfo[];
  whyChooseContent?: string | null;
}

const FacebookIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
);

function GovBadge({ url, imageUrl }: { url?: string | null; imageUrl?: string | null }) {
  if (!url || !imageUrl) return null;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="inline-block hover:opacity-80 transition-opacity">
      <img src={imageUrl} alt="Đã thông báo Bộ Công Thương" className="h-12 sm:h-14 object-contain" />
    </a>
  );
}

function buildGoogleMapsUrl(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

function WhyChooseSection({ storeName, content, textColorClass, templateId }: { storeName: string; content: string; textColorClass: string; templateId?: string }) {
  return (
    <div>
      <h3 className="text-sm font-bold mb-3">{getFooterWhyChooseTitle(storeName, templateId)}</h3>
      <div className={`text-xs leading-relaxed space-y-1 ${textColorClass} whitespace-pre-line`}>
        {content}
      </div>
    </div>
  );
}

function ContactSection({ storePhone, storeEmail, zaloUrl, facebookUrl, tiktokUrl, accentColor, linkColorClass }: {
  storePhone?: string | null; storeEmail?: string | null; zaloUrl?: string | null;
  facebookUrl?: string | null; tiktokUrl?: string | null; accentColor: string; linkColorClass: string;
}) {
  const hasContact = storePhone || storeEmail || zaloUrl || facebookUrl || tiktokUrl;
  if (!hasContact) return null;
  return (
    <div>
      <h3 className="text-sm font-bold mb-3">Liên hệ</h3>
      <div className="space-y-2">
        {storePhone && (
          <a href={`tel:${storePhone}`} className={`flex items-center gap-2 text-xs ${linkColorClass} hover:underline`}>
            <Phone className="h-3.5 w-3.5 shrink-0" />
            <span>{storePhone}</span>
          </a>
        )}
        {storeEmail && (
          <a href={`mailto:${storeEmail}`} className={`flex items-center gap-2 text-xs ${linkColorClass} hover:underline`}>
            <Mail className="h-3.5 w-3.5 shrink-0" />
            <span>{storeEmail}</span>
          </a>
        )}
        {zaloUrl && (
          <a href={zaloUrl} target="_blank" rel="noopener noreferrer" className={`flex items-center gap-2 text-xs ${linkColorClass} hover:underline`}>
            <MessageCircle className="h-3.5 w-3.5 shrink-0" />
            <span>Zalo</span>
          </a>
        )}
        {facebookUrl && (
          <a href={facebookUrl} target="_blank" rel="noopener noreferrer" className={`flex items-center gap-2 text-xs ${linkColorClass} hover:underline`}>
            <FacebookIcon />
            <span>Facebook</span>
          </a>
        )}
        {tiktokUrl && (
          <a href={tiktokUrl} target="_blank" rel="noopener noreferrer" className={`flex items-center gap-2 text-xs ${linkColorClass} hover:underline`}>
            <ExternalLink className="h-3.5 w-3.5 shrink-0" />
            <span>TikTok</span>
          </a>
        )}
      </div>
    </div>
  );
}

function AddressesSection({ storeAddress, additionalAddresses, accentColor, linkColorClass }: {
  storeAddress?: string | null; additionalAddresses?: string[] | null;
  accentColor: string; linkColorClass: string;
}) {
  const allAddresses = [storeAddress, ...(additionalAddresses || [])].filter(Boolean) as string[];
  if (allAddresses.length === 0) return null;

  return (
    <div>
      <h3 className="text-sm font-bold mb-3">Địa chỉ</h3>
      <div className="space-y-2">
        {allAddresses.map((addr, i) => (
          <a
            key={`addr-${i}`}
            href={buildGoogleMapsUrl(addr)}
            target="_blank"
            rel="noopener noreferrer"
            className={`flex items-start gap-1.5 text-xs ${linkColorClass} hover:underline`}
          >
            <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5" style={{ color: accentColor }} />
            <span className="line-clamp-2">{addr}</span>
          </a>
        ))}
      </div>
    </div>
  );
}

function FullFooter({
  storeName, accentColor, templateId, footerContentEnabled,
  govRegistrationUrl, govRegistrationImageUrl,
  facebookUrl, zaloUrl, tiktokUrl, storePhone, storeEmail, storeAddress,
  additionalAddresses, branches, whyChooseContent,
  wrapperClass, linkColorClass, textColorClass, borderColorClass, copyrightClass,
}: FooterProps & { wrapperClass: string; linkColorClass: string; textColorClass: string; borderColorClass: string; copyrightClass: string }) {
  const isEnabled = footerContentEnabled !== false; // default true
  const hasWhyChoose = isEnabled && !!whyChooseContent;
  const hasContact = isEnabled && (storePhone || storeEmail || zaloUrl || facebookUrl || tiktokUrl);
  const settingsAddresses = [storeAddress, ...(additionalAddresses || [])].filter(Boolean) as string[];
  const hasBranches = branches && branches.length > 0;
  const hasAddresses = isEnabled && (settingsAddresses.length > 0 || hasBranches);
  const hasGov = govRegistrationUrl && govRegistrationImageUrl;
  const hasContent = hasWhyChoose || hasContact || hasAddresses;

  return (
    <footer className={wrapperClass}>
      <div className="max-w-[1200px] mx-auto px-4">
        {hasContent && (
          <div className={`grid grid-cols-1 md:grid-cols-3 gap-8 pb-6 ${borderColorClass} border-b mb-6`}>
            {hasWhyChoose && (
              <WhyChooseSection storeName={storeName} content={whyChooseContent!} textColorClass={textColorClass} templateId={templateId} />
            )}
            {hasContact && (
              <ContactSection
                storePhone={storePhone} storeEmail={storeEmail}
                zaloUrl={zaloUrl} facebookUrl={facebookUrl} tiktokUrl={tiktokUrl}
                accentColor={accentColor} linkColorClass={linkColorClass}
              />
            )}
            {hasAddresses && (
              <AddressesSection
                storeAddress={storeAddress} additionalAddresses={additionalAddresses}
                accentColor={accentColor} linkColorClass={linkColorClass}
              />
            )}
          </div>
        )}
        <div className="flex flex-col items-center gap-3 py-4">
          {hasGov && <GovBadge url={govRegistrationUrl} imageUrl={govRegistrationImageUrl} />}
          <p className={copyrightClass}>© {new Date().getFullYear()} {storeName}. Tất cả quyền được bảo lưu.</p>
        </div>
      </div>
    </footer>
  );
}

export function LayoutFooter({ layoutStyle, ...props }: FooterProps & { layoutStyle: LayoutStyle }) {
  const configs: Record<string, { wrapperClass: string; linkColorClass: string; textColorClass: string; borderColorClass: string; copyrightClass: string }> = {
    tgdd: {
      wrapperClass: 'pt-8 pb-4 bg-gray-50 border-t-2 border-yellow-400',
      linkColorClass: 'text-blue-600 hover:text-blue-800',
      textColorClass: 'text-gray-600',
      borderColorClass: 'border-gray-200',
      copyrightClass: 'text-[11px] text-gray-400',
    },
    hasaki: {
      wrapperClass: 'pt-8 pb-4 bg-gradient-to-r from-pink-50 to-red-50 border-t border-pink-200',
      linkColorClass: 'text-pink-600 hover:text-pink-800',
      textColorClass: 'text-pink-700/70',
      borderColorClass: 'border-pink-200',
      copyrightClass: 'text-[11px] text-pink-400',
    },
    nike: {
      wrapperClass: 'pt-8 pb-4 bg-black border-t border-white/10 text-white',
      linkColorClass: 'text-white/70 hover:text-white',
      textColorClass: 'text-white/50',
      borderColorClass: 'border-white/10',
      copyrightClass: 'text-[11px] text-white/30 uppercase tracking-wider',
    },
    canifa: {
      wrapperClass: 'pt-8 pb-4 bg-black border-t border-white/10 text-white',
      linkColorClass: 'text-white/70 hover:text-white',
      textColorClass: 'text-white/50',
      borderColorClass: 'border-white/10',
      copyrightClass: 'text-[11px] text-white/30 uppercase tracking-wider',
    },
    luxury: {
      wrapperClass: 'pt-8 pb-4 bg-[#0f0f23] border-t border-amber-900/20 text-amber-100',
      linkColorClass: 'text-amber-400/70 hover:text-amber-300',
      textColorClass: 'text-amber-200/50',
      borderColorClass: 'border-amber-900/20',
      copyrightClass: 'text-[10px] text-amber-200/30 tracking-[0.2em] uppercase',
    },
    minimal: {
      wrapperClass: 'pt-8 pb-4 bg-[#faf9f6] border-t border-stone-200',
      linkColorClass: 'text-stone-600 hover:text-stone-800',
      textColorClass: 'text-stone-500',
      borderColorClass: 'border-stone-200',
      copyrightClass: 'text-[11px] text-stone-400',
    },
    shopee: {
      wrapperClass: 'pt-8 pb-4 bg-orange-50 border-t-2 border-orange-300',
      linkColorClass: 'text-orange-600 hover:text-orange-800',
      textColorClass: 'text-orange-700/60',
      borderColorClass: 'border-orange-200',
      copyrightClass: 'text-[11px] text-orange-400 font-medium',
    },
    organic: {
      wrapperClass: 'pt-8 pb-4 bg-green-50 border-t border-green-200',
      linkColorClass: 'text-green-600 hover:text-green-800',
      textColorClass: 'text-green-600/60',
      borderColorClass: 'border-green-200',
      copyrightClass: 'text-[11px] text-green-500',
    },
    apple: {
      wrapperClass: 'pt-8 pb-4 border-t border-black/5 bg-[#f5f5f7]',
      linkColorClass: 'text-[#515154] hover:text-[#1d1d1f]',
      textColorClass: 'text-[#86868b]',
      borderColorClass: 'border-black/5',
      copyrightClass: 'text-[11px] text-[#86868b]',
    },
  };
  const cfg = configs[layoutStyle] || configs.apple;
  return <FullFooter {...props} {...cfg} />;
}
