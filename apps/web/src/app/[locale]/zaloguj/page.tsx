import type { Metadata } from 'next';
import { useTranslations } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import Image from 'next/image';
import { Link } from '@/i18n/navigation';
import { LoginForm } from '@/components/auth/LoginForm';
import { BRAND } from '@config/brand';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('auth');
  return {
    title: `${t('loginTitle')} — ${BRAND.name}`,
    description: t('loginSubtitle'),
    robots: { index: false, follow: false },
  };
}

export default function LoginPage() {
  const t = useTranslations('auth');

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-gradient-to-br from-cream-50 to-sage-50/40 py-12 px-4">
      <div className="w-full max-w-md">
        {/* Card */}
        <div className="rounded-2xl border border-border bg-white p-5 sm:p-8 shadow-sm">
          <div className="mb-6 flex flex-col sm:flex-row items-center justify-center gap-3">
            {/* Logo */}
            <Link href="/" className="flex-shrink-0">
              <Image
                src="/logo.png"
                alt={BRAND.shortName}
                width={200}
                height={200}
                className="h-14 sm:h-20 w-auto"
                priority
              />
            </Link>

            <div className="text-left">
              <h1 className="text-2xl font-bold text-foreground">{t('loginTitle')}</h1>
              <p className="mt-1 text-sm text-muted-foreground">{t('loginSubtitle')}</p>
            </div>
          </div>
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
