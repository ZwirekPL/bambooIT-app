'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { Eye, EyeOff, Loader2, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Link } from '@/i18n/navigation';
import { api, ApiError } from '@/lib/api';

export function ResetPasswordForm() {
  const t = useTranslations('auth');
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const form = e.currentTarget;
    const password = (form.elements.namedItem('password') as HTMLInputElement).value;
    const confirmPassword = (form.elements.namedItem('confirmPassword') as HTMLInputElement).value;

    const hasLetter = /[a-zA-Z]/.test(password);
    const hasDigit = /[0-9]/.test(password);

    if (password.length < 12 || !hasLetter || !hasDigit) {
      setError(t('errorPasswordWeak'));
      return;
    }

    if (password !== confirmPassword) {
      setError(t('errorPasswordMismatch'));
      return;
    }

    setLoading(true);

    try {
      await api.auth.resetPassword({ token, password });
      setSuccess(true);
    } catch (err) {
      if (err instanceof ApiError && err.status === 400) {
        setError(t('errorTokenInvalid'));
      } else {
        setError(t('errorGeneral'));
      }
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="space-y-4 text-center">
        <div className="flex justify-center">
          <CheckCircle className="h-12 w-12 text-sage-500" />
        </div>
        <h2 className="text-xl font-bold text-foreground">{t('resetSuccessTitle')}</h2>
        <p className="text-sm text-muted-foreground">{t('resetSuccessMessage')}</p>
        <Button asChild variant="sage" size="lg" className="w-full">
          <Link href="/zaloguj">{t('loginLink')}</Link>
        </Button>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-sm text-destructive">{t('errorTokenInvalid')}</p>
        <Button asChild variant="sage" size="lg" className="w-full">
          <Link href="/zapomnialem-hasla">{t('forgotTitle')}</Link>
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
        <Label htmlFor="password">{t('resetNewPasswordLabel')}</Label>
        <div className="relative">
          <Input
            id="password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            placeholder={t('resetNewPasswordPlaceholder')}
            autoComplete="new-password"
            required
            className="h-11 pr-10"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-1 top-1/2 -translate-y-1/2 h-9 w-9 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            aria-label={showPassword ? 'Ukryj hasło' : 'Pokaż hasło'}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <p className="text-xs text-muted-foreground">{t('errorPasswordWeak')}</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmPassword">{t('resetConfirmPasswordLabel')}</Label>
        <div className="relative">
          <Input
            id="confirmPassword"
            name="confirmPassword"
            type={showConfirm ? 'text' : 'password'}
            placeholder={t('resetConfirmPasswordPlaceholder')}
            autoComplete="new-password"
            required
            className="h-11 pr-10"
          />
          <button
            type="button"
            onClick={() => setShowConfirm((v) => !v)}
            className="absolute right-1 top-1/2 -translate-y-1/2 h-9 w-9 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            aria-label={showConfirm ? 'Ukryj hasło' : 'Pokaż hasło'}
          >
            {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <Button type="submit" variant="sage" size="lg" disabled={loading} className="w-full">
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Ładowanie...
          </>
        ) : (
          t('resetButton')
        )}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
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
