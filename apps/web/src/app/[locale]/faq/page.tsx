import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Badge } from '@/components/ui/badge';
import { FaqAccordion } from '@/components/faq/FaqAccordion';
import { BRAND } from '@config/brand';
import { localeAlternates } from '@/lib/seo';
import { BreadcrumbSchema } from '@/components/seo/BreadcrumbSchema';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('faq');
  return {
    title: `${t('metaTitle')} | ${BRAND.domain}`,
    description: t('metaDescription'),
    alternates: localeAlternates('/faq'),
  };
}

async function buildFaqSchema(locale: string) {
  setRequestLocale(locale);
  const t = await getTranslations('faq');

  const allQAs = [
    { q: t('cat1q1'), a: t('cat1a1') },
    { q: t('cat1q2'), a: t('cat1a2') },
    { q: t('cat1q3'), a: t('cat1a3') },
    { q: t('cat1q4'), a: t('cat1a4') },
    { q: t('cat2q1'), a: t('cat2a1') },
    { q: t('cat2q2'), a: t('cat2a2') },
    { q: t('cat2q3'), a: t('cat2a3') },
    { q: t('cat2q4'), a: t('cat2a4') },
    { q: t('cat2q5'), a: t('cat2a5') },
    { q: t('cat3q1'), a: t('cat3a1') },
    { q: t('cat3q2'), a: t('cat3a2') },
    { q: t('cat3q3'), a: t('cat3a3') },
    { q: t('cat3q4'), a: t('cat3a4') },
    { q: t('cat4q1'), a: t('cat4a1') },
    { q: t('cat4q2'), a: t('cat4a2') },
  ];

  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: allQAs.map(({ q, a }) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: {
        '@type': 'Answer',
        text: a,
      },
    })),
  };
}

export default async function FaqPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('faq');
  const schema = await buildFaqSchema(locale);

  return (
    <>
      <BreadcrumbSchema locale={locale} items={[{ name: 'FAQ', path: '/faq' }]} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />

      <section className="bg-gradient-to-b from-sage-50/50 to-background py-20">
        <div className="container mx-auto px-4 md:px-6 text-center">
          <Badge variant="sage-outline" className="mb-4">
            {t('badge')}
          </Badge>
          <h1 className="mb-4 text-4xl font-extrabold tracking-tight sm:text-5xl">
            {t('title')}
          </h1>
          <p className="mx-auto max-w-xl text-lg text-muted-foreground">{t('subtitle')}</p>
        </div>
      </section>

      <section className="py-16">
        <div className="container mx-auto max-w-3xl px-4 md:px-6">
          <FaqAccordion />
        </div>
      </section>
    </>
  );
}
