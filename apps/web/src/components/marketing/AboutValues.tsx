import { getTranslations } from 'next-intl/server';

const VALUES = ['noCallcenter', 'transparentPricing', 'yourOwnership', 'sayNo'] as const;

/**
 * 4 brand values from mockup o-nas — what bambooIT promises not to do.
 */
export async function AboutValues() {
  const t = await getTranslations('oNas.values');

  return (
    <section className="bg-paper px-5 py-24 md:px-12 md:py-32 lg:py-40">
      <div className="mx-auto w-full max-w-[1440px]">
        <div className="mb-16 max-w-3xl md:mb-20">
          <div className="relative mb-6 inline-flex pl-8 font-mono text-xs uppercase tracking-[0.18em] text-bamboo-deep">
            <span
              aria-hidden="true"
              className="absolute left-0 top-1/2 h-px w-5 -translate-y-1/2 bg-bamboo-deep"
            />
            {t('label')}
          </div>
          <h2 className="font-display text-3xl font-black leading-[0.98] tracking-[-0.03em] text-navy-deep md:text-5xl lg:text-6xl">
            {t.rich('heading', {
              em: (chunks) => <em className="italic text-bamboo-deep">{chunks}</em>,
            })}
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {VALUES.map((id, idx) => (
            <article
              key={id}
              className="flex min-h-[260px] flex-col rounded-2xl border border-line bg-white p-8 transition-all duration-300 hover:-translate-y-1 hover:border-bamboo"
            >
              <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-bamboo-deep">
                {String(idx + 1).padStart(2, '0')}
              </span>
              <h3 className="mt-12 font-display text-2xl font-semibold leading-[1.1] tracking-[-0.02em] text-navy-deep">
                {t(`items.${id}.title`)}
              </h3>
              <p className="mt-3 text-sm leading-[1.55] text-navy-soft">
                {t(`items.${id}.desc`)}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
