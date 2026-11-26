import { describe, expect, test } from 'bun:test';
import { createTranslator, DEFAULT_LOCALE, isLocale, LOCALES, translate } from './index';
import en from './locales/en.json';
import fr from './locales/fr.json';
import pcm from './locales/pcm.json';

describe('locales', () => {
  test('en, pcm and fr, with en as the default', () => {
    expect([...LOCALES]).toEqual(['en', 'pcm', 'fr']);
    expect(DEFAULT_LOCALE).toBe('en');
    expect(isLocale('pcm')).toBe(true);
    expect(isLocale('de')).toBe(false);
    expect(isLocale(undefined)).toBe(false);
  });

  test('pcm and fr fall back to English for a key they do not have', () => {
    expect(translate('fr', 'common.retry')).toBe(en['common.retry']);
    expect(createTranslator('pcm')('brand.name')).toBe('1minitman');
  });

  test('pcm and fr only hold keys that exist in en', () => {
    for (const catalogue of [fr, pcm]) {
      for (const key of Object.keys(catalogue)) expect(Object.hasOwn(en, key)).toBe(true);
    }
  });

  test('every en message is non-empty text', () => {
    for (const value of Object.values(en)) expect(value.trim().length).toBeGreaterThan(0);
  });
});
