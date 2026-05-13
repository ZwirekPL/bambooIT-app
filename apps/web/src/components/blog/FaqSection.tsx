import { getTranslations } from 'next-intl/server';
import type { BlogFaqItem } from '@/types/blog';

interface FaqSectionProps {
  faq: BlogFaqItem[];
}

export async function FaqSection({ faq }: FaqSectionProps) {
  const t = await getTranslations('blog');

  return (
    <section className="mt-12 border-t border-line pt-10">
      <h2 className="mb-6 font-display text-2xl font-semibold tracking-[-0.02em] text-navy md:text-3xl">
        {t('faqTitle')}
      </h2>
      <div className="space-y-4">
        {faq.map((item, idx) => (
          <div key={idx} className="rounded-2xl border border-line bg-paper px-6 py-5">
            <h3 className="mb-2 font-display text-lg font-semibold text-navy">
              {item.question}
            </h3>
            <p className="text-sm leading-relaxed text-navy-soft md:text-base">
              {item.answer}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
