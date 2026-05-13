import { getTranslations } from 'next-intl/server';
import { BlogCtaButton } from './BlogCtaButton';

export async function BlogCTA() {
  const t = await getTranslations('blog');

  return (
    <section className="my-16 rounded-3xl bg-navy-deep px-8 py-14 text-center text-white md:px-12">
      <h2 className="mx-auto max-w-[24ch] font-display text-3xl font-light leading-[1.05] tracking-[-0.03em] text-white md:text-4xl lg:text-5xl">
        {t('ctaTitle')}
      </h2>
      <p className="mx-auto mt-5 max-w-xl text-base leading-[1.6] text-white/70 md:text-lg">
        {t('ctaSubtitle')}
      </p>
      <div className="mt-8">
        <BlogCtaButton label={t('ctaButton')} />
      </div>
    </section>
  );
}
