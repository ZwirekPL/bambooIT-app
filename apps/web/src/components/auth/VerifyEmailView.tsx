'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';

type Status = 'loading' | 'success' | 'error';

export function VerifyEmailView() {
  const t = useTranslations('auth');
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [status, setStatus] = useState<Status>(token ? 'loading' : 'error');

  useEffect(() => {
    if (!token) return;

    api.auth
      .verifyEmail({ token })
      .then(() => setStatus('success'))
      .catch(() => setStatus('error'));
  }, [token]);

  if (status === 'loading') {
    return (
      <div className="space-y-4 text-center">
        <div className="flex justify-center">
          <Loader2 className="h-12 w-12 animate-spin text-bamboo-deep" />
        </div>
        <p className="text-sm text-navy-soft">{t('verifyEmailLoading')}</p>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="space-y-4 text-center">
        <div className="flex justify-center">
          <CheckCircle className="h-12 w-12 text-bamboo-deep" />
        </div>
        <h2 className="text-xl font-bold text-navy-deep">{t('verifyEmailSuccessTitle')}</h2>
        <p className="text-sm text-navy-soft">{t('verifyEmailSuccessMessage')}</p>
        <Button asChild variant="sage" size="lg" className="w-full">
          <Link href="/zaloguj">{t('loginLink')}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 text-center">
      <div className="flex justify-center">
        <XCircle className="h-12 w-12 text-destructive" />
      </div>
      <h2 className="text-xl font-bold text-navy-deep">{t('verifyEmailErrorTitle')}</h2>
      <p className="text-sm text-navy-soft">{t('verifyEmailErrorMessage')}</p>
      <Button asChild variant="sage" size="lg" className="w-full">
        <Link href="/rejestracja">{t('registerLink')}</Link>
      </Button>
      <p className="text-center text-sm text-navy-soft">
        <Link
          href="/zaloguj"
          className="font-semibold text-sage-600 hover:text-sage-700 hover:underline"
        >
          {t('backToLogin')}
        </Link>
      </p>
    </div>
  );
}
