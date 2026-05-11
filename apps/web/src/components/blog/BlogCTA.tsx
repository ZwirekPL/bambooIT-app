import { getTranslations } from 'next-intl/server';
import { BlogCtaButton } from './BlogCtaButton';

export async function BlogCTA() {
  const t = await getTranslations('blog');

  return (
    <section className="my-16 bg-sage-50 border border-sage-200 rounded-3xl px-6 py-12 text-center">
      <h2 className="text-2xl font-bold text-foreground mb-3">{t('ctaTitle')}</h2>
      <p className="text-muted-foreground mb-6 max-w-xl mx-auto">{t('ctaSubtitle')}</p>
      <BlogCtaButton label={t('ctaButton')} />
    </section>
  );
}
