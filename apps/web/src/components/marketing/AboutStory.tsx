import { getTranslations } from 'next-intl/server';

/**
 * "Why bambooIT exists" narrative — 2-col layout with sticky heading
 * label + heading on the left, three story paragraphs on the right.
 */
export async function AboutStory() {
  const t = await getTranslations('oNas.story');

  const paragraphs = ['p1', 'p2', 'p3'] as const;

  return (
    <section className="bg-paper px-5 py-24 md:px-12 md:py-32 lg:py-40">
      <div className="mx-auto grid w-full max-w-[1440px] grid-cols-1 gap-16 md:grid-cols-[1fr_1.4fr] md:gap-24">
        <div>
          <div className="relative mb-6 inline-flex pl-8 font-mono text-xs uppercase tracking-[0.18em] text-bamboo-deep">
            <span
              aria-hidden="true"
              className="absolute left-0 top-1/2 h-px w-5 -translate-y-1/2 bg-bamboo-deep"
            />
            {t('label')}
          </div>
          <h2 className="font-display text-3xl font-black leading-[0.98] tracking-[-0.03em] text-navy-deep md:text-4xl lg:text-5xl xl:text-6xl">
            {t.rich('heading', {
              em: (chunks) => <em className="italic text-bamboo-deep">{chunks}</em>,
            })}
          </h2>
        </div>
        <div className="space-y-6 text-base leading-[1.7] text-navy-soft md:text-lg">
          {paragraphs.map((id) => (
            <p key={id}>
              {t.rich(id, {
                strong: (chunks) => (
                  <strong className="font-semibold text-navy-deep">{chunks}</strong>
                ),
              })}
            </p>
          ))}
        </div>
      </div>
    </section>
  );
}
