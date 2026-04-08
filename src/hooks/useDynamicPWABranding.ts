import { useEffect } from 'react';
import { useCompany } from './useCompanyResolver';
import { useCompanySettings } from './useCompanySettings';

/**
 * Dynamically updates the PWA manifest and apple-touch-icon
 * based on the current company's branding (logo, name).
 * This ensures that when users "Add to Home Screen", the correct
 * company logo appears instead of the default vkho logo.
 */
export function useDynamicPWABranding() {
  const company = useCompany();
  const { data: companySettings } = useCompanySettings();

  const logoUrl = companySettings?.logo_url;
  const companyName = companySettings?.display_name || company.domain || 'vkho.vn';

  useEffect(() => {
    if (!logoUrl && !companyName) return;

    const cacheBust = logoUrl ? `?v=${Date.now()}` : '';
    const iconSrc = logoUrl ? `${logoUrl}${cacheBust}` : '/icons/icon-192x192.png';
    const iconSrc512 = logoUrl ? `${logoUrl}${cacheBust}` : '/icons/icon-512x512.png';
    const appleIcon = logoUrl || '/icons/apple-touch-icon.png';

    const fullName = companyName;
    const shortName = fullName.length > 12
      ? (fullName.split(/\s+/).pop() || fullName).slice(0, 12)
      : fullName;

    // Dynamic manifest
    const manifest = {
      name: companyName,
      short_name: shortName,
      description: companyName,
      start_url: window.location.origin,
      display: 'standalone' as const,
      orientation: 'portrait' as const,
      background_color: '#f8fafc',
      theme_color: '#1e3a5f',
      icons: [
        { src: iconSrc, sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: iconSrc, sizes: '180x180', type: 'image/png', purpose: 'any' },
        { src: iconSrc512, sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: iconSrc, sizes: '192x192', type: 'image/png', purpose: 'maskable' },
        { src: iconSrc512, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    };

    const manifestBlob = new Blob([JSON.stringify(manifest)], { type: 'application/json' });
    const manifestUrl = URL.createObjectURL(manifestBlob);

    // Replace existing manifest
    document.querySelectorAll('link[rel="manifest"]').forEach(el => el.remove());
    const manifestLink = document.createElement('link');
    manifestLink.rel = 'manifest';
    manifestLink.href = manifestUrl;
    document.head.appendChild(manifestLink);

    // Apple touch icons
    document.querySelectorAll('link[rel="apple-touch-icon"], link[rel="apple-touch-icon-precomposed"]').forEach(el => el.remove());

    const noSizeLink = document.createElement('link');
    noSizeLink.rel = 'apple-touch-icon';
    noSizeLink.href = appleIcon;
    document.head.appendChild(noSizeLink);

    ['180x180', '152x152', '144x144', '120x120'].forEach(size => {
      const link = document.createElement('link');
      link.rel = 'apple-touch-icon';
      link.setAttribute('sizes', size);
      link.href = appleIcon;
      document.head.appendChild(link);
    });

    const preLink = document.createElement('link');
    preLink.rel = 'apple-touch-icon-precomposed';
    preLink.href = appleIcon;
    document.head.appendChild(preLink);

    // Preload icon
    if (logoUrl) {
      const preload = document.createElement('link');
      preload.rel = 'preload';
      preload.as = 'image';
      preload.href = appleIcon;
      document.head.appendChild(preload);
    }

    // Update favicons
    document.querySelectorAll('link[rel="icon"]').forEach(f => f.setAttribute('href', appleIcon));

    // Apple meta tags
    let appleTitle = document.querySelector('meta[name="apple-mobile-web-app-title"]');
    if (!appleTitle) {
      appleTitle = document.createElement('meta');
      appleTitle.setAttribute('name', 'apple-mobile-web-app-title');
      document.head.appendChild(appleTitle);
    }
    appleTitle.setAttribute('content', companyName);

    let appleCap = document.querySelector('meta[name="apple-mobile-web-app-capable"]');
    if (!appleCap) {
      appleCap = document.createElement('meta');
      appleCap.setAttribute('name', 'apple-mobile-web-app-capable');
      document.head.appendChild(appleCap);
    }
    appleCap.setAttribute('content', 'yes');

    return () => { URL.revokeObjectURL(manifestUrl); };
  }, [logoUrl, companyName]);

  return { logoUrl, companyName };
}
