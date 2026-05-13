import { getTranslations } from 'next-intl/server';
import { AnimatedStat } from './AnimatedStat';

export async function ManifestoSection() {
  const t = await getTranslations('home.manifesto');

  // Stats are mockup placeholders — bambooIT is brand-new and these claims
  // (98% / 15 min / 40+ firms) don't reflect actual operating numbers yet.
  // Wirgiliusz swaps the i18n values when honest numbers are available;
  // structure stays the same.
  const stats = [
    {
      value: t('stats.remote.value'),
      suffix: t('stats.remote.suffix'),
      label: t('stats.remote.label'),
    },
    {
      value: t('stats.response.value'),
      suffix: t('stats.response.suffix'),
      label: t('stats.response.label'),
    },
    {
      value: t('stats.firms.value'),
      suffix: t('stats.firms.suffix'),
      label: t('stats.firms.label'),
    },
  ];

  return (
    <section className="relative border-t border-line bg-paper px-5 py-24 md:px-12 md:py-32 lg:py-40">
      <div className="mx-auto grid w-full max-w-[1440px] grid-cols-1 items-start gap-16 md:grid-cols-[1.2fr_1fr] md:gap-24">
        {/* Manifesto sentence — em-wrapped words become italic green-deep */}
        <p className="font-display text-3xl font-light leading-[1.15] tracking-[-0.025em] text-navy md:text-4xl lg:text-5xl xl:text-[3.5rem]">
          {t.rich('text', {
            em: (chunks) => (
              <em className="font-semibold italic text-bamboo-deep">{chunks}</em>
            ),
          })}
        </p>

        {/* Numbers stack — A8 counter animation triggers when row scrolls into view */}
        <ul className="flex flex-col gap-12 pt-6">
          {stats.map((stat) => (
            <AnimatedStat
              key={stat.label}
              value={stat.value}
              suffix={stat.suffix}
              label={stat.label}
            />
          ))}
        </ul>
      </div>
    </section>
  );
}
