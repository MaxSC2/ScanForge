import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import ru from './locales/ru';
import en from './locales/en';

export type LocaleId = 'ru' | 'en';
export type TranslationDict = Record<string, string>;

const LOCALES: Record<LocaleId, TranslationDict> = { ru, en };

interface LocaleState {
  locale: LocaleId;
  setLocale: (id: LocaleId) => void;
}

export const useLocaleStore = create<LocaleState>()(
  persist(
    (set) => ({
      locale: 'ru',
      setLocale: (locale) => set({ locale }),
    }),
    { name: 'scanforge-locale' },
  ),
);

export function t(key: string, params?: Record<string, string | number>): string {
  const locale = useLocaleStore.getState().locale;
  let value = LOCALES[locale]?.[key] ?? LOCALES.ru[key] ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      value = value.replace(`{${k}}`, String(v));
    }
  }
  return value;
}

export function useT() {
  const locale = useLocaleStore((s) => s.locale);
  return (key: string, params?: Record<string, string | number>) => {
    let value = LOCALES[locale]?.[key] ?? LOCALES.ru[key] ?? key;
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        value = value.replace(`{${k}}`, String(v));
      }
    }
    return value;
  };
}
