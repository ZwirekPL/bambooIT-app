import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';

type Tier = {
  id: 'start' | 'firma' | 'firmaPlus';
  featured?: boolean;
};

const TIERS: Tier[] = [
  { id: 'start' },
  { id: 'firma', featured: true },
  { id: 'firmaPlus' },
];

export async function PricingTiersSection() {
  const t = await getTranslations('home.pricing');

  // 3 subscription tiers per D-007: Start 390 / Firma 690 / Firma Plus 1190
  // PLN net / month. Pricing values come from i18n (locale-aware unit) but
  // the actual amounts are D-007 sacred — change only via decision update.
  //
  // Static render here: 3-col grid (1 col mobile). The mockup's 3D stack
  // assembly animation (A10 in §5a — tiers fly in from -300/+300/-y400 with
  // perspective 1500, featured tier rises -20px in second half) lands in FE-10.

  return (
    <section
      id="pricing"
      className="relative overflow-hidden bg-paper px-5 py-24 md:px-12 md:py-32"
    >
      <div className="mx-auto grid w-full max-w-[1200px] grid-cols-1 gap-6 md:grid-cols-3">
        {TIERS.map((tier) => (
          <TierCard key={tier.id} tier={tier} t={t} />
        ))}
      </div>
    </section>
  );
}

function TierCard({
  tier,
  t,
}: {
  tier: Tier;
  // next-intl translator type is intentionally loose here — section-scoped.
  t: Awaited<ReturnType<typeof getTranslations<'home.pricing'>>>;
}) {
  const featureKeys = ['1', '2', '3', '4', '5'] as const;
  const isFeatured = tier.featured;

  return (
    <article
      className={
        isFeatured
          ? 'relative flex flex-col rounded-3xl border border-navy-deep bg-navy-deep p-10 text-white shadow-[0_30px_60px_-20px_rgba(44,62,80,0.25)] md:-translate-y-3'
          : 'relative flex flex-col rounded-3xl border border-line bg-white p-10 text-navy transition-shadow hover:shadow-[0_30px_60px_-20px_rgba(44,62,80,0.18)]'
      }
    >
      {isFeatured && (
        <span className="absolute -top-3 right-6 rounded-full bg-bamboo px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.15em] text-navy-deep">
          {t('badge')}
        </span>
      )}

      <span
        className={
          isFeatured
            ? 'font-mono text-[11px] uppercase tracking-[0.2em] text-bamboo'
            : 'font-mono text-[11px] uppercase tracking-[0.2em] text-bamboo-deep'
        }
      >
        {t(`cards.${tier.id}.label`)}
      </span>

      <h3 className="mt-2 font-display text-3xl font-semibold tracking-[-0.02em]">
        {t(`cards.${tier.id}.name`)}
      </h3>

      <div className="mt-6 font-display text-6xl font-light leading-none tracking-[-0.04em]">
        {t(`cards.${tier.id}.price`)}
        <span className="ml-1 text-base font-normal opacity-60">
          {t(`cards.${tier.id}.priceUnit`)}
        </span>
      </div>
      <p
        className={
          isFeatured
            ? 'mt-2 text-sm text-white/60'
            : 'mt-2 text-sm text-navy-soft'
        }
      >
        {t(`cards.${tier.id}.priceDesc`)}
      </p>

      <ul className="my-8 flex flex-1 flex-col gap-3">
        {featureKeys.map((k) => (
          <li
            key={k}
            className={
              isFeatured
                ? 'flex items-start gap-2.5 text-sm leading-[1.5] text-white/90'
                : 'flex items-start gap-2.5 text-sm leading-[1.5] text-navy-soft'
            }
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              className="mt-0.5 shrink-0 text-bamboo"
              aria-hidden="true"
            >
              <path d="M5 12l5 5L20 7" />
            </svg>
            {t(`cards.${tier.id}.features.${k}`)}
          </li>
        ))}
      </ul>

      <Link
        href="/audyt"
        className={
          isFeatured
            ? 'rounded-full bg-bamboo px-6 py-3.5 text-center text-sm font-semibold text-navy-deep transition-colors hover:bg-white'
            : 'rounded-full bg-navy px-6 py-3.5 text-center text-sm font-semibold text-white transition-colors hover:bg-bamboo hover:text-navy-deep'
        }
      >
        {t(`cards.${tier.id}.cta`)}
      </Link>
    </article>
  );
}
