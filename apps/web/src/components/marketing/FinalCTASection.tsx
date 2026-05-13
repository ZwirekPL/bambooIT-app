import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { BRAND } from '@config/brand';

export async function FinalCTASection() {
  const t = await getTranslations('home.finalCta');

  return (
    <section className="relative overflow-hidden bg-navy-deep px-5 pb-24 pt-32 text-white md:px-12 md:pb-28 md:pt-48">
      {/* Decorative bamboo radial top-right */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-[10%] -top-[40%] h-[600px] w-[600px] rounded-full bg-bamboo/20 blur-3xl"
      />

      <div className="relative mx-auto w-full max-w-[1440px]">
        <h2 className="max-w-[14ch] font-display text-5xl font-light leading-[0.95] tracking-[-0.04em] text-white md:text-7xl lg:text-8xl xl:text-9xl">
          {t.rich('heading', {
            em: (chunks) => <em className="font-semibold italic text-bamboo">{chunks}</em>,
          })}
        </h2>

        <div className="mt-16 flex flex-col items-start justify-between gap-12 md:flex-row md:items-end md:gap-16">
          <Link
            href="/audyt"
            className="group inline-flex items-center gap-4 rounded-full bg-bamboo px-9 py-6 text-base font-bold text-navy-deep transition-all hover:-translate-y-1 hover:bg-white md:text-lg"
          >
            {t('cta')}
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-navy-deep text-bamboo transition-transform group-hover:translate-x-1">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                aria-hidden="true"
              >
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </span>
          </Link>

          <div className="flex flex-wrap gap-12">
            <div>
              <span className="block font-mono text-[11px] uppercase tracking-[0.2em] text-bamboo">
                {t('phoneLabel')}
              </span>
              <a
                href={`tel:${BRAND.phone.replace(/\s/g, '')}`}
                className="mt-1.5 block border-b border-transparent font-display text-xl text-white transition-colors hover:border-bamboo md:text-2xl"
              >
                {BRAND.phone}
              </a>
            </div>
            <div>
              <span className="block font-mono text-[11px] uppercase tracking-[0.2em] text-bamboo">
                {t('emailLabel')}
              </span>
              <a
                href={`mailto:${BRAND.email}`}
                className="mt-1.5 block border-b border-transparent font-display text-xl text-white transition-colors hover:border-bamboo md:text-2xl"
              >
                {BRAND.email}
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
