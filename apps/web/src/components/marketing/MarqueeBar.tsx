'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { useTranslations } from 'next-intl';

/**
 * Navy strip with bamboo-dotted marquee items.
 *
 * A5 — infinite horizontal scroll. Items rendered twice and the track
 * animates x: 0% → -50% on a 30s linear loop, so when the first copy
 * scrolls off the left edge the second copy is in identical position
 * (seamless wrap). prefers-reduced-motion skips the animation and the
 * track sits static (still readable, just non-scrolling).
 */
export function MarqueeBar() {
  const t = useTranslations('home.marquee');
  const shouldReduceMotion = useReducedMotion();

  const items = [
    t('remoteHelp'),
    t('monitoring'),
    t('backup'),
    t('rodo'),
    t('m365'),
    t('cybersec'),
  ];
  const doubled = [...items, ...items];

  return (
    <div className="overflow-hidden border-y border-navy-deep bg-navy py-4 text-white">
      <motion.div
        className="flex shrink-0 items-center gap-12 whitespace-nowrap"
        animate={shouldReduceMotion ? undefined : { x: ['0%', '-50%'] }}
        transition={
          shouldReduceMotion
            ? undefined
            : { duration: 30, ease: 'linear', repeat: Infinity }
        }
      >
        {doubled.map((item, idx) => (
          <span
            key={`${item}-${idx}`}
            className="inline-flex shrink-0 items-center gap-12 font-display text-2xl font-light italic tracking-[-0.02em] md:text-3xl lg:text-4xl"
          >
            <span>{item}</span>
            <span
              aria-hidden="true"
              className="inline-block h-2 w-2 shrink-0 rounded-full bg-bamboo"
            />
          </span>
        ))}
      </motion.div>
    </div>
  );
}
