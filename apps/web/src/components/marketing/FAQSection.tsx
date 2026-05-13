'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

const FAQ_IDS = ['1', '2', '3', '4', '5', '6'] as const;

/**
 * FAQ accordion per mockup §faq.
 *
 * Single-open behaviour matches mockup (opening item N closes others).
 * Animation: simple max-height + opacity transition driven by `open` state.
 * A13 in §5a swaps to GSAP scroll-triggered entrance + smoother cubic-bezier
 * in FE-10 — for now the open/close transition itself is intentional.
 */
export function FAQSection() {
  const t = useTranslations('home.faq');
  const [openIdx, setOpenIdx] = useState<number | null>(null);

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

        <ul className="flex flex-col border-y border-line-strong">
          {FAQ_IDS.map((id, idx) => {
            const isOpen = openIdx === idx;
            return (
              <li key={id} className="border-b border-line-strong last:border-b-0">
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => setOpenIdx(isOpen ? null : idx)}
                  className="flex w-full items-center justify-between gap-6 py-7 text-left font-display text-xl font-normal leading-[1.3] tracking-[-0.015em] text-navy md:text-2xl"
                >
                  <span>{t(`items.${id}.q`)}</span>
                  <span
                    aria-hidden="true"
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-lg transition-all duration-300 ${
                      isOpen
                        ? 'rotate-45 border-bamboo bg-bamboo text-navy-deep'
                        : 'border-line-strong text-navy'
                    }`}
                  >
                    +
                  </span>
                </button>
                <div
                  className={`grid overflow-hidden transition-[grid-template-rows] duration-500 ease-out ${
                    isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                  }`}
                >
                  <div className="overflow-hidden">
                    <p className="max-w-[60ch] pb-8 text-base leading-[1.65] text-navy-soft">
                      {t(`items.${id}.a`)}
                    </p>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
