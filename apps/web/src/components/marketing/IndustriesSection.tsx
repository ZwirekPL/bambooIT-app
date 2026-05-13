import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';

const INDUSTRIES = [
  { id: '1', slug: 'biura-rachunkowe' },
  { id: '2', slug: 'kancelarie' },
  { id: '3', slug: 'gabinety' },
  { id: '4', slug: 'produkcja' },
  { id: '5', slug: 'hotele' },
] as const;

export async function IndustriesSection() {
  const t = await getTranslations('home.industries');

  // 5 industries — final set per Wirgiliusz decision 2026-05-13 (option B):
  // biura-rachunkowe + kancelarie + gabinety + produkcja + hotele. Dropped
  // architektura (mockup had it as 6th) and salony (TODO.md FE-7 had it).

  return (
    <section
      id="industries"
      className="relative bg-bamboo px-5 py-24 text-navy-deep md:px-12 md:py-32"
    >
      <div className="mx-auto grid w-full max-w-[1440px] grid-cols-1 items-center gap-16 md:grid-cols-[1fr_1.5fr] md:gap-24">
        {/* Intro */}
        <div>
          <div className="mb-8 flex items-center gap-3.5 font-mono text-xs uppercase tracking-[0.2em] text-navy-deep">
            <span aria-hidden="true" className="h-px w-8 bg-navy-deep" />
            {t('intro.label')}
          </div>
          <h2 className="font-display text-4xl font-light leading-none tracking-[-0.035em] text-navy-deep md:text-5xl lg:text-6xl">
            {t.rich('intro.heading', {
              em: (chunks) => <em className="italic text-white">{chunks}</em>,
            })}
          </h2>
        </div>

        {/* List */}
        <ul className="flex flex-col border-t border-navy-deep/20">
          {INDUSTRIES.map((industry) => (
            <li
              key={industry.id}
              className="border-b border-navy-deep/20 transition-all duration-300 hover:pl-6"
            >
              <Link
                href={`/branze/${industry.slug}` as never}
                className="flex items-center justify-between py-7"
              >
                <span className="font-display text-3xl font-light leading-none tracking-[-0.02em] md:text-4xl lg:text-5xl">
                  {t(`items.${industry.id}.name`)}
                </span>
                <span
                  aria-hidden="true"
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-navy-deep transition-all duration-300 group-hover:bg-navy-deep"
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
