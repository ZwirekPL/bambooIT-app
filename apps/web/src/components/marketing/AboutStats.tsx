import { getTranslations } from 'next-intl/server';

const STATS = ['specialists', 'pillars', 'callcenters', 'decisions'] as const;

/**
 * 4-stat strip under the hero on /o-nas. Stats are brand promises
 * (zero call centers, 100% client decision) rather than aspirational
 * customer counts — honest from day one.
 */
export async function AboutStats() {
  const t = await getTranslations('oNas.stats');

  return (
    <section className="bg-navy-deep px-5 py-16 text-white md:px-12 md:py-24">
      <div className="mx-auto grid w-full max-w-[1440px] grid-cols-2 gap-10 md:grid-cols-4 md:gap-12">
        {STATS.map((id, idx) => (
          <div
            key={id}
            className={
              idx > 0
                ? 'border-t border-white/15 pt-6 md:border-l md:border-t-0 md:pl-6 md:pt-0'
                : ''
            }
          >
            <div className="font-display text-5xl font-black leading-none tracking-[-0.03em] text-bamboo md:text-6xl lg:text-7xl">
              {t(`items.${id}.value`)}
            </div>
            <p className="mt-3 text-sm leading-[1.4] text-white/70">
              {t(`items.${id}.label`)}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
