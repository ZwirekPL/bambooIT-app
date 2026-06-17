import { Suspense } from 'react';
import type { Metadata } from 'next';
import { useTranslations } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { Loader2 } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { VerifyEmailView } from '@/components/auth/VerifyEmailView';
import { BrandMark } from '@/components/brand/BrandMark';
import { BRAND } from '@config/brand';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('auth');
  return {
    title: `${t('verifyEmailTitle')} — ${BRAND.name}`,
    description: t('verifyEmailSubtitle'),
    robots: { index: false, follow: false },
  };
}

export default function VerifyEmailPage() {
  const t = useTranslations('auth');

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-gradient-to-br from-cream-50 to-sage-50/40 py-12 px-4">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-border bg-white p-5 sm:p-8 shadow-sm">
          <div className="mb-6 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/" className="flex-shrink-0">
              <BrandMark className="text-4xl sm:text-5xl text-navy-deep" />
            </Link>
            <div className="text-left">
              <h1 className="text-2xl font-bold text-foreground">{t('verifyEmailTitle')}</h1>
              <p className="mt-1 text-sm text-muted-foreground">{t('verifyEmailSubtitle')}</p>
            </div>
          </div>
          <Suspense
            fallback={
              <div className="flex justify-center py-4">
                <Loader2 className="h-8 w-8 animate-spin text-sage-500" />
              </div>
            }
          >
            <VerifyEmailView />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
