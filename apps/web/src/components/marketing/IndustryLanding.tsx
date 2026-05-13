import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { Link } from '@/i18n/navigation';
import { PageHeader } from '@/components/marketing/PageHeader';
import { FinalCTASection } from '@/components/marketing/FinalCTASection';

const PAIN_IDS = ['1', '2', '3', '4'] as const;
const VALUE_IDS = ['1', '2', '3', '4'] as const;

/**
 * Industry-specific landing template. Each /branze/{slug} page passes its
 * own i18n namespace (`branze.{slug}`) and this component renders:
 *   PageHeader → IndustryPainPoints → IndustryValueProp → IndustryCaseStudy
 *   placeholder → FinalCTA.
 *
 * Same structural layout across all 5 industries so navigation between
 * them feels consistent; content (4 pain points + 4 value props + case
 * study copy) lives entirely in messages/{pl,en}.json under
 * `branze.{slug}.*` so non-developers can tweak.
 */
type Props = { industrySlug: string };

export async function IndustryLanding({ industrySlug }: Props) {
  const t = await getTranslations(`branze.${industrySlug}`);

  return (
    <>
      <PageHeader
        eyebrow={t('header.eyebrow')}
        heading={t.rich('header.heading', {
          em: (chunks: ReactNode) => <em className="italic text-bamboo-deep">{chunks}</em>,
        })}
        lede={t('header.lede')}
      />

      {/* Pain points — what hurts in this industry's IT today */}
      <section className="bg-paper px-5 py-20 md:px-12 md:py-28">
        <div className="mx-auto w-full max-w-[1440px]">
          <h2 className="mb-12 max-w-[28ch] font-display text-3xl font-light leading-[1.05] tracking-[-0.035em] text-navy md:text-4xl lg:text-5xl">
            {t.rich('painPoints.heading', {
              em: (chunks: ReactNode) => <em className="font-semibold italic text-bamboo-deep">{chunks}</em>,
            })}
          </h2>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {PAIN_IDS.map((id, idx) => (
              <article
                key={id}
                className="flex flex-col rounded-2xl border border-line bg-white p-8 transition-all duration-300 hover:-translate-y-1 hover:border-line-strong hover:shadow-lg"
              >
                <span className="font-mono text-[11px] uppercase tracking-[0.15em] text-bamboo-deep">
                  {String(idx + 1).padStart(2, '0')} / {t(`painPoints.items.${id}.tag`)}
                </span>
                <h3 className="mt-12 font-display text-xl font-semibold leading-[1.1] tracking-[-0.02em] text-navy md:text-2xl">
                  {t(`painPoints.items.${id}.title`)}
                </h3>
                <p className="mt-3 text-sm leading-[1.55] text-navy-soft">
                  {t(`painPoints.items.${id}.desc`)}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Value prop — how bambooIT solves it for this industry */}
      <section className="bg-navy-deep px-5 py-20 text-white md:px-12 md:py-28">
        <div className="mx-auto grid w-full max-w-[1440px] grid-cols-1 gap-12 md:grid-cols-[1fr_1.4fr] md:gap-16">
          <div>
            <div className="mb-8 flex items-center gap-3.5 font-mono text-xs uppercase tracking-[0.2em] text-bamboo">
              <span aria-hidden="true" className="h-px w-8 bg-bamboo" />
              {t('valueProp.label')}
            </div>
            <h2 className="font-display text-3xl font-light leading-[1.05] tracking-[-0.035em] text-white md:text-4xl lg:text-5xl">
              {t.rich('valueProp.heading', {
                em: (chunks: ReactNode) => <em className="font-semibold italic text-bamboo">{chunks}</em>,
              })}
            </h2>
          </div>
          <ul className="flex flex-col gap-6">
            {VALUE_IDS.map((id) => (
              <li key={id} className="flex items-start gap-4 border-l-2 border-bamboo pl-6">
                <div>
                  <h3 className="font-display text-xl font-semibold tracking-[-0.02em] text-white md:text-2xl">
                    {t(`valueProp.items.${id}.title`)}
                  </h3>
                  <p className="mt-2 text-base leading-[1.6] text-white/70">
                    {t(`valueProp.items.${id}.desc`)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Case study placeholder — real one ships when Wirgiliusz has client
          consent + actual numbers to share */}
      <section className="bg-paper px-5 py-20 md:px-12 md:py-28">
        <div className="mx-auto w-full max-w-[1200px]">
          <div className="rounded-3xl border border-line bg-white p-10 md:p-14">
            <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-bamboo-deep">
              {t('caseStudy.tag')}
            </span>
            <h2 className="mt-4 font-display text-2xl font-light leading-[1.1] tracking-[-0.03em] text-navy md:text-3xl lg:text-4xl">
              {t.rich('caseStudy.heading', {
                em: (chunks: ReactNode) => <em className="font-semibold italic text-bamboo-deep">{chunks}</em>,
              })}
            </h2>
            <p className="mt-6 max-w-[60ch] text-base leading-[1.7] text-navy-soft md:text-lg">
              {t('caseStudy.body')}
            </p>
            <Link
              href="/audyt"
              className="mt-8 inline-flex items-center gap-3 rounded-full bg-bamboo px-7 py-3.5 text-sm font-bold text-navy-deep transition-all hover:-translate-y-0.5 hover:bg-bamboo-deep"
            >
              {t('caseStudy.cta')}
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
