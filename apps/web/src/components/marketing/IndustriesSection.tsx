'use client';

import { useRef } from 'react';
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';

const INDUSTRIES = [
  { id: '1', slug: 'biura-rachunkowe' },
  { id: '2', slug: 'kancelarie' },
  { id: '3', slug: 'gabinety' },
  { id: '4', slug: 'produkcja' },
  { id: '5', slug: 'hotele' },
] as const;

/**
 * A12 — Morphing background. Section bg cycles through 6 bamboo-family
 * hues as the user scrolls through it (matches mockup .morph-1…morph-6
 * keyframe variants). Implemented via Framer Motion useScroll +
 * useTransform on backgroundColor. prefers-reduced-motion falls back to
 * a single bg-bamboo (default) for the entire scroll range.
 */
const MORPH_COLORS = [
  '#a8d56a', // morph-1 — light lime
  '#7eb33f', // morph-2 — saturated bamboo
  '#9ec956', // morph-3 — bright lime
  '#6fa336', // morph-4 — bamboo-deep
  '#b5db7c', // morph-5 — pale lime
  '#88be4a', // morph-6 — true bamboo
];

export function IndustriesSection() {
  const t = useTranslations('home.industries');
  const sectionRef = useRef<HTMLElement>(null);
  const shouldReduceMotion = useReducedMotion();

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start end', 'end start'],
  });

  const backgroundColor = useTransform(
    scrollYProgress,
    [0, 0.2, 0.4, 0.6, 0.8, 1],
    MORPH_COLORS,
  );

  return (
    <motion.section
      ref={sectionRef}
      id="industries"
      style={shouldReduceMotion ? undefined : { backgroundColor }}
      className="relative bg-bamboo px-5 py-24 text-navy-deep md:px-12 md:py-32"
    >
      <div className="mx-auto grid w-full max-w-[1440px] grid-cols-1 items-center gap-16 md:grid-cols-[1fr_1.5fr] md:gap-24">
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
    </motion.section>
  );
}
