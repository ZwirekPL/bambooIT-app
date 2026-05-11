import { getTranslations } from 'next-intl/server';
import type { BlogFaqItem } from '@/types/blog';

interface FaqSectionProps {
  faq: BlogFaqItem[];
}

export async function FaqSection({ faq }: FaqSectionProps) {
  const t = await getTranslations('blog');

  return (
    <section className="mt-12 border-t border-border pt-10">
      <h2 className="text-2xl font-bold text-foreground mb-6">{t('faqTitle')}</h2>
      <div className="space-y-5">
        {faq.map((item, idx) => (
          <div key={idx} className="rounded-xl border border-border bg-muted/30 px-5 py-4">
            <h3 className="font-semibold text-foreground mb-2">{item.question}</h3>
            <p className="text-muted-foreground text-sm leading-relaxed">{item.answer}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
