/**
 * Centralized Schema.org structured data fragments.
 * Reused across pages to ensure consistency and reduce duplication.
 */
import { BRAND } from './brand';

const BASE_URL = `https://${BRAND.domain}`;

/** Organization — reusable provider/publisher fragment */
export const organizationSchema = {
  '@type': 'Organization' as const,
  name: BRAND.name,
  url: BASE_URL,
  logo: `${BASE_URL}/images/logo.png`,
  email: BRAND.email,
  telephone: BRAND.phone,
  sameAs: [BRAND.social.facebook, BRAND.social.instagram],
  description: BRAND.seo.description,
  foundingDate: '2025',
  areaServed: {
    '@type': 'Country',
    name: 'PL',
  },
  knowsAbout: [
    'Clinical Dietetics',
    'AI-powered Nutrition Planning',
    'Personalized Diet Plans',
    'Weight Management',
    'Diabetic Nutrition',
    'Sports Nutrition',
    'Food Allergies and Intolerances',
    'GDPR-compliant Health Data Processing',
  ],
  slogan: BRAND.taglineEn,
};

/** Full Organization schema with @context (for standalone use) */
export const organizationJsonLd = {
  '@context': 'https://schema.org',
  ...organizationSchema,
};

/** WebSite schema */
export const websiteJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: BRAND.name,
  url: BASE_URL,
  description: BRAND.seo.description,
  inLanguage: ['pl', 'en'],
  publisher: {
    '@type': 'Organization',
    name: BRAND.name,
    url: BASE_URL,
  },
};

/** SoftwareApplication schema — AI dietitian platform */
export const softwareApplicationJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: `${BRAND.name} — AI Dietitian Platform`,
  applicationCategory: 'HealthApplication',
  operatingSystem: 'Web',
  url: BASE_URL,
  description:
    'AI-powered personalized diet planning platform with professional dietitian oversight. Combines GPT-4.1, OR-Tools mathematical optimization, and clinical nutrition rules with 6,600+ verified Polish food products.',
  provider: {
    '@type': 'Organization',
    name: BRAND.name,
    url: BASE_URL,
  },
  offers: [
    {
      '@type': 'Offer',
      name: 'Annual Nutrition Care (Opieka roczna)',
      price: '99',
      priceCurrency: 'PLN',
      priceSpecification: {
        '@type': 'UnitPriceSpecification',
        price: '99',
        priceCurrency: 'PLN',
        unitText: 'month',
        billingDuration: 'P1Y',
      },
      url: `${BASE_URL}/pl/oferta`,
    },
    {
      '@type': 'Offer',
      name: 'Monthly Nutrition Care (Opieka miesięczna)',
      price: '129',
      priceCurrency: 'PLN',
      priceSpecification: {
        '@type': 'UnitPriceSpecification',
        price: '129',
        priceCurrency: 'PLN',
        unitText: 'month',
      },
      url: `${BASE_URL}/pl/oferta`,
    },
  ],
  featureList: [
    'AI-generated personalized meal plans',
    'Professional dietitian review',
    'Clinical Policy Engine with 85 nutrition rules',
    'OR-Tools mathematical optimization',
    '6,600+ verified Polish food products',
    'Glycemic index tracking',
    'Shopping list generation',
    'Meal swap suggestions',
    'GDPR-compliant data encryption',
  ],
};

/** HowTo schema — diet plan ordering process */
export const howToJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'HowTo',
  name: 'How to get a personalized AI diet plan (Jak zamówić spersonalizowany plan żywieniowy AI)',
  description:
    'Get a personalized nutrition plan created by AI and verified by a licensed dietitian in 4 simple steps.',
  totalTime: 'P1D',
  tool: {
    '@type': 'HowToTool',
    name: 'e-dietetyk.com platform',
  },
  step: [
    {
      '@type': 'HowToStep',
      position: 1,
      name: 'Fill out the dietary assessment (Wypełnij wywiad żywieniowy)',
      text: 'Complete a 3-5 minute questionnaire about your health goals, dietary preferences, allergies, medical conditions, and lifestyle.',
      url: `${BASE_URL}/pl/rejestracja`,
    },
    {
      '@type': 'HowToStep',
      position: 2,
      name: 'AI generates your personalized plan (AI tworzy Twój plan)',
      text: 'Our AI analyzes your profile using clinical nutrition rules, a database of 6,600+ Polish food products, and mathematical optimization to create the optimal meal plan.',
    },
    {
      '@type': 'HowToStep',
      position: 3,
      name: 'Dietitian reviews and approves (Dietetyk weryfikuje i zatwierdza)',
      text: 'A licensed clinical dietitian reviews the AI-generated plan, verifies clinical safety, and approves the final version.',
    },
    {
      '@type': 'HowToStep',
      position: 4,
      name: 'Receive your plan and start eating healthy (Odbierz plan i jedz zdrowo)',
      text: 'Your approved plan appears in your dashboard within 24 hours — complete with recipes, shopping lists, and macro breakdowns.',
      url: `${BASE_URL}/pl/oferta`,
    },
  ],
};
