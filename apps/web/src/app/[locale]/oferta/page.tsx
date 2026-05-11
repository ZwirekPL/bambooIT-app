import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { BRAND } from '@config/brand';
import { localeAlternates } from '@/lib/seo';
import { OfertaPageClient } from '@/components/oferta/OfertaPageClient';
import { BreadcrumbSchema } from '@/components/seo/BreadcrumbSchema';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('pricing');
  return {
    title: `${t('title')} — ${BRAND.name}`,
    description: t('subtitle'),
    alternates: localeAlternates('/oferta'),
  };
}

const serviceJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Service',
  name: 'Plan żywieniowy AI + dietetyk',
  provider: {
    '@type': 'Organization',
    name: BRAND.name,
    url: `https://${BRAND.domain}`,
  },
  description: BRAND.seo.description,
  areaServed: { '@type': 'Country', name: 'PL' },
  serviceType: 'Dietetyka online',
  offers: [
    {
      '@type': 'Offer',
      name: 'Opieka miesięczna',
      priceCurrency: 'PLN',
      price: '129',
      priceSpecification: {
        '@type': 'UnitPriceSpecification',
        price: '129',
        priceCurrency: 'PLN',
        unitText: 'miesiąc',
      },
    },
    {
      '@type': 'Offer',
      name: 'Opieka roczna',
      priceCurrency: 'PLN',
      price: '99',
      priceSpecification: {
        '@type': 'UnitPriceSpecification',
        price: '99',
        priceCurrency: 'PLN',
        unitText: 'miesiąc',
      },
    },
    {
      '@type': 'Offer',
      name: 'Konsultacja z dietetykiem',
      priceCurrency: 'PLN',
      price: '399',
    },
  ],
};

export default function PricingPage() {
  return (
    <>
      <BreadcrumbSchema locale="pl" items={[{ name: 'Oferta', path: '/oferta' }]} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceJsonLd) }}
      />
      <OfertaPageClient />
    </>
  );
}
