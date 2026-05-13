import type { MetadataRoute } from 'next';
import { BRAND } from '@config/brand';

// Paths that must not be crawled or indexed. Auth/account flows return
// stateful or personalised content; the admin area is staff-only; API
// endpoints serve JSON; checkout success/cancel pages are transactional.
// Future: add '/panel/' once the client dashboard ships in W4.CC.7.
const PROTECTED_PATHS = [
  '/api/',
  '/admin/',
  '/zamow/',
  '/zamowienie/',
  '/zaloguj/',
  '/rejestracja/',
  '/resetuj-haslo/',
  '/zapomnialem-hasla/',
  '/zweryfikuj-email/',
];

export default function robots(): MetadataRoute.Robots {
  const baseUrl = `https://${BRAND.domain}`;

  return {
    rules: [
      // Default rule for all crawlers
      {
        userAgent: '*',
        allow: '/',
        disallow: PROTECTED_PATHS,
      },
      // AI crawlers — allow public content
      {
        userAgent: 'GPTBot',
        allow: '/',
        disallow: PROTECTED_PATHS,
      },
      {
        userAgent: 'ChatGPT-User',
        allow: '/',
        disallow: PROTECTED_PATHS,
      },
      {
        userAgent: 'Claude-Web',
        allow: '/',
        disallow: PROTECTED_PATHS,
      },
      {
        userAgent: 'PerplexityBot',
        allow: '/',
        disallow: PROTECTED_PATHS,
      },
      {
        userAgent: 'Google-Extended',
        allow: '/',
        disallow: PROTECTED_PATHS,
      },
      {
        userAgent: 'Amazonbot',
        allow: '/',
        disallow: PROTECTED_PATHS,
      },
      {
        userAgent: 'CCBot',
        allow: '/',
        disallow: PROTECTED_PATHS,
      },
      // Block non-valuable bots
      {
        userAgent: 'Bytespider',
        disallow: '/',
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
