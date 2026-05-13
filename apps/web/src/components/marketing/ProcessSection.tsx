'use client';

import { useRef } from 'react';
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
  useMotionValueEvent,
} from 'framer-motion';
import { useState } from 'react';
import { useTranslations } from 'next-intl';

/**
 * A11 — Process timeline with scroll-driven SVG line draw + per-step
 * active-state toggle + step-number rotate entrance.
 *
 * - The vertical SVG line is absolutely positioned in the left number
 *   column. Its strokeDashoffset animates from 1000 → 0 across the
 *   timeline's scroll progress.
 * - As scroll advances, each step's dot fills bamboo and scales 1.4×
 *   with a soft bamboo glow when the corresponding progress threshold
 *   is crossed (idx / totalSteps).
 * - Each step-number (01–04) plays a one-shot rotate-in entrance the
 *   first time it scrolls into view (back-out ease for spring feel).
 *
 * prefers-reduced-motion: SVG draw collapses to a solid full line,
 * all dots render active immediately, step numbers skip rotation.
 */
const STEP_IDS = ['1', '2', '3', '4'] as const;

export function ProcessSection() {
  const t = useTranslations('home.process');
  const shouldReduceMotion = useReducedMotion();
  const stepsRef = useRef<HTMLOListElement>(null);
  const [activeIdx, setActiveIdx] = useState(shouldReduceMotion ? STEP_IDS.length : 0);

  const { scrollYProgress } = useScroll({
    target: stepsRef,
    offset: ['start 70%', 'end 60%'],
  });

  // Maps scroll progress to strokeDashoffset (1000 → 0)
  const dashOffset = useTransform(scrollYProgress, [0, 1], [1000, 0]);

  // Step activation — flip `activeIdx` as progress crosses thresholds
  useMotionValueEvent(scrollYProgress, 'change', (p) => {
    if (shouldReduceMotion) return;
    const next = Math.floor(p * (STEP_IDS.length + 0.5));
    setActiveIdx(Math.min(STEP_IDS.length, next));
  });

  return (
    <section
      id="process"
      className="relative border-t border-line bg-white px-5 py-24 md:px-12 md:py-32 lg:py-40"
    >
      <div className="mx-auto w-full max-w-[1440px]">
        {/* Intro */}
        <div className="mb-20 grid grid-cols-1 items-end gap-12 md:mb-24 md:grid-cols-2 md:gap-16">
          <div>
            <div className="mb-8 flex items-center gap-3.5 font-mono text-xs uppercase tracking-[0.2em] text-bamboo-deep">
              <span aria-hidden="true" className="h-px w-8 bg-bamboo-deep" />
              {t('intro.label')}
            </div>
            <h2 className="font-display text-4xl font-light leading-none tracking-[-0.035em] text-navy md:text-5xl lg:text-6xl xl:text-7xl">
              {t.rich('intro.heading', {
                em: (chunks) => <em className="font-semibold italic text-bamboo-deep">{chunks}</em>,
              })}
            </h2>
          </div>
          <p className="max-w-[42ch] text-base leading-[1.6] text-navy-soft md:text-lg">
            {t('intro.lede')}
          </p>
        </div>

        {/* Steps timeline */}
        <ol ref={stepsRef} className="relative">
          {/* Vertical line — hidden on mobile (single-col stack) */}
          <svg
            aria-hidden="true"
            className="pointer-events-none absolute left-12 top-0 hidden h-full w-px overflow-visible md:block"
            preserveAspectRatio="none"
          >
            <motion.line
              x1="0"
              y1="0"
              x2="0"
              y2="100%"
              stroke="hsl(var(--green))"
              strokeWidth={2}
              style={{
                strokeDasharray: 1000,
                strokeDashoffset: shouldReduceMotion ? 0 : dashOffset,
              }}
            />
          </svg>

          {STEP_IDS.map((id, idx) => (
            <li
              key={id}
              className={`relative grid grid-cols-1 items-start gap-4 py-10 md:grid-cols-[96px_1fr_1.5fr] md:gap-12 md:py-12 ${
                idx < STEP_IDS.length - 1 ? 'border-b border-line' : ''
              }`}
            >
              {/* Step-dot — absolutely positioned over the SVG line, desktop only */}
              <span
                aria-hidden="true"
                className={`absolute left-[36px] top-[60px] z-10 hidden h-6 w-6 rounded-full border-2 bg-white transition-all duration-500 md:block ${
                  idx < activeIdx
                    ? 'scale-[1.4] border-bamboo bg-bamboo shadow-[0_0_0_8px_rgba(139,195,74,0.2)]'
                    : 'border-line-strong'
                }`}
              />

              <motion.span
                className="font-display text-6xl font-light italic leading-none tracking-[-0.04em] text-bamboo-deep md:text-7xl lg:text-[6rem]"
                initial={
                  shouldReduceMotion
                    ? { rotate: 0, opacity: 1, scale: 1 }
                    : { rotate: -90, opacity: 0, scale: 0.6 }
                }
                whileInView={{ rotate: 0, opacity: 1, scale: 1 }}
                viewport={{ once: true, amount: 0.5 }}
                transition={{ duration: 1, ease: [0.34, 1.56, 0.64, 1] }}
              >
                {String(idx + 1).padStart(2, '0')}
              </motion.span>

              <h3 className="font-display text-2xl font-semibold tracking-[-0.02em] text-navy md:text-3xl">
                {t(`steps.${id}.title`)}
              </h3>
              <p className="text-base leading-[1.6] text-navy-soft">
                {t(`steps.${id}.desc`)}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
