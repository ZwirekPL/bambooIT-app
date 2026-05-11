import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { BRAND } from '@config/brand';
import { howToJsonLd, organizationSchema } from '@config/schemas';
import { localeAlternates } from '@/lib/seo';
import { BreadcrumbSchema } from '@/components/seo/BreadcrumbSchema';
import { HowAiWorksHero } from '@/components/how-ai-works/HowAiWorksHero';
import { AiProcessSection } from '@/components/how-ai-works/AiProcessSection';
import { SafetySection } from '@/components/how-ai-works/SafetySection';
import { ComparisonSection } from '@/components/how-ai-works/ComparisonSection';
import { HowAiWorksCta } from '@/components/how-ai-works/HowAiWorksCta';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('howAiWorks');
  return {
    title: `${t('metaTitle')} | ${BRAND.domain}`,
    description: t('metaDescription'),
    alternates: localeAlternates('/jak-to-dziala'),
  };
}

const articleJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'How AI Diet Planning Works — e-dietetyk.com',
  description:
    'A comprehensive guide to how e-dietetyk.com combines AI technology with clinical dietitian expertise to create personalized nutrition plans.',
  author: {
    '@type': 'Organization',
    name: BRAND.name,
  },
  publisher: organizationSchema,
  about: {
    '@type': 'Thing',
    name: 'AI diet planning methodology',
    description: 'The process of creating personalized nutrition plans using artificial intelligence, mathematical optimization, and clinical dietitian review.',
  },
  url: `https://${BRAND.domain}/pl/jak-to-dziala`,
  inLanguage: ['pl', 'en'],
};

export default async function HowAiWorksPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('howAiWorks');

  return (
    <>
      <BreadcrumbSchema
        locale={locale}
        items={[{ name: t('title'), path: '/jak-to-dziala' }]}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(howToJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      <HowAiWorksHero />
      <AiProcessSection />
      <SafetySection />
      <ComparisonSection />
      <HowAiWorksCta />
    </>
  );
}
