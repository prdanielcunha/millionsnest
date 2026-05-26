import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { eventBus } from '../events/index.js';

const resources = {
  en: () => import('./locales/en.js'),
  pt: () => import('./locales/pt.js'),
  es: () => import('./locales/es.js'),
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .use({
    type: 'backend',
    read: async (language: string, namespace: string, callback: any) => {
      try {
        const langModule = await resources[language as keyof typeof resources]();
        const data = (langModule.default as any)[namespace];
        if (data) {
          callback(null, data);
        } else {
          callback(new Error(`Namespace ${namespace} not found in ${language}`), null);
        }
      } catch (error) {
        callback(error, null);
      }
    }
  })
  .init({
    fallbackLng: 'pt',
    supportedLngs: ['pt', 'en', 'es'],
    ns: ['common', 'commandPalette', 'resume'],
    defaultNS: 'common',
    interpolation: {
      escapeValue: false, // React already safeguards from xss
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'mn_locale'
    }
  });

i18n.on('languageChanged', (lng) => {
  eventBus.publish('system.locale_changed' as any, {
    organizationId: 'system',
    userId: 'system',
    appSource: 'core',
    metadata: { locale: lng }
  });
});

export const i18nEngine = i18n;

export class LocaleManager {
  public setLanguage(lng: string) {
    return i18nEngine.changeLanguage(lng);
  }

  public getCurrentLanguage() {
    return i18nEngine.language;
  }
}

export const localeManager = new LocaleManager();
