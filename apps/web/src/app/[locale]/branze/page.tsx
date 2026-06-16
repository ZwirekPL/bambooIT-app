import { setRequestLocale, getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { Link } from '@/i18n/navigation';
import { PageHeader } from '@/components/marketing/PageHeader';
import { FinalCTASection } from '@/components/marketing/FinalCTASection';
import { BRAND } from '@config/brand';

type Props = {
  params: Promise<{ locale: string }>;
};

// Slug → existing /branze/{slug} subpage. Order mirrors PRD priority sectors.
const INDUSTRY_SLUGS = [
  'biura-rachunkowe',
  'kancelarie',
  'gabinety',
  'hotele',
  'produkcja',
] as const;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'branze.hub.meta' });
  return {
    title: t('title'),
    description: t('description'),
  };
}

export default async function BranzeHubPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('branze.hub');
  const baseUrl = `https://${BRAND.domain}`;

  // CollectionPage + ItemList so the hub can surface as a sitelinks-style
  // result for "IT dla branż" / "obsługa IT branżowa" queries.
  const collectionLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: t('meta.title'),
    description: t('meta.description'),
    url: `${baseUrl}/pl/branze`,
    hasPart: INDUSTRY_SLUGS.map((slug) => ({
      '@type': 'WebPage',
      name: t(`items.${slug}.title`),
      url: `${baseUrl}/pl/branze/${slug}`,
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionLd) }}
      />
      <PageHeader
        eyebrow={t('header.eyebrow')}
        heading={t.rich('header.heading', {
          em: (chunks: ReactNode) => <em className="italic text-bamboo-deep">{chunks}</em>,
        })}
        lede={t('header.lede')}
      />

      <section className="bg-paper px-5 py-20 md:px-12 md:py-28">
        <div className="mx-auto w-full max-w-[1440px]">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {INDUSTRY_SLUGS.map((slug, idx) => (
              <Link
                key={slug}
                href={`/branze/${slug}`}
                className="group flex flex-col rounded-2xl border border-line bg-white p-8 transition-all duration-300 hover:-translate-y-1 hover:border-bamboo hover:shadow-lg"
              >
                <span className="font-mono text-[11px] uppercase tracking-[0.15em] text-bamboo-deep">
                  {String(idx + 1).padStart(2, '0')} / {t(`items.${slug}.tag`)}
                </span>
                <h2 className="mt-12 font-display text-xl font-semibold leading-[1.1] tracking-[-0.02em] text-navy md:text-2xl">
                  {t(`items.${slug}.title`)}
                </h2>
                <p className="mt-3 flex-1 text-sm leading-[1.55] text-navy-soft">
                  {t(`items.${slug}.desc`)}
                </p>
                <span className="mt-6 inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.15em] text-bamboo-deep">
                  {t('cardCta')}
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    aria-hidden="true"
                    className="transition-transform group-hover:translate-x-1"
                  >
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <FinalCTASection />
    </>
  );
}
