/**
 * Brand configuration — single source of truth.
 * To rename the brand, change this file only.
 * All pages, headers, footers, and metadata reference BRAND.*
 */
export const BRAND = {
  name:       'e-dietetyk.com',
  shortName:  'e-dietetyk',
  domain:     'e-dietetyk.com',
  tagline:    'Twój dietetyk online — AI + opieka dietetyka',
  taglineEn:  'Your online dietitian — AI + dietitian care',
  email:      'kontakt@e-dietetyk.com',
  phone:      '+48 515 530 088',
  social: {
    facebook:  'https://facebook.com/edietetyk',
    instagram: 'https://instagram.com/edietetyk',
  },
  seo: {
    title:       'e-dietetyk.com — Twój dietetyk online',
    description: 'Spersonalizowane plany żywieniowe tworzone przez AI i weryfikowane przez dietetyków. Bezpieczne, zgodne z RODO.',
    ogImage:     '/images/og-image.png',
  },
  author: {
    name:     'Zespół e-dietetyk.com',
    bio:      'Jesteśmy zespołem dietetyków i specjalistów AI. Tworzymy spersonalizowane plany żywieniowe oparte na nauce i nowoczesnej technologii.',
    bioEn:    'We are a team of dietitians and AI specialists. We create personalised nutrition plans based on science and modern technology.',
    image:    '',
    aboutUrl: '/o-nas',
  },
  /** Design token references — for use in JS/metadata contexts */
  colors: {
    brandGreen:  '#1B7937',  // darkened from #1F8F3A → WCAG AA 4.9:1 on white
    brandOrange: '#F57C00',
    aiBlue:      '#1E6BFF',
  },
  /** GEO (Generative Engine Optimization) metadata */
  geo: {
    foundingYear: 2025,
    headquarters: 'Poland',
    address: 'ul. Pod Brzozami 16/8a, 03-995 Warsaw, Poland',
    specialties: [
      'dietetyka kliniczna',
      'plany żywieniowe AI',
      'nutrigenomika',
      'zarządzanie wagą',
      'dieta cukrzycowa',
      'dieta sportowa',
      'alergie i nietolerancje pokarmowe',
    ],
  },
} as const;

export type Brand = typeof BRAND;
