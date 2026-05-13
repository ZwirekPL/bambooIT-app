import { getTranslations } from 'next-intl/server';

const BENEFITS = ['security', 'backup', 'infrastructure', 'report'] as const;

/**
 * Four benefit cards shown above the audit form on /audyt:
 * what we actually check during the free on-site audit.
 */
export async function AuditBenefits() {
  const t = await getTranslations('audyt.benefits');

  return (
    <section className="bg-paper px-5 py-20 md:px-12 md:py-28">
      <div className="mx-auto w-full max-w-[1440px]">
        <h2 className="mb-12 max-w-[28ch] font-display text-3xl font-light leading-[1.05] tracking-[-0.035em] text-navy md:text-4xl lg:text-5xl">
          {t.rich('heading', {
            em: (chunks) => <em className="font-semibold italic text-bamboo-deep">{chunks}</em>,
          })}
        </h2>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {BENEFITS.map((id, idx) => (
            <article
              key={id}
              className="flex flex-col rounded-2xl border border-line bg-white p-8 transition-all duration-300 hover:-translate-y-1 hover:border-bamboo hover:shadow-lg"
            >
              <span className="font-mono text-[11px] uppercase tracking-[0.15em] text-bamboo-deep">
                {String(idx + 1).padStart(2, '0')} / {t(`items.${id}.tag`)}
              </span>
              <h3 className="mt-12 font-display text-2xl font-semibold leading-[1.1] tracking-[-0.02em] text-navy">
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
