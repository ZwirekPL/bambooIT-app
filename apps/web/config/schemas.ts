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
  foundingDate: String(BRAND.geo.foundingYear),
  areaServed: {
    '@type': 'Country',
    name: 'PL',
  },
  knowsAbout: [
    'Outsourcing IT',
    'Obsługa informatyczna MŚP',
    'Helpdesk i wsparcie użytkowników',
    'Cyberbezpieczeństwo',
    'Backup i disaster recovery',
    'Microsoft 365 i Google Workspace',
    'Strony internetowe i aplikacje webowe',
    'Automatyzacje procesów biznesowych',
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
  inLanguage: ['pl'],
  publisher: {
    '@type': 'Organization',
    name: BRAND.name,
    url: BASE_URL,
  },
};

/** ProfessionalService schema — bambooIT IT support subscriptions */
export const professionalServiceJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'ProfessionalService',
  name: `${BRAND.name} — Outsourcing IT dla MŚP`,
  serviceType: 'Obsługa informatyczna',
  url: BASE_URL,
  description:
    'Abonamentowa obsługa IT dla małych i średnich firm: helpdesk, pomoc zdalna, cyberbezpieczeństwo, Microsoft 365, backup. Stała opieka, szybka reakcja, przewidywalny koszt.',
  provider: {
    '@type': 'Organization',
    name: BRAND.name,
    url: BASE_URL,
  },
  areaServed: {
    '@type': 'Country',
    name: 'PL',
  },
  offers: [
    {
      '@type': 'Offer',
      name: 'Pakiet Start',
      price: '390',
      priceCurrency: 'PLN',
      priceSpecification: {
        '@type': 'UnitPriceSpecification',
        price: '390',
        priceCurrency: 'PLN',
        unitText: 'month',
      },
      url: `${BASE_URL}/pl/pakiety`,
    },
    {
      '@type': 'Offer',
      name: 'Pakiet Firma',
      price: '690',
      priceCurrency: 'PLN',
      priceSpecification: {
        '@type': 'UnitPriceSpecification',
        price: '690',
        priceCurrency: 'PLN',
        unitText: 'month',
      },
      url: `${BASE_URL}/pl/pakiety`,
    },
    {
      '@type': 'Offer',
      name: 'Pakiet Firma Plus',
      price: '1190',
      priceCurrency: 'PLN',
      priceSpecification: {
        '@type': 'UnitPriceSpecification',
        price: '1190',
        priceCurrency: 'PLN',
        unitText: 'month',
      },
      url: `${BASE_URL}/pl/pakiety`,
    },
  ],
  featureList: [
    'Helpdesk i pomoc zdalna bez limitu',
    'Określony czas reakcji (SLA)',
    'Administracja Microsoft 365',
    'Audyty cyberbezpieczeństwa',
    'Zarządzany backup i recovery',
    'Miesięczne raporty wykonanych prac',
  ],
};

/** HowTo schema — starting IT support with bambooIT */
export const howToJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'HowTo',
  name: 'Jak rozpocząć współpracę z bambooIT (How to start IT support with bambooIT)',
  description:
    'Zacznij stałą obsługę IT swojej firmy w 4 prostych krokach: od bezpłatnego audytu po aktywny pakiet wsparcia.',
  totalTime: 'P1D',
  tool: {
    '@type': 'HowToTool',
    name: 'bambooit.pl',
  },
  step: [
    {
      '@type': 'HowToStep',
      position: 1,
      name: 'Wypełnij formularz bezpłatnego audytu',
      text: 'Opisz w kilka minut wielkość firmy, branżę i obecne problemy z IT — bez zobowiązań.',
      url: `${BASE_URL}/pl/audyt`,
    },
    {
      '@type': 'HowToStep',
      position: 2,
      name: 'Otrzymaj rekomendację pakietu',
      text: 'Dobierzemy pakiet (Start, Firma lub Firma Plus) do liczby stanowisk i zakresu wsparcia, którego potrzebujesz.',
    },
    {
      '@type': 'HowToStep',
      position: 3,
      name: 'Załóż konto i aktywuj subskrypcję',
      text: 'Zarejestruj firmę i opłać pierwszy miesiąc — płatność obsługuje Stripe, fakturę otrzymasz emailem.',
      url: `${BASE_URL}/pl/rejestracja`,
    },
    {
      '@type': 'HowToStep',
      position: 4,
      name: 'Korzystaj ze wsparcia',
      text: 'Od tej chwili masz stały helpdesk, pomoc zdalną i opiekę zespołu bambooIT w ramach wybranego pakietu.',
      url: `${BASE_URL}/pl/pakiety`,
    },
  ],
};
