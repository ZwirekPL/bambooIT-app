import { getTranslations } from 'next-intl/server';

/**
 * Security reassurance panel. AnyDesk connections look invasive to
 * non-technical users — this section pre-empts the "is this safe?"
 * objection with 3 concrete bullet guarantees.
 */
export async function RemoteSupportSecurity() {
  const t = await getTranslations('pomocZdalna.security');

  const points = ['1', '2', '3'] as const;

  return (
    <section className="bg-navy-deep px-5 py-20 text-white md:px-12 md:py-28">
      <div className="mx-auto grid w-full max-w-[1200px] grid-cols-1 gap-12 md:grid-cols-[1fr_1.4fr] md:gap-16">
        <div>
          <div className="mb-8 flex items-center gap-3.5 font-mono text-xs uppercase tracking-[0.2em] text-bamboo">
            <span aria-hidden="true" className="h-px w-8 bg-bamboo" />
            {t('label')}
          </div>
          <h2 className="font-display text-3xl font-light leading-[1.05] tracking-[-0.035em] text-white md:text-4xl lg:text-5xl">
            {t.rich('heading', {
              em: (chunks) => <em className="font-semibold italic text-bamboo">{chunks}</em>,
            })}
          </h2>
        </div>

        <ul className="flex flex-col gap-6">
          {points.map((id) => (
            <li
              key={id}
              className="flex items-start gap-4 border-l-2 border-bamboo pl-6"
            >
              <div>
                <h3 className="font-display text-xl font-semibold tracking-[-0.02em] text-white md:text-2xl">
                  {t(`points.${id}.title`)}
                </h3>
                <p className="mt-2 text-base leading-[1.6] text-white/70">
                  {t(`points.${id}.desc`)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
