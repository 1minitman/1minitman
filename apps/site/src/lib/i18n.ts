import { DEFAULT_LOCALE, type Locale } from '@1minitman/i18n';

/** English lives at the root; other locales get a prefix. */
export const localizedPath = (locale: Locale, path: string): string =>
  locale === DEFAULT_LOCALE ? path : `/${locale}${path === '/' ? '/' : path}`;

export const HTML_LANG: Record<Locale, string> = { en: 'en', pcm: 'pcm', fr: 'fr' };
