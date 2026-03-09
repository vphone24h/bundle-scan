import React from 'react';
import { LayoutStyle } from '@/lib/industryConfig';
import { Menu, X, Search, ShoppingBag } from 'lucide-react';
import { createPortal } from 'react-dom';

export type MenuPosition = 'left' | 'right' | 'top';

interface HeaderProps {
  storeName: string;
  logoUrl?: string | null;
  accentColor: string;
  mobileMenuOpen: boolean;
  onToggleMenu: () => void;
  onNavigateHome: () => void;
  onOpenSearch: () => void;
  navItems: { id: string; label: string; icon?: string }[];
  onNavClick: (item: any) => void;
  isNavActive: (item: any) => boolean;
  onCloseMenu: () => void;
  menuPosition?: MenuPosition;
}

function LogoBlock({ logoUrl, storeName, onClick }: { logoUrl?: string | null; storeName: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex items-center gap-2.5">
      {logoUrl && <img src={logoUrl} alt={storeName} className="h-7 w-7 rounded-lg object-cover" />}
      <span className="font-semibold text-sm tracking-tight">{storeName}</span>
    </button>
  );
}

// === Sticky Top Nav Bar (always visible, horizontal scroll) ===
function TopNavBar({ navItems, onNavClick, isNavActive, accentColor, activeClass, inactiveClass }: { navItems: HeaderProps['navItems']; onNavClick: HeaderProps['onNavClick']; isNavActive: HeaderProps['isNavActive']; accentColor?: string; activeClass?: string; inactiveClass?: string }) {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const touchStartRef = React.useRef<{ x: number; y: number; scrollLeft: number } | null>(null);
  const isDraggingRef = React.useRef(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      scrollLeft: scrollRef.current?.scrollLeft || 0,
    };
    isDraggingRef.current = false;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartRef.current || !scrollRef.current) return;
    const touch = e.touches[0];
    const dx = touchStartRef.current.x - touch.clientX;
    const dy = Math.abs(touch.clientY - touchStartRef.current.y);
    // Only count as drag if moved more than 8px horizontally
    if (Math.abs(dx) > 8 || dy > 8) {
      isDraggingRef.current = true;
    }
    // Manual scroll so touching anywhere on the bar (including buttons) allows drag
    if (Math.abs(dx) > dy) {
      scrollRef.current.scrollLeft = touchStartRef.current.scrollLeft + dx;
    }
  };

  const handleButtonClick = (item: HeaderProps['navItems'][number], e: React.MouseEvent) => {
    if (isDraggingRef.current) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    onNavClick(item);
  };

  return (
    <div
      ref={scrollRef}
      className="overflow-x-auto scrollbar-hide border-t border-black/5"
      style={{ WebkitOverflowScrolling: 'touch', willChange: 'scroll-position', touchAction: 'pan-x' }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
    >
      <div className="flex items-center gap-1.5 px-3 py-2 min-w-max will-change-transform">
        {navItems.map(item => (
          <button
            key={item.id}
            onClick={(e) => handleButtonClick(item, e)}
            className={`shrink-0 whitespace-nowrap px-4 py-2 text-sm font-medium rounded-full transition-all flex items-center gap-1.5 select-none ${
              isNavActive(item) ? (activeClass || 'text-white') : (inactiveClass || 'hover:bg-black/5 text-foreground/70')
            }`}
            style={isNavActive(item) && accentColor ? { backgroundColor: accentColor } : {}}
          >
            {item.icon && <span className="text-base">{item.icon}</span>}
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// === APPLE / DEFAULT ===
function AppleHeader(props: HeaderProps) {
  const isTop = props.menuPosition === 'top';
  return (
    <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-black/5">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-12">
          <div className="flex items-center gap-3">
            {!isTop && (
              <button onClick={props.onToggleMenu} className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-black/5 transition-colors sm:hidden">
                {props.mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            )}
            <LogoBlock logoUrl={props.logoUrl} storeName={props.storeName} onClick={props.onNavigateHome} />
          </div>
          {!isTop && <DesktopNav {...props} activeClass="bg-[#1d1d1f] text-white" />}
          <button onClick={props.onOpenSearch} className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-black/5 transition-colors">
            <Search className="h-5 w-5" />
          </button>
        </div>
      </div>
      {isTop ? (
        <TopNavBar navItems={props.navItems} onNavClick={props.onNavClick} isNavActive={props.isNavActive} accentColor={props.accentColor} />
      ) : (
        <MobileMenu {...props} activeClass="bg-[#1d1d1f] text-white" menuBg="bg-[#1d1d1f]" menuTextClass="text-white" storeName={props.storeName} logoUrl={props.logoUrl} menuPosition={props.menuPosition} />
      )}
    </header>
  );
}

// === TGDD ===
function TGDDHeader(props: HeaderProps) {
  const isTop = props.menuPosition === 'top';
  return (
    <header className="sticky top-0 z-50 bg-yellow-400 border-b border-yellow-500/30 shadow-sm">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-12">
          <div className="flex items-center gap-3">
            {!isTop && (
              <button onClick={props.onToggleMenu} className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-yellow-500/30 transition-colors sm:hidden">
                {props.mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            )}
            <LogoBlock logoUrl={props.logoUrl} storeName={props.storeName} onClick={props.onNavigateHome} />
          </div>
          {!isTop && <DesktopNav {...props} activeClass="bg-red-600 text-white" inactiveClass="text-black hover:bg-yellow-500/40" />}
          <button onClick={props.onOpenSearch} className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-yellow-500/30 transition-colors">
            <Search className="h-5 w-5" />
          </button>
        </div>
      </div>
      {isTop ? (
        <TopNavBar navItems={props.navItems} onNavClick={props.onNavClick} isNavActive={props.isNavActive} activeClass="bg-red-600 text-white" inactiveClass="text-black hover:bg-yellow-500/40" />
      ) : (
        <MobileMenu {...props} activeClass="bg-red-600 text-white" menuBg="bg-yellow-500" menuTextClass="text-black" storeName={props.storeName} logoUrl={props.logoUrl} menuPosition={props.menuPosition} />
      )}
    </header>
  );
}

// === HASAKI ===
function HasakiHeader(props: HeaderProps) {
  const isTop = props.menuPosition === 'top';
  return (
    <header className="sticky top-0 z-50 bg-gradient-to-r from-pink-500 to-red-500 border-b border-red-600/20 shadow-sm">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-12">
          <div className="flex items-center gap-3">
            {!isTop && (
              <button onClick={props.onToggleMenu} className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-white/20 transition-colors sm:hidden text-white">
                {props.mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            )}
            <button onClick={props.onNavigateHome} className="flex items-center gap-2.5 text-white">
              {props.logoUrl && <img src={props.logoUrl} alt={props.storeName} className="h-7 w-7 rounded-lg object-cover" />}
              <span className="font-semibold text-sm tracking-tight">{props.storeName}</span>
            </button>
          </div>
          {!isTop && <DesktopNav {...props} activeClass="bg-white text-red-600" inactiveClass="text-white/80 hover:bg-white/20" />}
          <button onClick={props.onOpenSearch} className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-white/20 transition-colors text-white">
            <Search className="h-5 w-5" />
          </button>
        </div>
      </div>
      {isTop ? (
        <TopNavBar navItems={props.navItems} onNavClick={props.onNavClick} isNavActive={props.isNavActive} activeClass="bg-white/20 text-white" inactiveClass="text-white/80 hover:bg-white/10" />
      ) : (
        <MobileMenu {...props} activeClass="bg-white/20 text-white" menuBg="bg-gradient-to-b from-pink-600 to-red-600" menuTextClass="text-white" storeName={props.storeName} logoUrl={props.logoUrl} menuPosition={props.menuPosition} />
      )}
    </header>
  );
}

// === NIKE / CANIFA ===
function NikeHeader(props: HeaderProps) {
  const isTop = props.menuPosition === 'top';
  return (
    <header className="sticky top-0 z-50 bg-black border-b border-white/10">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-12">
          <div className="flex items-center gap-3">
            {!isTop && (
              <button onClick={props.onToggleMenu} className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors sm:hidden text-white">
                {props.mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            )}
            <button onClick={props.onNavigateHome} className="flex items-center gap-2.5 text-white">
              {props.logoUrl && <img src={props.logoUrl} alt={props.storeName} className="h-7 w-7 rounded-lg object-cover" />}
              <span className="font-bold text-sm tracking-tight uppercase">{props.storeName}</span>
            </button>
          </div>
          {!isTop && <DesktopNav {...props} activeClass="bg-white text-black" inactiveClass="text-white/70 hover:text-white" />}
          <button onClick={props.onOpenSearch} className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors text-white">
            <Search className="h-5 w-5" />
          </button>
        </div>
      </div>
      {isTop ? (
        <TopNavBar navItems={props.navItems} onNavClick={props.onNavClick} isNavActive={props.isNavActive} activeClass="bg-white text-black" inactiveClass="text-white/70 hover:text-white hover:bg-white/10" />
      ) : (
        <MobileMenu {...props} activeClass="bg-white text-black" menuBg="bg-black" menuTextClass="text-white" storeName={props.storeName} logoUrl={props.logoUrl} menuPosition={props.menuPosition} />
      )}
    </header>
  );
}

// === LUXURY ===
function LuxuryHeader(props: HeaderProps) {
  const isTop = props.menuPosition === 'top';
  return (
    <header className="sticky top-0 z-50 bg-[#0f0f23]/95 backdrop-blur-xl border-b border-amber-900/20">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-14">
          <div className="flex items-center gap-3">
            {!isTop && (
              <button onClick={props.onToggleMenu} className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-amber-900/20 transition-colors sm:hidden text-amber-200">
                {props.mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            )}
            <button onClick={props.onNavigateHome} className="flex items-center gap-2.5 text-amber-100">
              {props.logoUrl && <img src={props.logoUrl} alt={props.storeName} className="h-7 w-7 rounded-lg object-cover" />}
              <span className="font-light text-sm tracking-[0.15em] uppercase">{props.storeName}</span>
            </button>
          </div>
          {!isTop && <DesktopNav {...props} activeClass="bg-amber-600 text-white" inactiveClass="text-amber-200/60 hover:text-amber-100" />}
          <button onClick={props.onOpenSearch} className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-amber-900/20 transition-colors text-amber-200">
            <Search className="h-5 w-5" />
          </button>
        </div>
      </div>
      {isTop ? (
        <TopNavBar navItems={props.navItems} onNavClick={props.onNavClick} isNavActive={props.isNavActive} activeClass="bg-amber-600 text-white" inactiveClass="text-amber-200/60 hover:text-amber-100 hover:bg-amber-900/20" />
      ) : (
        <MobileMenu {...props} activeClass="bg-amber-600 text-white" menuBg="bg-[#0f0f23]" menuTextClass="text-amber-100" storeName={props.storeName} logoUrl={props.logoUrl} menuPosition={props.menuPosition} />
      )}
    </header>
  );
}

// === MINIMAL (cafe, services, etc.) ===
function MinimalHeader(props: HeaderProps) {
  const isTop = props.menuPosition === 'top';
  return (
    <header className="sticky top-0 z-50 bg-[#faf9f6]/90 backdrop-blur-xl border-b border-stone-200">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-12">
          <div className="flex items-center gap-3">
            {!isTop && (
              <button onClick={props.onToggleMenu} className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-stone-200 transition-colors sm:hidden text-stone-600">
                {props.mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            )}
            <button onClick={props.onNavigateHome} className="flex items-center gap-2.5 text-stone-800">
              {props.logoUrl && <img src={props.logoUrl} alt={props.storeName} className="h-7 w-7 rounded-lg object-cover" />}
              <span className="font-medium text-sm tracking-wide">{props.storeName}</span>
            </button>
          </div>
          {!isTop && <DesktopNav {...props} activeClass="bg-stone-800 text-white" inactiveClass="text-stone-500 hover:text-stone-800" />}
          <button onClick={props.onOpenSearch} className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-stone-200 transition-colors text-stone-500">
            <Search className="h-5 w-5" />
          </button>
        </div>
      </div>
      {isTop ? (
        <TopNavBar navItems={props.navItems} onNavClick={props.onNavClick} isNavActive={props.isNavActive} activeClass="bg-stone-800 text-white" inactiveClass="text-stone-500 hover:text-stone-800 hover:bg-stone-100" />
      ) : (
        <MobileMenu {...props} activeClass="bg-stone-800 text-white" menuBg="bg-stone-800" menuTextClass="text-white" storeName={props.storeName} logoUrl={props.logoUrl} menuPosition={props.menuPosition} />
      )}
    </header>
  );
}

// === SHOPEE (marketplace, playful) ===
function ShopeeHeader(props: HeaderProps) {
  const isTop = props.menuPosition === 'top';
  return (
    <header className="sticky top-0 z-50 bg-gradient-to-r from-orange-500 to-red-500 border-b border-orange-600/20 shadow-sm">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-12">
          <div className="flex items-center gap-3">
            {!isTop && (
              <button onClick={props.onToggleMenu} className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-white/20 transition-colors sm:hidden text-white">
                {props.mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            )}
            <button onClick={props.onNavigateHome} className="flex items-center gap-2.5 text-white">
              {props.logoUrl && <img src={props.logoUrl} alt={props.storeName} className="h-7 w-7 rounded-lg object-cover" />}
              <span className="font-bold text-sm">{props.storeName}</span>
            </button>
          </div>
          {!isTop && <DesktopNav {...props} activeClass="bg-white text-orange-600" inactiveClass="text-white/80 hover:bg-white/20" />}
          <div className="flex items-center gap-1">
            <button onClick={props.onOpenSearch} className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-white/20 transition-colors text-white">
              <Search className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
      {isTop ? (
        <TopNavBar navItems={props.navItems} onNavClick={props.onNavClick} isNavActive={props.isNavActive} activeClass="bg-white/20 text-white" inactiveClass="text-white/80 hover:bg-white/10" />
      ) : (
        <MobileMenu {...props} activeClass="bg-white/20 text-white" menuBg="bg-gradient-to-b from-orange-600 to-red-600" menuTextClass="text-white" storeName={props.storeName} logoUrl={props.logoUrl} menuPosition={props.menuPosition} />
      )}
    </header>
  );
}

// === ORGANIC (farm, natural) ===
function OrganicHeader(props: HeaderProps) {
  const isTop = props.menuPosition === 'top';
  return (
    <header className="sticky top-0 z-50 bg-green-50/90 backdrop-blur-xl border-b border-green-200">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-12">
          <div className="flex items-center gap-3">
            {!isTop && (
              <button onClick={props.onToggleMenu} className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-green-200/50 transition-colors sm:hidden text-green-800">
                {props.mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            )}
            <button onClick={props.onNavigateHome} className="flex items-center gap-2.5 text-green-900">
              {props.logoUrl && <img src={props.logoUrl} alt={props.storeName} className="h-7 w-7 rounded-lg object-cover" />}
              <span className="font-medium text-sm">{props.storeName}</span>
            </button>
          </div>
          {!isTop && <DesktopNav {...props} activeClass="bg-green-700 text-white" inactiveClass="text-green-700/70 hover:text-green-800" />}
          <button onClick={props.onOpenSearch} className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-green-200/50 transition-colors text-green-700">
            <Search className="h-5 w-5" />
          </button>
        </div>
      </div>
      {isTop ? (
        <TopNavBar navItems={props.navItems} onNavClick={props.onNavClick} isNavActive={props.isNavActive} activeClass="bg-green-700 text-white" inactiveClass="text-green-700/70 hover:text-green-800 hover:bg-green-100" />
      ) : (
        <MobileMenu {...props} activeClass="bg-white/20 text-white" menuBg="bg-green-800" menuTextClass="text-white" storeName={props.storeName} logoUrl={props.logoUrl} menuPosition={props.menuPosition} />
      )}
    </header>
  );
}

// === Shared Desktop Nav ===
function DesktopNav({ navItems, onNavClick, isNavActive, activeClass, inactiveClass }: HeaderProps & { activeClass: string; inactiveClass?: string }) {
  return (
    <nav className="hidden sm:flex items-center gap-1">
      {navItems.map(item => (
        <button
          key={item.id}
          onClick={() => onNavClick(item)}
          className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all ${
            isNavActive(item) ? activeClass : (inactiveClass || '')
          }`}
        >
          {item.label}
        </button>
      ))}
    </nav>
  );
}

// === Shared Mobile Menu (Slide-in Drawer) ===
function MobileMenu({ mobileMenuOpen, navItems, onNavClick, isNavActive, onCloseMenu, activeClass, menuBg, menuTextClass, storeName, logoUrl, menuPosition = 'left' }: HeaderProps & { activeClass: string; menuBg?: string; menuTextClass?: string }) {
  const textClass = menuTextClass || 'text-foreground';
  const hoverClass = menuTextClass ? 'hover:bg-white/10' : 'hover:bg-black/5';
  const borderClass = menuTextClass ? 'border-white/10' : 'border-black/10';
  const closeBtnHover = menuTextClass ? 'hover:bg-white/10' : 'hover:bg-black/5';

  // Left / Right drawer
  const isRight = menuPosition === 'right';
  const positionClass = isRight ? 'right-0' : 'left-0';
  const openTransform = 'translate-x-0';
  const closedTransform = isRight ? 'translate-x-full' : '-translate-x-full';

  return createPortal(
    <>
      <div
        className={`sm:hidden fixed inset-0 z-[9998] bg-black/40 backdrop-blur-sm transition-opacity duration-300 ${mobileMenuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onCloseMenu}
      />
      <div
        className={`sm:hidden fixed top-0 ${positionClass} z-[9999] h-full w-[280px] max-w-[80vw] shadow-2xl transition-transform duration-300 ease-out ${mobileMenuOpen ? openTransform : closedTransform} ${menuBg || 'bg-white'}`}
      >
        <div className={`flex items-center justify-between px-4 py-4 border-b ${borderClass}`}>
          {isRight ? (
            <>
              <button onClick={onCloseMenu} className={`h-8 w-8 rounded-lg flex items-center justify-center ${closeBtnHover} transition-colors ${textClass}`}>
                <X className="h-5 w-5" />
              </button>
              <div className={`flex items-center gap-2.5 ${textClass}`}>
                <span className="font-semibold text-sm">{storeName}</span>
                {logoUrl && <img src={logoUrl} alt={storeName} className="h-8 w-8 rounded-lg object-cover" />}
              </div>
            </>
          ) : (
            <>
              <div className={`flex items-center gap-2.5 ${textClass}`}>
                {logoUrl && <img src={logoUrl} alt={storeName} className="h-8 w-8 rounded-lg object-cover" />}
                <span className="font-semibold text-sm">{storeName}</span>
              </div>
              <button onClick={onCloseMenu} className={`h-8 w-8 rounded-lg flex items-center justify-center ${closeBtnHover} transition-colors ${textClass}`}>
                <X className="h-5 w-5" />
              </button>
            </>
          )}
        </div>
        <div className="px-3 py-3 space-y-0.5 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 65px)' }}>
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => { onNavClick(item); onCloseMenu(); }}
              className={`w-full text-left px-3 py-3 text-sm font-medium rounded-xl transition-all flex items-center gap-2.5 ${
                isNavActive(item) ? activeClass : `${textClass} ${hoverClass}`
              }`}
            >
              {item.icon && <span className="text-base">{item.icon}</span>}
              {item.label}
            </button>
          ))}
        </div>
      </div>
    </>,
    document.body
  );
}

// === RESOLVER ===
export function LayoutHeader({ layoutStyle, ...props }: HeaderProps & { layoutStyle: LayoutStyle }) {
  switch (layoutStyle) {
    case 'tgdd': return <TGDDHeader {...props} />;
    case 'hasaki': return <HasakiHeader {...props} />;
    case 'nike':
    case 'canifa': return <NikeHeader {...props} />;
    case 'luxury': return <LuxuryHeader {...props} />;
    case 'minimal': return <MinimalHeader {...props} />;
    case 'shopee': return <ShopeeHeader {...props} />;
    case 'organic': return <OrganicHeader {...props} />;
    case 'apple':
    default: return <AppleHeader {...props} />;
  }
}
