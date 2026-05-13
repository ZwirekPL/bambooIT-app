'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

const FAQ_IDS = ['1', '2', '3', '4'] as const;

/**
 * Pricing-specific FAQ — distinct from the homepage FAQ (which covers
 * contracts, geo, security, etc.). Same accordion UX pattern as
 * <FAQSection />: single-open, plus-icon rotate, grid-rows transition.
 */
export function PricingFAQ() {
  const t = useTranslations('pakiety.faq');
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  return (
    <section className="bg-white px-5 py-20 md:px-12 md:py-28">
      <div className="mx-auto w-full max-w-[1200px]">
        <h2 className="mb-12 font-display text-3xl font-light leading-none tracking-[-0.035em] text-navy md:text-4xl lg:text-5xl">
          {t.rich('heading', {
            em: (chunks) => <em className="font-semibold italic text-bamboo-deep">{chunks}</em>,
          })}
        </h2>

        <ul className="flex flex-col border-y border-line-strong">
          {FAQ_IDS.map((id, idx) => {
            const isOpen = openIdx === idx;
            return (
              <li key={id} className="border-b border-line-strong last:border-b-0">
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => setOpenIdx(isOpen ? null : idx)}
                  className="flex w-full items-center justify-between gap-6 py-6 text-left font-display text-xl font-normal leading-[1.3] tracking-[-0.015em] text-navy md:text-2xl"
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
                    <p className="max-w-[60ch] pb-7 text-base leading-[1.65] text-navy-soft">
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
