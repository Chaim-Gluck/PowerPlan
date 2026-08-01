/**
 * i18next initialisation. The active language is owned by the app state
 * (persisted in localStorage) and pushed here via `i18n.changeLanguage`.
 */
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from '../locales/en.json';
import he from '../locales/he.json';

/** Supported languages (code -> native label shown in the picker). */
export const LANGUAGES = { en: 'English', he: 'עברית' } as const;
export type Language = keyof typeof LANGUAGES;

/** Right-to-left languages. */
export const RTL_LANGUAGES: Language[] = ['he'];
export const isRtlLanguage = (lng: Language): boolean => RTL_LANGUAGES.includes(lng);

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    he: { translation: he },
  },
  lng: 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false }, // React already escapes
  returnNull: false,
});

export default i18n;
