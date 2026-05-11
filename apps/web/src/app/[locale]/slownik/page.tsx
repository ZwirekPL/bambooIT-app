import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Badge } from '@/components/ui/badge';
import { GlossaryClient } from '@/components/glossary/GlossaryClient';
import { BRAND } from '@config/brand';
import { localeAlternates } from '@/lib/seo';
import { BreadcrumbSchema } from '@/components/seo/BreadcrumbSchema';

type Props = { params: Promise<{ locale: string }> };

const TERM_COUNT = 38;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('glossary');
  return {
    title: `${t('metaTitle')} | ${BRAND.domain}`,
    description: t('metaDescription'),
    alternates: localeAlternates('/slownik'),
  };
}

async function buildGlossarySchema(locale: string) {
  setRequestLocale(locale);
  const t = await getTranslations('glossary');
  const baseUrl = `https://${BRAND.domain}/${locale}/slownik`;

  const terms = [];
  for (let i = 1; i <= TERM_COUNT; i++) {
    terms.push({
      '@type': 'DefinedTerm',
      name: t(`t${i}name` as Parameters<typeof t>[0]),
      description: t(`t${i}def` as Parameters<typeof t>[0]),
      inDefinedTermSet: baseUrl,
    });
  }

  return {
    '@context': 'https://schema.org',
    '@type': 'DefinedTermSet',
    name: t('title'),
    description: t('metaDescription'),
    url: baseUrl,
    inLanguage: [locale],
    hasDefinedTerm: terms,
  };
}

export default async function GlossaryPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('glossary');
  const schema = await buildGlossarySchema(locale);

  return (
    <>
      <BreadcrumbSchema
        locale={locale}
        items={[{ name: t('badge'), path: '/slownik' }]}
      />
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
          <p className="mx-auto max-w-xl text-lg text-muted-foreground">
            {t('subtitle')}
          </p>
        </div>
      </section>

      <section className="py-16">
        <div className="container mx-auto max-w-5xl px-4 md:px-6">
          <GlossaryClient />
        </div>
      </section>
    </>
  );
}
