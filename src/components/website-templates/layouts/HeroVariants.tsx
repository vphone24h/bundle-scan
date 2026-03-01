import { Button } from '@/components/ui/button';
import { ScrollReveal, useParallax } from '@/hooks/useScrollReveal';
import { ResolvedIndustryConfig, LayoutStyle } from '@/lib/industryConfig';
import { TenantLandingSettings } from '@/hooks/useTenantLanding';
import { ChevronRight, Zap, Clock, ShoppingBag } from 'lucide-react';
import { useState, useEffect } from 'react';

interface HeroProps {
  config: ResolvedIndustryConfig;
  settings: TenantLandingSettings | null;
  accentColor: string;
  onNavigateProducts: () => void;
}

// === APPLE STYLE HERO === (Clean, minimal, premium)
function AppleHero({ config, settings, accentColor, onNavigateProducts }: HeroProps) {
  const { ref: heroRef, offset } = useParallax(0.3);
  
  if (settings?.show_banner && settings?.banner_image_url) {
    return <BannerHero settings={settings} />;
  }

  return (
    <section ref={heroRef} className="relative overflow-hidden text-white" style={{ background: config.heroGradient }}>
      <div className="max-w-[1200px] mx-auto px-6 py-12 sm:py-20" style={{ transform: `translateY(${offset}px)` }}>
        <ScrollReveal animation="fade-up" delay={100}>
          <h1 className="text-3xl sm:text-5xl font-bold tracking-tight mb-3">{config.heroTitle}</h1>
        </ScrollReveal>
        <ScrollReveal animation="fade-up" delay={200}>
          <p className="text-sm sm:text-base text-white/70 mb-6 max-w-md">{config.heroSubtitle}</p>
        </ScrollReveal>
        <ScrollReveal animation="scale-up" delay={300}>
          <Button onClick={onNavigateProducts} className="text-white rounded-full px-8 h-11 text-sm font-medium" style={{ backgroundColor: accentColor }}>
            {config.heroCta}
          </Button>
        </ScrollReveal>
      </div>
    </section>
  );
}

// === TGDD STYLE HERO === (Promo-heavy, deal banners, yellow/orange accents)
function TGDDHero({ config, settings, accentColor, onNavigateProducts }: HeroProps) {
  if (settings?.show_banner && settings?.banner_image_url) {
    return <BannerHero settings={settings} />;
  }

  return (
    <section className="relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #ffd700 0%, #ff6b00 100%)' }}>
      <div className="max-w-[1200px] mx-auto px-4 py-8 sm:py-14">
        <div className="flex flex-col sm:flex-row items-center gap-6">
          <div className="flex-1">
            <ScrollReveal animation="fade-up" delay={100}>
              <div className="inline-flex items-center gap-1.5 bg-red-600 text-white text-xs font-bold px-3 py-1 rounded-full mb-3">
                <Zap className="h-3 w-3" /> DEAL SỐC HÔM NAY
              </div>
            </ScrollReveal>
            <ScrollReveal animation="fade-up" delay={150}>
              <h1 className="text-2xl sm:text-4xl font-extrabold text-white mb-2 drop-shadow-md">{config.heroTitle}</h1>
            </ScrollReveal>
            <ScrollReveal animation="fade-up" delay={200}>
              <p className="text-sm text-white/90 mb-5 max-w-sm">{config.heroSubtitle}</p>
            </ScrollReveal>
            <ScrollReveal animation="fade-up" delay={250}>
              <div className="flex gap-2">
                <Button onClick={onNavigateProducts} className="bg-red-600 hover:bg-red-700 text-white rounded-lg px-6 h-10 text-sm font-bold shadow-lg">
                  {config.heroCta} <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
                <Button variant="outline" onClick={onNavigateProducts} className="bg-white/20 backdrop-blur text-white border-white/30 rounded-lg px-5 h-10 text-sm font-medium hover:bg-white/30">
                  Xem khuyến mãi
                </Button>
              </div>
            </ScrollReveal>
          </div>
          {/* Promo badges */}
          <div className="flex sm:flex-col gap-2">
            {['Trả góp 0%', 'Giảm đến 50%', 'Freeship'].map((text, i) => (
              <ScrollReveal key={i} animation="scale-up" delay={300 + i * 80}>
                <div className="bg-white rounded-xl px-4 py-2.5 shadow-lg text-center">
                  <p className="text-xs font-bold text-red-600">{text}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// === HASAKI STYLE HERO === (Beauty deals, flash sale timer, pink/coral)
function HasakiHero({ config, settings, accentColor, onNavigateProducts }: HeroProps) {
  const [timeLeft, setTimeLeft] = useState({ h: 5, m: 23, s: 47 });

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        let { h, m, s } = prev;
        s--;
        if (s < 0) { s = 59; m--; }
        if (m < 0) { m = 59; h--; }
        if (h < 0) { h = 23; m = 59; s = 59; }
        return { h, m, s };
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  if (settings?.show_banner && settings?.banner_image_url) {
    return <BannerHero settings={settings} />;
  }

  return (
    <section className="relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #ff6b81 0%, #ee5a24 50%, #ff4757 100%)' }}>
      <div className="max-w-[1200px] mx-auto px-4 py-8 sm:py-12">
        <ScrollReveal animation="fade-up" delay={100}>
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center gap-1.5 bg-white/20 backdrop-blur rounded-full px-3 py-1">
              <Zap className="h-3.5 w-3.5 text-yellow-300" />
              <span className="text-xs font-bold text-white">FLASH SALE</span>
            </div>
            <div className="flex gap-1.5">
              {[
                String(timeLeft.h).padStart(2, '0'),
                String(timeLeft.m).padStart(2, '0'),
                String(timeLeft.s).padStart(2, '0'),
              ].map((v, i) => (
                <span key={i} className="bg-white text-red-600 font-mono font-bold text-sm px-2 py-1 rounded-lg shadow-md min-w-[32px] text-center">
                  {v}
                </span>
              ))}
            </div>
          </div>
        </ScrollReveal>
        <ScrollReveal animation="fade-up" delay={150}>
          <h1 className="text-2xl sm:text-4xl font-extrabold text-white mb-2">{config.heroTitle}</h1>
        </ScrollReveal>
        <ScrollReveal animation="fade-up" delay={200}>
          <p className="text-sm text-white/80 mb-5 max-w-md">{config.heroSubtitle}</p>
        </ScrollReveal>
        <ScrollReveal animation="fade-up" delay={250}>
          <Button onClick={onNavigateProducts} className="bg-white text-red-600 hover:bg-white/90 rounded-full px-8 h-11 text-sm font-bold shadow-lg">
            <ShoppingBag className="h-4 w-4 mr-1.5" /> {config.heroCta}
          </Button>
        </ScrollReveal>
      </div>
    </section>
  );
}

// === NIKE STYLE HERO === (Bold, full-width imagery, sport lifestyle)
function NikeHero({ config, settings, accentColor, onNavigateProducts }: HeroProps) {
  if (settings?.show_banner && settings?.banner_image_url) {
    return <BannerHero settings={settings} />;
  }

  return (
    <section className="relative overflow-hidden bg-black text-white min-h-[280px] sm:min-h-[400px] flex items-center">
      <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent z-10" />
      <div className="max-w-[1200px] mx-auto px-6 py-12 sm:py-16 relative z-20 w-full">
        <ScrollReveal animation="fade-up" delay={100}>
          <p className="text-xs sm:text-sm font-semibold tracking-[0.3em] uppercase text-white/60 mb-3">
            {config.brandInspiration || 'New Collection'}
          </p>
        </ScrollReveal>
        <ScrollReveal animation="fade-up" delay={200}>
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tighter mb-4 leading-[0.9]">
            {config.heroTitle}
          </h1>
        </ScrollReveal>
        <ScrollReveal animation="fade-up" delay={300}>
          <p className="text-sm sm:text-base text-white/60 mb-8 max-w-lg">{config.heroSubtitle}</p>
        </ScrollReveal>
        <ScrollReveal animation="fade-up" delay={400}>
          <div className="flex gap-3">
            <Button onClick={onNavigateProducts} className="bg-white text-black hover:bg-white/90 rounded-full px-8 h-12 text-sm font-bold">
              {config.heroCta}
            </Button>
            <Button variant="outline" onClick={onNavigateProducts} className="border-white/30 text-white bg-transparent hover:bg-white/10 rounded-full px-6 h-12 text-sm font-medium">
              Khám phá thêm
            </Button>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}

// === LUXURY STYLE HERO ===
function LuxuryHero({ config, settings, accentColor, onNavigateProducts }: HeroProps) {
  if (settings?.show_banner && settings?.banner_image_url) {
    return <BannerHero settings={settings} />;
  }

  return (
    <section className="relative overflow-hidden text-white" style={{ background: 'linear-gradient(135deg, #1a1a2e 0%, #0f0f23 50%, #16213e 100%)' }}>
      <div className="max-w-[900px] mx-auto px-6 py-16 sm:py-24 text-center">
        <ScrollReveal animation="fade-up" delay={100}>
          <p className="text-[10px] sm:text-xs tracking-[0.4em] uppercase text-amber-400/80 mb-4 font-medium">
            ✦ {config.brandInspiration || 'Premium Collection'} ✦
          </p>
        </ScrollReveal>
        <ScrollReveal animation="fade-up" delay={200}>
          <h1 className="text-3xl sm:text-5xl font-light tracking-wide mb-4" style={{ fontFamily: '"Playfair Display", Georgia, serif' }}>
            {config.heroTitle}
          </h1>
        </ScrollReveal>
        <ScrollReveal animation="fade-up" delay={300}>
          <div className="w-16 h-px bg-amber-400/40 mx-auto mb-4" />
        </ScrollReveal>
        <ScrollReveal animation="fade-up" delay={350}>
          <p className="text-sm text-white/50 mb-8 max-w-md mx-auto">{config.heroSubtitle}</p>
        </ScrollReveal>
        <ScrollReveal animation="scale-up" delay={400}>
          <Button onClick={onNavigateProducts} className="bg-amber-600 hover:bg-amber-700 text-white rounded-none px-10 h-12 text-xs tracking-[0.15em] uppercase font-medium">
            {config.heroCta}
          </Button>
        </ScrollReveal>
      </div>
    </section>
  );
}

// Shared banner hero
function BannerHero({ settings }: { settings: TenantLandingSettings }) {
  return (
    <section className="relative overflow-hidden bg-[#f5f5f7]">
      {settings.banner_link_url ? (
        <a href={settings.banner_link_url} target="_blank" rel="noopener noreferrer">
          <img src={settings.banner_image_url!} alt="Banner" className="w-full h-auto max-h-[500px] object-cover" />
        </a>
      ) : (
        <img src={settings.banner_image_url!} alt="Banner" className="w-full h-auto max-h-[500px] object-cover" />
      )}
    </section>
  );
}

// === MINIMAL STYLE HERO === (Clean, warm, service-focused)
function MinimalHero({ config, settings, accentColor, onNavigateProducts }: HeroProps) {
  if (settings?.show_banner && settings?.banner_image_url) return <BannerHero settings={settings} />;
  return (
    <section className="relative overflow-hidden bg-[#faf9f6]">
      <div className="max-w-[900px] mx-auto px-6 py-14 sm:py-20 text-center">
        <ScrollReveal animation="fade-up" delay={100}>
          <h1 className="text-2xl sm:text-4xl font-medium tracking-tight text-stone-800 mb-3">{config.heroTitle}</h1>
        </ScrollReveal>
        <ScrollReveal animation="fade-up" delay={200}>
          <p className="text-sm text-stone-500 mb-6 max-w-md mx-auto">{config.heroSubtitle}</p>
        </ScrollReveal>
        <ScrollReveal animation="scale-up" delay={300}>
          <Button onClick={onNavigateProducts} className="rounded-xl px-8 h-11 text-sm font-medium text-white" style={{ backgroundColor: accentColor }}>
            {config.heroCta}
          </Button>
        </ScrollReveal>
      </div>
    </section>
  );
}

// === SHOPEE STYLE HERO === (Playful, promo-heavy, orange)
function ShopeeHero({ config, settings, accentColor, onNavigateProducts }: HeroProps) {
  if (settings?.show_banner && settings?.banner_image_url) return <BannerHero settings={settings} />;
  return (
    <section className="relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #ee4d2d 0%, #ff6633 50%, #f53d2d 100%)' }}>
      <div className="max-w-[1200px] mx-auto px-4 py-8 sm:py-12">
        <ScrollReveal animation="fade-up" delay={100}>
          <div className="inline-flex items-center gap-1.5 bg-yellow-400 text-red-700 text-xs font-bold px-3 py-1 rounded-full mb-3">
            🔥 SIÊU SALE
          </div>
        </ScrollReveal>
        <ScrollReveal animation="fade-up" delay={150}>
          <h1 className="text-2xl sm:text-4xl font-extrabold text-white mb-2">{config.heroTitle}</h1>
        </ScrollReveal>
        <ScrollReveal animation="fade-up" delay={200}>
          <p className="text-sm text-white/80 mb-5 max-w-sm">{config.heroSubtitle}</p>
        </ScrollReveal>
        <ScrollReveal animation="fade-up" delay={250}>
          <Button onClick={onNavigateProducts} className="bg-white text-red-600 hover:bg-white/90 rounded-lg px-6 h-10 text-sm font-bold shadow-lg">
            {config.heroCta}
          </Button>
        </ScrollReveal>
      </div>
    </section>
  );
}

// === ORGANIC STYLE HERO === (Natural, earthy, green)
function OrganicHero({ config, settings, accentColor, onNavigateProducts }: HeroProps) {
  if (settings?.show_banner && settings?.banner_image_url) return <BannerHero settings={settings} />;
  return (
    <section className="relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #2d5016 0%, #4a7c2e 50%, #3d6b21 100%)' }}>
      <div className="max-w-[1200px] mx-auto px-6 py-12 sm:py-16">
        <ScrollReveal animation="fade-up" delay={100}>
          <p className="text-xs text-green-200/60 mb-2">🌿 Tự nhiên · An toàn · Tươi ngon</p>
        </ScrollReveal>
        <ScrollReveal animation="fade-up" delay={200}>
          <h1 className="text-2xl sm:text-4xl font-bold text-white mb-3 tracking-tight">{config.heroTitle}</h1>
        </ScrollReveal>
        <ScrollReveal animation="fade-up" delay={300}>
          <p className="text-sm text-white/70 mb-6 max-w-md">{config.heroSubtitle}</p>
        </ScrollReveal>
        <ScrollReveal animation="scale-up" delay={400}>
          <Button onClick={onNavigateProducts} className="bg-green-100 text-green-900 hover:bg-green-200 rounded-full px-8 h-11 text-sm font-semibold">
            {config.heroCta}
          </Button>
        </ScrollReveal>
      </div>
    </section>
  );
}

// === HERO RESOLVER ===
export function LayoutHero({ layoutStyle, ...props }: HeroProps & { layoutStyle: LayoutStyle }) {
  switch (layoutStyle) {
    case 'tgdd': return <TGDDHero {...props} />;
    case 'hasaki': return <HasakiHero {...props} />;
    case 'nike': return <NikeHero {...props} />;
    case 'luxury': return <LuxuryHero {...props} />;
    case 'canifa': return <NikeHero {...props} />;
    case 'minimal': return <MinimalHero {...props} />;
    case 'shopee': return <ShopeeHero {...props} />;
    case 'organic': return <OrganicHero {...props} />;
    case 'apple':
    default: return <AppleHero {...props} />;
  }
}
