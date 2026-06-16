import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { Link } from '@/i18n/navigation';
import { PageHeader } from '@/components/marketing/PageHeader';
import { FinalCTASection } from '@/components/marketing/FinalCTASection';
import { BRAND } from '@config/brand';

/**
 * Service-pillar landing template for the three cross-sell offers
 * (`/strony-internetowe`, `/aplikacje`, `/automatyzacje`). Mirrors the
 * structure of {@link IndustryLanding} so navigation between marketing pages
 * feels consistent:
 *
 *   PageHeader → "po co" (why/who) → "co dostajesz" (deliverables) →
 *   cennik (price brackets) → proces (steps) → cross-sell band → FinalCTA.
 *
 * All copy lives in `messages/pl.json` under `uslugi.{slug}.*` so a
 * non-developer can tweak it. Section item counts differ per service
 * (e.g. automatyzacje has a 5-row price table, strony has 4 brackets) so
 * they are declared in SERVICE_COUNTS rather than hard-coded like the
 * industry template.
 */
type ServiceSlug = 'strony-internetowe' | 'aplikacje' | 'automatyzacje';

type SectionCounts = {
  why: number;
  deliver: number;
  pricing: number;
  process: number;
};

const SERVICE_COUNTS: Record<ServiceSlug, SectionCounts> = {
  'strony-internetowe': { why: 4, deliver: 4, pricing: 4, process: 4 },
  aplikacje: { why: 4, deliver: 4, pricing: 3, process: 5 },
  automatyzacje: { why: 4, deliver: 4, pricing: 5, process: 4 },
};

const ids = (n: number) => Array.from({ length: n }, (_, i) => String(i + 1));

const emphasize = (chunks: ReactNode) => (
  <em className="font-semibold italic text-bamboo-deep">{chunks}</em>
);

type Props = { serviceSlug: ServiceSlug };

export async function ServiceLanding({ serviceSlug }: Props) {
  const t = await getTranslations(`uslugi.${serviceSlug}`);
  const counts = SERVICE_COUNTS[serviceSlug];
  const baseUrl = `https://${BRAND.domain}`;

  // Schema.org Service — rich-result eligibility for queries like
  // "strony internetowe Wrocław", "aplikacje na zamówienie", etc.
  const serviceLd = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: t('meta.title'),
    description: t('meta.description'),
    provider: {
      '@type': 'Organization',
      name: BRAND.name,
      url: baseUrl,
    },
    areaServed: { '@type': 'Country', name: 'PL' },
    serviceType: t('header.eyebrow'),
    url: `${baseUrl}/pl/${serviceSlug}`,
  };

  return (
    <>
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceLd) }}
      />
      <PageHeader
        eyebrow={t('header.eyebrow')}
        heading={t.rich('header.heading', { em: emphasize })}
        lede={t('header.lede')}
      />

      {/* Why / who — the problem this service solves */}
      <section className="bg-paper px-5 py-20 md:px-12 md:py-28">
        <div className="mx-auto w-full max-w-[1440px]">
          <h2 className="mb-12 max-w-[28ch] font-display text-3xl font-light leading-[1.05] tracking-[-0.035em] text-navy md:text-4xl lg:text-5xl">
            {t.rich('why.heading', { em: emphasize })}
          </h2>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {ids(counts.why).map((id, idx) => (
              <article
                key={id}
                className="flex flex-col rounded-2xl border border-line bg-white p-8 transition-all duration-300 hover:-translate-y-1 hover:border-line-strong hover:shadow-lg"
              >
                <span className="font-mono text-[11px] uppercase tracking-[0.15em] text-bamboo-deep">
                  {String(idx + 1).padStart(2, '0')} / {t(`why.items.${id}.tag`)}
                </span>
                <h3 className="mt-12 font-display text-xl font-semibold leading-[1.1] tracking-[-0.02em] text-navy md:text-2xl">
                  {t(`why.items.${id}.title`)}
                </h3>
                <p className="mt-3 text-sm leading-[1.55] text-navy-soft">
                  {t(`why.items.${id}.desc`)}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Deliverables — what bambooIT actually ships */}
      <section className="bg-navy-deep px-5 py-20 text-white md:px-12 md:py-28">
        <div className="mx-auto grid w-full max-w-[1440px] grid-cols-1 gap-12 md:grid-cols-[1fr_1.4fr] md:gap-16">
          <div>
            <div className="mb-8 flex items-center gap-3.5 font-mono text-xs uppercase tracking-[0.2em] text-bamboo">
              <span aria-hidden="true" className="h-px w-8 bg-bamboo" />
              {t('deliver.label')}
            </div>
            <h2 className="font-display text-3xl font-light leading-[1.05] tracking-[-0.035em] text-white md:text-4xl lg:text-5xl">
              {t.rich('deliver.heading', {
                em: (chunks: ReactNode) => (
                  <em className="font-semibold italic text-bamboo">{chunks}</em>
                ),
              })}
            </h2>
          </div>
          <ul className="flex flex-col gap-6">
            {ids(counts.deliver).map((id) => (
              <li key={id} className="flex items-start gap-4 border-l-2 border-bamboo pl-6">
                <div>
                  <h3 className="font-display text-xl font-semibold tracking-[-0.02em] text-white md:text-2xl">
                    {t(`deliver.items.${id}.title`)}
                  </h3>
                  <p className="mt-2 text-base leading-[1.6] text-white/70">
                    {t(`deliver.items.${id}.desc`)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Pricing brackets — transparent ranges from PRD §4.2-4.4 */}
      <section className="bg-paper px-5 py-20 md:px-12 md:py-28">
        <div className="mx-auto w-full max-w-[1440px]">
          <div className="mb-12 flex items-center gap-3.5 font-mono text-xs uppercase tracking-[0.2em] text-bamboo-deep">
            <span aria-hidden="true" className="h-px w-8 bg-bamboo-deep" />
            {t('pricing.label')}
          </div>
          <h2 className="mb-12 max-w-[24ch] font-display text-3xl font-light leading-[1.05] tracking-[-0.035em] text-navy md:text-4xl lg:text-5xl">
            {t.rich('pricing.heading', { em: emphasize })}
          </h2>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {ids(counts.pricing).map((id) => (
              <article
                key={id}
                className="flex flex-col rounded-2xl border border-line bg-white p-8 transition-all duration-300 hover:-translate-y-1 hover:border-bamboo hover:shadow-lg"
              >
                <span className="font-mono text-[11px] uppercase tracking-[0.15em] text-bamboo-deep">
                  {t(`pricing.items.${id}.name`)}
                </span>
                <p className="mt-4 font-display text-2xl font-semibold leading-[1.05] tracking-[-0.02em] text-navy md:text-3xl">
                  {t(`pricing.items.${id}.price`)}
                </p>
                <p className="mt-3 text-sm leading-[1.55] text-navy-soft">
                  {t(`pricing.items.${id}.desc`)}
                </p>
              </article>
            ))}
          </div>
          <p className="mt-8 max-w-[70ch] text-sm leading-[1.7] text-navy-soft">
            {t('pricing.note')}
          </p>
        </div>
      </section>

      {/* Process — how a project runs */}
      <section className="bg-white px-5 py-20 md:px-12 md:py-28">
        <div className="mx-auto w-full max-w-[1440px]">
          <div className="mb-12 flex items-center gap-3.5 font-mono text-xs uppercase tracking-[0.2em] text-bamboo-deep">
            <span aria-hidden="true" className="h-px w-8 bg-bamboo-deep" />
            {t('process.label')}
          </div>
          <h2 className="mb-12 max-w-[24ch] font-display text-3xl font-light leading-[1.05] tracking-[-0.035em] text-navy md:text-4xl lg:text-5xl">
            {t.rich('process.heading', { em: emphasize })}
          </h2>
          <ol className="grid grid-cols-1 gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
            {ids(counts.process).map((id, idx) => (
              <li key={id} className="flex flex-col border-t border-line pt-6">
                <span className="font-mono text-3xl font-light tracking-[-0.02em] text-bamboo-deep">
                  {String(idx + 1).padStart(2, '0')}
                </span>
                <h3 className="mt-6 font-display text-xl font-semibold leading-[1.1] tracking-[-0.02em] text-navy">
                  {t(`process.steps.${id}.title`)}
                </h3>
                <p className="mt-3 text-sm leading-[1.55] text-navy-soft">
                  {t(`process.steps.${id}.desc`)}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Cross-sell band — abonament IT clients get a discount / perk */}
      <section className="bg-paper px-5 pb-20 md:px-12 md:pb-28">
        <div className="mx-auto w-full max-w-[1200px]">
          <div className="rounded-3xl border border-bamboo/40 bg-white p-10 md:p-14">
            <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-bamboo-deep">
              {t('crossSell.tag')}
            </span>
            <h2 className="mt-4 font-display text-2xl font-light leading-[1.1] tracking-[-0.03em] text-navy md:text-3xl lg:text-4xl">
              {t.rich('crossSell.heading', { em: emphasize })}
            </h2>
            <p className="mt-6 max-w-[60ch] text-base leading-[1.7] text-navy-soft md:text-lg">
              {t('crossSell.body')}
            </p>
            <Link
              href="/audyt"
              className="mt-8 inline-flex items-center gap-3 rounded-full bg-bamboo px-7 py-3.5 text-sm font-bold text-navy-deep transition-all hover:-translate-y-0.5 hover:bg-bamboo-deep"
            >
              {t('crossSell.cta')}
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                aria-hidden="true"
              >
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </Link>
          </div>
        </div>
      </section>

      <FinalCTASection />
    </>
  );
}
