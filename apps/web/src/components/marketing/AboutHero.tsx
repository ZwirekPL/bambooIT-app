import { getTranslations } from 'next-intl/server';

/**
 * /o-nas hero — Fraunces 900 (heavier than PageHeader's light 300) per
 * mockup o-nas.html to give the brand-story page its own weight.
 */
export async function AboutHero() {
  const t = await getTranslations('oNas.hero');

  return (
    <section className="relative bg-paper px-5 pb-20 pt-32 md:px-12 md:pb-24 md:pt-44 lg:pt-52">
      <div className="mx-auto w-full max-w-[1440px]">
        <div className="mb-10 inline-flex items-center gap-2.5 font-mono text-xs uppercase tracking-[0.18em] text-bamboo-deep">
          <span
            aria-hidden="true"
            className="relative inline-block h-2 w-2 rounded-full bg-bamboo"
          >
            <span className="absolute inset-0 -m-1 animate-ping rounded-full bg-bamboo opacity-40" />
          </span>
          {t('eyebrow')}
        </div>
        <h1 className="max-w-[18ch] font-display text-5xl font-black leading-[0.92] tracking-[-0.04em] text-navy-deep md:text-6xl lg:text-7xl xl:text-8xl">
          {t.rich('heading', {
            em: (chunks) => <em className="italic text-bamboo-deep">{chunks}</em>,
          })}
        </h1>
        <p className="mt-10 max-w-[60ch] text-lg leading-[1.5] text-navy-soft md:text-xl lg:text-2xl">
          {t.rich('lede', {
            strong: (chunks) => <strong className="font-semibold text-navy-deep">{chunks}</strong>,
          })}
        </p>
      </div>
    </section>
  );
}
