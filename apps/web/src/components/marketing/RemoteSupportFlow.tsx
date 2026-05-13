import { getTranslations } from 'next-intl/server';

const STEPS = ['1', '2', '3'] as const;

/**
 * 3-step "how a remote help session works" panel — what the client does
 * after downloading AnyDesk. Reassures the non-technical user.
 */
export async function RemoteSupportFlow() {
  const t = await getTranslations('pomocZdalna.howItWorks');

  return (
    <section className="bg-white px-5 py-20 md:px-12 md:py-28">
      <div className="mx-auto w-full max-w-[1200px]">
        <h2 className="mb-12 max-w-[24ch] font-display text-3xl font-light leading-[1.05] tracking-[-0.035em] text-navy md:text-4xl lg:text-5xl">
          {t.rich('heading', {
            em: (chunks) => <em className="font-semibold italic text-bamboo-deep">{chunks}</em>,
          })}
        </h2>

        <ol className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {STEPS.map((id, idx) => (
            <li
              key={id}
              className="flex flex-col rounded-2xl border border-line bg-paper p-8"
            >
              <span className="font-display text-5xl font-light italic leading-none tracking-[-0.04em] text-bamboo-deep">
                {String(idx + 1).padStart(2, '0')}
              </span>
              <h3 className="mt-8 font-display text-xl font-semibold tracking-[-0.02em] text-navy md:text-2xl">
                {t(`steps.${id}.title`)}
              </h3>
              <p className="mt-2 text-sm leading-[1.6] text-navy-soft">
                {t(`steps.${id}.desc`)}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
