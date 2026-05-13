import { setRequestLocale, getTranslations } from 'next-intl/server';
import { PageHeader } from '@/components/marketing/PageHeader';
import { PricingTiersSection } from '@/components/marketing/PricingTiersSection';
import { ComparisonTable } from '@/components/marketing/ComparisonTable';
import { PricingFAQ } from '@/components/marketing/PricingFAQ';
import { FinalCTASection } from '@/components/marketing/FinalCTASection';
import type { Metadata } from 'next';

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
