import type { MetadataRoute } from 'next';
import { BRAND } from '@config/brand';

const PROTECTED_PATHS = [
  '/api/',
  '/admin/',
  '/dashboard/',
  '/dietetyk/',
  '/onboarding/',
  '/zamow/',
  '/zaloguj/',
  '/rejestracja/',
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
