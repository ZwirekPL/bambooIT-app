'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';

export function ForgotPasswordForm() {
  const t = useTranslations('auth');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const email = (
      (e.currentTarget.elements.namedItem('email') as HTMLInputElement).value
    ).trim();

    try {
      await api.auth.forgotPassword({ email });
      setSent(true);
    } catch {
      setError(t('errorGeneral'));
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="space-y-4 text-center">
        <div className="flex justify-center">
          <CheckCircle className="h-12 w-12 text-bamboo-deep" />
        </div>
        <h2 className="text-xl font-bold text-navy-deep">{t('forgotSuccessTitle')}</h2>
        <p className="text-sm text-navy-soft">{t('forgotSuccessMessage')}</p>
        <Button asChild variant="sage" size="lg" className="w-full">
          <Link href="/zaloguj">{t('backToLogin')}</Link>
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      {error && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="email">{t('emailLabel')}</Label>
        <Input
          id="email"
          name="email"
          type="email"
          placeholder={t('emailPlaceholder')}
          autoComplete="email"
          required
          className="h-11"
        />
      </div>

      <Button type="submit" variant="sage" size="lg" disabled={loading} className="w-full">
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Ładowanie...
          </>
        ) : (
          t('forgotButton')
        )}
      </Button>

      <p className="text-center text-sm text-navy-soft">
        <Link
          href="/zaloguj"
          className="font-semibold text-sage-600 hover:text-sage-700 hover:underline"
        >
          {t('backToLogin')}
        </Link>
      </p>
    </form>
  );
}
