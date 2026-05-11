import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { BRAND } from '@config/brand';
import { localeAlternates } from '@/lib/seo';
import { Link } from '@/i18n/navigation';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('consultationPage');
  return {
    title: `${t('metaTitle')} — ${BRAND.name}`,
    description: t('metaDescription'),
    alternates: localeAlternates('/konsultacja'),
  };
}

export default async function Page() {
  const t = await getTranslations('consultationPage');

  return (
    <div className="min-h-screen bg-gradient-to-br from-cream-50 to-sage-50/40 py-20 px-4">
      <div className="max-w-2xl mx-auto text-center space-y-8">
        <h1 className="text-4xl font-extrabold tracking-tight">{t('heroTitle')}</h1>
        <p className="text-lg text-muted-foreground max-w-xl mx-auto">{t('heroDescription')}</p>

        <div className="bg-white rounded-xl shadow-sm border p-8 text-left space-y-4">
          <h2 className="text-xl font-bold">{t('whatYouGet')}</h2>
          <ul className="space-y-2 text-muted-foreground">
            <li className="flex gap-2">✓ {t('benefit1')}</li>
            <li className="flex gap-2">✓ {t('benefit2')}</li>
            <li className="flex gap-2">✓ {t('benefit3')}</li>
            <li className="flex gap-2">✓ {t('benefit4')}</li>
          </ul>
          <p className="text-sm text-muted-foreground pt-2">{t('contactInfo')}</p>
        </div>

        <Link
          href="/oferta"
          className="inline-flex items-center justify-center rounded-md bg-brand-green px-8 py-3 text-lg font-semibold text-white hover:bg-brand-green/90 transition-colors"
        >
          {t('ctaButton')}
        </Link>
      </div>
    </div>
  );
}
