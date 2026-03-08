import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const savedLanguage = localStorage.getItem('app_language') || 'vi';

// Lazy load translation files - only the active language
async function loadTranslations() {
  const [vi, en] = await Promise.all([
    import('./vi.json'),
    import('./en.json'),
  ]);
  return { vi: vi.default, en: en.default };
}

// Initialize with empty resources, then load async
i18n
  .use(initReactI18next)
  .init({
    resources: {},
    lng: savedLanguage,
    fallbackLng: 'vi',
    interpolation: {
      escapeValue: false,
    },
  });

// Load translations in background
loadTranslations().then(({ vi, en }) => {
  i18n.addResourceBundle('vi', 'translation', vi, true, true);
  i18n.addResourceBundle('en', 'translation', en, true, true);
  // Trigger re-render for components using useTranslation
  i18n.changeLanguage(i18n.language);
});

export default i18n;
