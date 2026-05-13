import { getTranslations } from 'next-intl/server';

type ServiceCard = {
  number: string;
  title: string;
  desc: string;
  features: string[];
};

export async function HorizontalServicesSection() {
  const t = await getTranslations('home.horizontalServices');

  // 6 service capabilities included with the IT subscription. Static 2-col
  // (md) / 3-col (lg) grid here. The mockup's pinned horizontal scroll with
  // an active-card scale-up (A9 in §5a) lands in FE-10 — at that point the
  // grid is replaced by a horizontal flex track + ScrollTrigger pin.
  const cards: ServiceCard[] = (['1', '2', '3', '4', '5', '6'] as const).map(
    (id) => ({
      number: t(`cards.${id}.number`),
      title: t(`cards.${id}.title`),
      desc: t(`cards.${id}.desc`),
      features: [
        t(`cards.${id}.features.1`),
        t(`cards.${id}.features.2`),
        t(`cards.${id}.features.3`),
      ],
    }),
  );

  return (
    <section
      id="services"
      className="relative overflow-hidden bg-navy-deep px-5 py-24 text-white md:px-12 md:py-32"
    >
      {/* Intro */}
      <div className="mx-auto w-full max-w-[1440px]">
        <div className="mb-16 max-w-3xl md:mb-20">
          <div className="mb-8 flex items-center gap-3.5 font-mono text-xs uppercase tracking-[0.2em] text-bamboo">
            <span aria-hidden="true" className="h-px w-8 bg-bamboo" />
            {t('intro.label')}
          </div>
          <h2 className="font-display text-4xl font-light leading-none tracking-[-0.035em] text-white md:text-5xl lg:text-6xl xl:text-7xl">
            {t.rich('intro.heading', {
              em: (chunks) => <em className="font-semibold italic text-bamboo">{chunks}</em>,
            })}
          </h2>
          <p className="mt-8 max-w-[50ch] text-base leading-[1.6] text-white/70 md:text-lg">
            {t('intro.lede')}
          </p>
        </div>

        {/* Cards grid */}
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {cards.map((card) => (
            <article
              key={card.title}
              className="relative flex min-h-[360px] flex-col overflow-hidden rounded-3xl border border-white/10 bg-navy p-10 transition-all duration-500 hover:border-bamboo hover:shadow-[0_30px_80px_-20px_rgba(139,195,74,0.3)]"
            >
              {/* Decorative top-right green radial */}
              <span
                aria-hidden="true"
                className="pointer-events-none absolute -right-[20%] -top-[20%] h-[60%] w-[60%] rounded-full bg-bamboo/15 blur-3xl"
              />
              <div className="relative">
                <span className="font-mono text-[13px] tracking-[0.15em] text-bamboo">
                  {card.number}
                </span>
                <h3 className="mt-5 font-display text-2xl font-normal leading-[1.05] tracking-[-0.025em] text-white md:text-3xl">
                  {card.title}
                </h3>
                <p className="mt-5 max-w-[34ch] text-base leading-[1.6] text-white/65">
                  {card.desc}
                </p>
              </div>
              <ul className="relative mt-auto flex flex-col gap-2.5 border-t border-white/10 pt-7">
                {card.features.map((feature) => (
                  <li
                    key={feature}
                    className="flex items-center gap-3 text-sm text-white/85"
                  >
                    <span
                      aria-hidden="true"
                      className="h-1.5 w-1.5 shrink-0 rounded-full bg-bamboo"
                    />
                    {feature}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
