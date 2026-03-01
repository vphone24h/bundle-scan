import { LayoutStyle, IndustryTrustBadge } from '@/lib/industryConfig';
import { ScrollReveal } from '@/hooks/useScrollReveal';
import { Shield, Award, Truck, CreditCard, Clock, Star } from 'lucide-react';

const ICON_MAP: Record<string, React.ReactNode> = {
  Shield: <Shield className="h-5 w-5" />,
  Award: <Award className="h-5 w-5" />,
  Truck: <Truck className="h-5 w-5" />,
  CreditCard: <CreditCard className="h-5 w-5" />,
  Clock: <Clock className="h-5 w-5" />,
  Star: <Star className="h-5 w-5" />,
};

interface TrustBadgeProps {
  badges: IndustryTrustBadge[];
  accentColor: string;
  layoutStyle: LayoutStyle;
}

function AppleBadges({ badges, accentColor }: Omit<TrustBadgeProps, 'layoutStyle'>) {
  return (
    <ScrollReveal animation="fade-up" delay={100}>
      <section className="bg-white border-b border-black/5">
        <div className="max-w-[1200px] mx-auto px-4 py-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {badges.map((badge, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-xl">
                <div className="shrink-0" style={{ color: accentColor }}>{ICON_MAP[badge.icon] || <Shield className="h-5 w-5" />}</div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold leading-tight">{badge.title}</p>
                  <p className="text-[10px] text-[#86868b] leading-tight">{badge.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </ScrollReveal>
  );
}

function TGDDBadges({ badges, accentColor }: Omit<TrustBadgeProps, 'layoutStyle'>) {
  return (
    <section className="bg-blue-50 border-b border-blue-100">
      <div className="max-w-[1200px] mx-auto px-4 py-3">
        <div className="flex overflow-x-auto gap-4 scrollbar-hide">
          {badges.map((badge, i) => (
            <div key={i} className="flex items-center gap-2 shrink-0 bg-white rounded-lg px-3 py-2 shadow-sm border border-blue-100">
              <div className="text-blue-600">{ICON_MAP[badge.icon] || <Shield className="h-4 w-4" />}</div>
              <div>
                <p className="text-[11px] font-bold text-blue-900 whitespace-nowrap">{badge.title}</p>
                <p className="text-[9px] text-blue-600 whitespace-nowrap">{badge.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function HasakiBadges({ badges, accentColor }: Omit<TrustBadgeProps, 'layoutStyle'>) {
  return (
    <section className="bg-gradient-to-r from-pink-50 to-red-50 border-b border-pink-100">
      <div className="max-w-[1200px] mx-auto px-4 py-3">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {badges.map((badge, i) => (
            <div key={i} className="flex items-center gap-2 bg-white/80 backdrop-blur rounded-xl px-3 py-2.5">
              <div className="text-pink-600">{ICON_MAP[badge.icon] || <Shield className="h-4 w-4" />}</div>
              <div>
                <p className="text-[11px] font-bold text-gray-800">{badge.title}</p>
                <p className="text-[9px] text-gray-500">{badge.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function NikeBadges({ badges, accentColor }: Omit<TrustBadgeProps, 'layoutStyle'>) {
  return (
    <section className="bg-[#f5f5f5] border-b border-black/5">
      <div className="max-w-[1200px] mx-auto px-4 py-4">
        <div className="flex overflow-x-auto gap-6 scrollbar-hide justify-center">
          {badges.map((badge, i) => (
            <div key={i} className="flex items-center gap-2 shrink-0">
              <div className="text-black">{ICON_MAP[badge.icon] || <Shield className="h-4 w-4" />}</div>
              <p className="text-[11px] font-semibold text-black uppercase tracking-wide whitespace-nowrap">{badge.title}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function LuxuryBadges({ badges, accentColor }: Omit<TrustBadgeProps, 'layoutStyle'>) {
  return (
    <section className="bg-[#0f0f23] border-b border-amber-900/20">
      <div className="max-w-[1200px] mx-auto px-4 py-4">
        <div className="flex overflow-x-auto gap-6 scrollbar-hide justify-center">
          {badges.map((badge, i) => (
            <div key={i} className="flex items-center gap-2 shrink-0">
              <div className="text-amber-500">{ICON_MAP[badge.icon] || <Shield className="h-4 w-4" />}</div>
              <div>
                <p className="text-[11px] font-medium text-amber-100/80 whitespace-nowrap">{badge.title}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function LayoutTrustBadges({ layoutStyle, ...props }: TrustBadgeProps) {
  switch (layoutStyle) {
    case 'tgdd': return <TGDDBadges {...props} />;
    case 'hasaki': return <HasakiBadges {...props} />;
    case 'nike':
    case 'canifa': return <NikeBadges {...props} />;
    case 'luxury': return <LuxuryBadges {...props} />;
    case 'apple':
    default: return <AppleBadges {...props} />;
  }
}
