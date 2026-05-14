import { setRequestLocale, getTranslations } from 'next-intl/server';
import { PageHeader } from '@/components/marketing/PageHeader';
import { PricingTiersSection } from '@/components/marketing/PricingTiersSection';
import { ComparisonTable } from '@/components/marketing/ComparisonTable';
import { PricingFAQ } from '@/components/marketing/PricingFAQ';
import { FinalCTASection } from '@/components/marketing/FinalCTASection';
import { BRAND } from '@config/brand';
import type { Metadata } from 'next';

const PLAN_OFFERS = [
  { name: 'Pakiet Start', price: '390', desc: 'Do 3 stanowisk, 2 h wsparcia miesięcznie. Dla małych biur i sole proprietors.' },
  { name: 'Pakiet Firma', price: '690', desc: 'Do 7 stanowisk, 5 h wsparcia. Wizyty stacjonarne, czas reakcji do 1h. Flagship.' },
  { name: 'Pakiet Firma Plus', price: '1190', desc: '8–15 stanowisk, 10 h wsparcia. Managed backup, audyty cyberbezpieczeństwa, M365 admin.' },
];

/**
 * Service + Offer JSON-LD per pakiet. Google rich results: pricing carousel
 * for "obsługa IT cennik" queries. Each offer is a separate Schema.org
 * Service so SERP can list them inline.
 */
function pricingLd() {
  const baseUrl = `https://${BRAND.domain}`;
  return {
    '@context': 'https://schema.org',
    '@graph': PLAN_OFFERS.map((plan) => ({
      '@type': 'Service',
      name: plan.name,
      provider: {
        '@type': 'Organization',
        name: BRAND.name,
        url: baseUrl,
      },
      areaServed: { '@type': 'Country', name: 'PL' },
      serviceType: 'Obsługa IT — subskrypcja miesięczna',
      description: plan.desc,
      offers: {
        '@type': 'Offer',
        price: plan.price,
        priceCurrency: 'PLN',
        priceSpecification: {
          '@type': 'UnitPriceSpecification',
          price: plan.price,
          priceCurrency: 'PLN',
          unitText: 'MONTH',
          valueAddedTaxIncluded: false,
        },
        availability: 'https://schema.org/InStock',
        url: `${baseUrl}/pl/pakiety`,
      },
    })),
  };
}

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'pakiety.meta' });
  return {
    title: t('title'),
    description: t('description'),
  };
}

export default async function PakietyPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('pakiety.header');

  return (
    <>
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(pricingLd()) }}
      />
      <PageHeader
        eyebrow={t('eyebrow')}
        heading={t.rich('heading', {
          em: (chunks) => <em className="italic text-bamboo-deep">{chunks}</em>,
        })}
        lede={t('lede')}
      />
      <PricingTiersSection />
      <ComparisonTable />
      <PricingFAQ />
      <FinalCTASection />
    </>
  );
}
