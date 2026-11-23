import en from './locales/en.json';
import fr from './locales/fr.json';
import pcm from './locales/pcm.json';

/** Schema domain `app_locale`. English is the default and the fallback. */
export const LOCALES = ['en', 'pcm', 'fr'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en';

export type MessageKey = keyof typeof en;
type Catalogue = Partial<Record<MessageKey, string>>;

/**
 * pcm and fr start empty on purpose: both need native review before launch
 * (Technical Reference 5.1), so every key falls back to English until reviewed.
 * The name and the slogan are never translated.
 */
const catalogues: Record<Locale, Catalogue> = { en, pcm, fr };

export const isLocale = (value: unknown): value is Locale =>
  typeof value === 'string' && (LOCALES as readonly string[]).includes(value);

/** Returns the message for `key`, falling back to English. */
export const translate = (locale: Locale, key: MessageKey): string =>
  catalogues[locale][key] ?? en[key];

export const createTranslator = (locale: Locale) => (key: MessageKey) => translate(locale, key);
