import { BRAND } from '@config/brand';

const BASE = `https://${BRAND.domain}`;

/**
 * Generate canonical URL and hrefLang alternates for a given page path.
 * @param path — path without locale prefix, e.g. '/blog' or '/oferta'. Use '' for homepage.
 */
export function localeAlternates(path: string) {
  return {
    canonical: `${BASE}/pl${path}`,
    languages: {
      'pl': `${BASE}/pl${path}`,
      'en': `${BASE}/en${path}`,
      'x-default': `${BASE}/pl${path}`,
    },
  };
}
