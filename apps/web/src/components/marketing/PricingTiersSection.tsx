'use client';

import { useRef } from 'react';
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
  type MotionValue,
} from 'framer-motion';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';

type TierId = 'start' | 'firma' | 'firmaPlus';

type TierConfig = {
  id: TierId;
  featured?: boolean;
  /** Starting 3D position before assembly */
  initial: { x: number; y: number; rotY: number; rotZ: number; rotX?: number; z: number };
};

const TIERS: TierConfig[] = [
  { id: 'start',     initial: { x: -300, y: 200, rotY: -30, rotZ: -8,  z: -200 } },
  { id: 'firma',     initial: { x: 0,    y: 400, rotY: 0,   rotZ: 0, rotX: 30, z: -300 }, featured: true },
  { id: 'firmaPlus', initial: { x: 300,  y: 200, rotY: 30,  rotZ: 8,   z: -200 } },
];

/**
 * A10 — Pricing 3D stack assembly.
 *
 * Outer container is 220vh tall; inner is sticky top:0 h-screen.
 * scrollYProgress 0..1 across the section drives:
 *   0..0.6   — three tier cards animate from scattered 3D start positions
 *               (left/center/right with different rotations + z-depth) to
 *               their final rest at x:0 y:0 rotation:0 z:0 opacity:1.
 *   0.6..1.0 — featured center tier rises y: -20 + scale 1.05 for emphasis.
 * Background giant "pricing." text drifts horizontally across.
 *
 * prefers-reduced-motion: skips the choreography entirely; cards render
 * as a normal 3-column grid (same as previous static implementation).
 */
export function PricingTiersSection() {
  const t = useTranslations('home.pricing');
  const shouldReduceMotion = useReducedMotion();
  const outerRef = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: outerRef,
    offset: ['start start', 'end end'],
  });

  if (shouldReduceMotion) {
    return (
      <section
        id="pricing"
        className="relative overflow-hidden bg-paper px-5 py-24 md:px-12 md:py-32"
      >
        <div className="mx-auto grid w-full max-w-[1200px] grid-cols-1 gap-6 md:grid-cols-3">
          {TIERS.map((tier) => (
            <StaticTierCard key={tier.id} tier={tier} t={t} />
          ))}
        </div>
      </section>
    );
  }

  // Background drift x: -50% → +50% across full scroll
  const bgX = useTransform(scrollYProgress, [0, 1], ['-50%', '50%']);

  return (
    <section id="pricing" className="relative bg-paper">
      <div ref={outerRef} className="relative h-[220vh]">
        <div
          className="sticky top-0 flex h-screen items-center justify-center overflow-hidden px-5 md:px-12"
          style={{ perspective: '1500px' }}
        >
          {/* Background giant "pricing." word that drifts horizontally */}
          <motion.div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 flex items-center justify-center"
            style={{ x: bgX }}
          >
            <span className="font-display text-[clamp(180px,28vw,420px)] font-black italic leading-none tracking-[-0.06em] text-navy opacity-[0.04]">
              pricing.
            </span>
          </motion.div>

          {/* 3D stack */}
          <div
            className="relative grid w-full max-w-[1200px] grid-cols-1 gap-6 md:grid-cols-3"
            style={{ transformStyle: 'preserve-3d' }}
          >
            {TIERS.map((tier) => (
              <AnimatedTierCard
                key={tier.id}
                tier={tier}
                t={t}
                progress={scrollYProgress}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function AnimatedTierCard({
  tier,
  t,
  progress,
}: {
  tier: TierConfig;
  t: ReturnType<typeof useTranslations<'home.pricing'>>;
  progress: MotionValue<number>;
}) {
  const { initial } = tier;

  // Phase 1 assembly (0 → 0.6): animate from initial scattered position to rest.
  const x = useTransform(progress, [0, 0.6], [initial.x, 0]);
  const z = useTransform(progress, [0, 0.6], [initial.z, 0]);
  const rotateY = useTransform(progress, [0, 0.6], [initial.rotY, 0]);
  const rotateZ = useTransform(progress, [0, 0.6], [initial.rotZ, 0]);
  const rotateX = useTransform(progress, [0, 0.6], [initial.rotX ?? 0, 0]);
  const opacity = useTransform(progress, [0, 0.6], [0, 1]);

  // Phase 2 emphasis (0.6 → 1.0): featured tier rises + scales.
  const y = useTransform(progress, (p) => {
    if (p < 0.6) {
      // Linear from initial.y to 0
      return initial.y * (1 - p / 0.6);
    }
    if (tier.featured) {
      const riseP = (p - 0.6) / 0.4;
      return -20 * riseP;
    }
    return 0;
  });

  const scale = useTransform(progress, (p) => {
    if (!tier.featured || p < 0.6) return 1;
    const riseP = (p - 0.6) / 0.4;
    return 1 + 0.05 * riseP;
  });

  return (
    <motion.div
      style={{ x, y, z, rotateX, rotateY, rotateZ, opacity, scale, transformStyle: 'preserve-3d' }}
    >
      <TierCardContent tier={tier} t={t} />
    </motion.div>
  );
}

function StaticTierCard({
  tier,
  t,
}: {
  tier: TierConfig;
  t: ReturnType<typeof useTranslations<'home.pricing'>>;
}) {
  return (
    <div>
      <TierCardContent tier={tier} t={t} />
    </div>
  );
}

function TierCardContent({
  tier,
  t,
}: {
  tier: TierConfig;
  t: ReturnType<typeof useTranslations<'home.pricing'>>;
}) {
  const featureKeys = ['1', '2', '3', '4', '5'] as const;
  const isFeatured = tier.featured;

  return (
    <article
      className={
        isFeatured
          ? 'relative flex flex-col rounded-3xl border border-navy-deep bg-navy-deep p-10 text-white shadow-[0_30px_60px_-20px_rgba(44,62,80,0.25)]'
          : 'relative flex flex-col rounded-3xl border border-line bg-white p-10 text-navy'
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
          isFeatured ? 'mt-2 text-sm text-white/60' : 'mt-2 text-sm text-navy-soft'
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
