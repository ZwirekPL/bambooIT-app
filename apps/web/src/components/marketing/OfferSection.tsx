import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';

type OfferCard = {
  numberLabel: string;
  title: string;
  description: string;
  cta: string;
  href: string;
  featured?: boolean;
  featuredTag?: string;
};

export async function OfferSection() {
  const t = await getTranslations('home.offer');

  // 4 service pillars per mockup. IT card is featured (navy-deep, full ink).
  // Cross-sell cards (strony/aplikacje/automatyzacje) all land in /audyt until
  // dedicated landing pages ship in Faza 5 — single lead-gen funnel for now.
  const cards: OfferCard[] = [
    {
      numberLabel: t('cards.itSupport.number'),
      title: t('cards.itSupport.title'),
      description: t('cards.itSupport.desc'),
      cta: t('cards.itSupport.cta'),
      href: '/pakiety',
      featured: true,
      featuredTag: t('cards.itSupport.tag'),
    },
    {
      numberLabel: t('cards.websites.number'),
      title: t('cards.websites.title'),
      description: t('cards.websites.desc'),
      cta: t('cards.cta'),
      href: '/audyt',
    },
    {
      numberLabel: t('cards.apps.number'),
      title: t('cards.apps.title'),
      description: t('cards.apps.desc'),
      cta: t('cards.cta'),
      href: '/audyt',
    },
    {
      numberLabel: t('cards.automation.number'),
      title: t('cards.automation.title'),
      description: t('cards.automation.desc'),
      cta: t('cards.cta'),
      href: '/audyt',
    },
  ];

  return (
    <section id="offer" className="relative bg-paper px-5 py-20 md:px-12 md:py-28">
      <div className="mx-auto w-full max-w-[1440px]">
        {/* Heading row: title left, lede right */}
        <div className="mb-12 grid grid-cols-1 items-end gap-8 md:mb-16 md:grid-cols-[1fr_1.2fr] md:gap-20">
          <h2 className="font-display text-4xl font-black leading-[0.95] tracking-[-0.03em] text-navy-deep md:text-5xl lg:text-6xl xl:text-7xl">
            {t.rich('heading', {
              em: (chunks) => <em className="italic text-bamboo-deep">{chunks}</em>,
            })}
          </h2>
          <p className="max-w-xl text-base leading-[1.6] text-navy-soft md:text-lg">
            {t('lede')}
          </p>
        </div>

        {/* 4-card grid */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((card) => (
            <OfferCardItem key={card.title} card={card} />
          ))}
        </div>

        {/* Team line */}
        <div className="mt-16 flex flex-col items-start justify-between gap-6 rounded-2xl bg-navy-deep px-8 py-8 text-white md:flex-row md:items-center md:gap-8 md:px-10">
          <p className="max-w-2xl font-display text-lg font-normal italic leading-[1.4] md:text-xl lg:text-2xl">
            {t.rich('teamLine', {
              strong: (chunks) => (
                <strong className="font-semibold not-italic text-bamboo">{chunks}</strong>
              ),
            })}
          </p>
          <Link
            href="/o-nas"
            className="inline-flex shrink-0 items-center gap-2.5 rounded-full bg-bamboo px-7 py-3.5 font-mono text-xs font-bold uppercase tracking-[0.1em] text-navy-deep transition-all hover:-translate-y-0.5 hover:bg-bamboo-deep"
          >
            {t('teamCta')}
          </Link>
        </div>
      </div>
    </section>
  );
}

function OfferCardItem({ card }: { card: OfferCard }) {
  const isFeatured = card.featured;
  return (
    <article
      className={
        isFeatured
          ? 'relative flex min-h-[380px] flex-col justify-between overflow-hidden rounded-3xl border border-navy-deep bg-navy-deep p-9 text-white transition-all duration-500 hover:-translate-y-1.5 hover:shadow-2xl'
          : 'relative flex min-h-[380px] flex-col justify-between overflow-hidden rounded-3xl border border-line bg-white p-9 text-navy transition-all duration-500 hover:-translate-y-1.5 hover:border-line-strong hover:shadow-xl'
      }
    >
      {isFeatured && card.featuredTag && (
        <span className="absolute right-6 top-6 font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-bamboo">
          {card.featuredTag}
        </span>
      )}
      <span
        className={
          isFeatured
            ? 'font-mono text-xs uppercase tracking-[0.12em] text-bamboo-soft'
            : 'font-mono text-xs uppercase tracking-[0.12em] text-navy-soft'
        }
      >
        {card.numberLabel}
      </span>
      <div className="mt-20">
        <h3 className="font-display text-2xl font-semibold leading-[1.05] tracking-[-0.02em] md:text-3xl">
          {card.title}
        </h3>
        <p
          className={
            isFeatured
              ? 'mt-3.5 text-sm leading-[1.55] text-bamboo-soft'
              : 'mt-3.5 text-sm leading-[1.55] text-navy-soft'
          }
        >
          {card.description}
        </p>
      </div>
      <Link
        href={card.href}
        className={
          isFeatured
            ? 'mt-6 inline-flex items-center gap-2.5 font-mono text-xs font-medium uppercase tracking-[0.1em] text-bamboo transition-colors hover:text-white'
            : 'mt-6 inline-flex items-center gap-2.5 font-mono text-xs font-medium uppercase tracking-[0.1em] text-navy-deep transition-colors hover:text-bamboo-deep'
        }
      >
        {card.cta}
        <svg
          aria-hidden="true"
          width="20"
          height="12"
          viewBox="0 0 24 14"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="transition-transform group-hover:translate-x-1.5"
        >
          <path d="M1 7h22M17 1l6 6-6 6" />
        </svg>
      </Link>
    </article>
  );
}
