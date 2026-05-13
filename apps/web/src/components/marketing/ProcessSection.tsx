import { getTranslations } from 'next-intl/server';

export async function ProcessSection() {
  const t = await getTranslations('home.process');

  // 4-step process from first call to operational care.
  // Static render: vertical stack with number column + content. The mockup's
  // SVG line draw + step.active toggle + step-num rotate entrance (A11 in
  // §5a) lands in FE-10.
  const steps = ['1', '2', '3', '4'] as const;

  return (
    <section
      id="process"
      className="relative border-t border-line bg-white px-5 py-24 md:px-12 md:py-32 lg:py-40"
    >
      <div className="mx-auto w-full max-w-[1440px]">
        {/* Intro */}
        <div className="mb-20 grid grid-cols-1 items-end gap-12 md:mb-24 md:grid-cols-2 md:gap-16">
          <div>
            <div className="mb-8 flex items-center gap-3.5 font-mono text-xs uppercase tracking-[0.2em] text-bamboo-deep">
              <span aria-hidden="true" className="h-px w-8 bg-bamboo-deep" />
              {t('intro.label')}
            </div>
            <h2 className="font-display text-4xl font-light leading-none tracking-[-0.035em] text-navy md:text-5xl lg:text-6xl xl:text-7xl">
              {t.rich('intro.heading', {
                em: (chunks) => <em className="font-semibold italic text-bamboo-deep">{chunks}</em>,
              })}
            </h2>
          </div>
          <p className="max-w-[42ch] text-base leading-[1.6] text-navy-soft md:text-lg">
            {t('intro.lede')}
          </p>
        </div>

        {/* Steps timeline */}
        <ol className="relative">
          {steps.map((id, idx) => (
            <li
              key={id}
              className={`grid grid-cols-1 items-start gap-4 py-10 md:grid-cols-[96px_1fr_1.5fr] md:gap-12 md:py-12 ${
                idx < steps.length - 1 ? 'border-b border-line' : ''
              }`}
            >
              <span className="font-display text-6xl font-light italic leading-none tracking-[-0.04em] text-bamboo-deep md:text-7xl lg:text-[6rem]">
                {String(idx + 1).padStart(2, '0')}
              </span>
              <h3 className="font-display text-2xl font-semibold tracking-[-0.02em] text-navy md:text-3xl">
                {t(`steps.${id}.title`)}
              </h3>
              <p className="text-base leading-[1.6] text-navy-soft">
                {t(`steps.${id}.desc`)}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
