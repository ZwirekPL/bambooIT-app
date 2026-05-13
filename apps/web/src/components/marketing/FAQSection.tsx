'use client';

import { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useTranslations } from 'next-intl';

const FAQ_IDS = ['1', '2', '3', '4', '5', '6'] as const;

/**
 * A13 — FAQ section with scroll-triggered entrance stagger + smoother
 * open/close ease. Single-open behaviour matches mockup (opening item N
 * closes others). Each row slides in from x:-30 opacity:0 → x:0 opacity:1
 * with 0.06s stagger the first time the list scrolls into view.
 *
 * Open/close uses CSS grid grid-rows trick (0fr → 1fr) which gives a
 * smooth height transition with no JS measurement. ease-[cubic-bezier]
 * matches mockup .faq-a transition curve.
 *
 * prefers-reduced-motion: entrance stagger collapses to instant; open/
 * close transition duration shortened to 100ms.
 */
const ITEM_VARIANTS = {
  hidden: { opacity: 0, x: -30 },
  visible: { opacity: 1, x: 0 },
};

const REDUCED_VARIANTS = {
  hidden: { opacity: 1, x: 0 },
  visible: { opacity: 1, x: 0 },
};

export function FAQSection() {
  const t = useTranslations('home.faq');
  const shouldReduceMotion = useReducedMotion();
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  const variants = shouldReduceMotion ? REDUCED_VARIANTS : ITEM_VARIANTS;
  const openDuration = shouldReduceMotion ? 100 : 500;

  return (
    <section
      id="faq"
      className="relative bg-paper px-5 py-24 md:px-12 md:py-32 lg:py-40"
    >
      <div className="mx-auto grid w-full max-w-[1440px] grid-cols-1 gap-12 md:grid-cols-[1fr_1.6fr] md:gap-24">
        <div>
          <h2 className="font-display text-4xl font-light leading-none tracking-[-0.035em] text-navy md:sticky md:top-32 md:text-5xl lg:text-6xl xl:text-7xl">
            {t.rich('heading', {
              em: (chunks) => <em className="font-semibold italic text-bamboo-deep">{chunks}</em>,
            })}
          </h2>
        </div>

        <motion.ul
          className="flex flex-col border-y border-line-strong"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          transition={{ staggerChildren: shouldReduceMotion ? 0 : 0.06 }}
        >
          {FAQ_IDS.map((id, idx) => {
            const isOpen = openIdx === idx;
            return (
              <motion.li
                key={id}
                variants={variants}
                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                className="border-b border-line-strong last:border-b-0"
              >
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => setOpenIdx(isOpen ? null : idx)}
                  className="flex w-full items-center justify-between gap-6 py-7 text-left font-display text-xl font-normal leading-[1.3] tracking-[-0.015em] text-navy md:text-2xl"
                >
                  <span>{t(`items.${id}.q`)}</span>
                  <span
                    aria-hidden="true"
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-lg transition-all duration-350 ease-[cubic-bezier(0.7,0,0.2,1)] ${
                      isOpen
                        ? 'rotate-45 border-bamboo bg-bamboo text-navy-deep'
                        : 'border-line-strong text-navy'
                    }`}
                  >
                    +
                  </span>
                </button>
                <div
                  className={`grid overflow-hidden ease-[cubic-bezier(0.7,0,0.2,1)] ${
                    isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                  }`}
                  style={{ transitionProperty: 'grid-template-rows', transitionDuration: `${openDuration}ms` }}
                >
                  <div className="overflow-hidden">
                    <p className="max-w-[60ch] pb-8 text-base leading-[1.65] text-navy-soft">
                      {t(`items.${id}.a`)}
                    </p>
                  </div>
                </div>
              </motion.li>
            );
          })}
        </motion.ul>
      </div>
    </section>
  );
}
