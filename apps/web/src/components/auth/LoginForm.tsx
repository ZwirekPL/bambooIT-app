'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { signIn, getSession } from 'next-auth/react';
import { useTranslations, useLocale } from 'next-intl';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { useDeviceFingerprint } from '@/hooks/useDeviceFingerprint';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';

export function LoginForm() {
  const t = useTranslations('auth');
  const locale = useLocale();
  const deviceFingerprint = useDeviceFingerprint();
  const searchParams = useSearchParams();
  const reason = searchParams?.get('reason');

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailNotVerified, setEmailNotVerified] = useState(false);
  const [resendEmail, setResendEmail] = useState('');
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setEmailNotVerified(false);
    setResendSuccess(false);

    const form = e.currentTarget;
    const email = (form.elements.namedItem('email') as HTMLInputElement).value;
    const password = (form.elements.namedItem('password') as HTMLInputElement).value;

    const result = await signIn('credentials', {
      email,
      password,
      deviceFingerprint: deviceFingerprint ?? undefined,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      if (result.code === 'session_already_active') {
        setError(t('sessionAlreadyActive'));
      } else if (result.code === 'email_not_verified') {
        setEmailNotVerified(true);
        setResendEmail(email);
        setError(t('emailNotVerified'));
      } else {
        setError(t('errorInvalid'));
      }
      return;
    }

    // Stamp idle activity immediately so middleware allows the very first
    // navigation after login (otherwise authorized() would redirect to login).
    const now = Date.now();
    try {
      localStorage.setItem('idle:lastActivity', String(now));
    } catch { /* ignore */ }
    const secure = window.location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `idle_last_activity=${now}; Path=/; SameSite=Lax; Max-Age=300${secure}`;

    const session = await getSession();

    const role = (session?.user as { role?: string } | undefined)?.role;
    if (role === 'ADMIN') {
      window.location.href = `/${locale}/admin`;
    } else {
      window.location.href = `/${locale}/dashboard`;
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      {/* Notice from previous session (e.g. logged out because someone signed in elsewhere) */}
      {!error && reason === 'superseded' && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-900">
          {t('sessionSupersededNotice')}
        </div>
      )}
      {!error && reason === 'idle' && (
        <div className="rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-900">
          {t('idleLogoutNotice')}
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
          {error}
          {emailNotVerified && !resendSuccess && (
            <div className="mt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={resendLoading}
                onClick={async () => {
                  setResendLoading(true);
                  try {
                    await api.auth.resendVerification({ email: resendEmail });
                    setResendSuccess(true);
                  } catch {
                    // Rate limit or other error — still show success (anti-enumeration)
                    setResendSuccess(true);
                  } finally {
                    setResendLoading(false);
                  }
                }}
              >
                {resendLoading ? (
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                ) : null}
                {t('resendVerification')}
              </Button>
            </div>
          )}
          {resendSuccess && (
            <div className="mt-2 text-green-700 dark:text-green-400 font-medium">
              {t('resendVerificationSuccess')}
            </div>
          )}
        </div>
      )}

      {/* Email */}
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

      {/* Password */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">{t('passwordLabel')}</Label>
          <Link
            href="/zapomnialem-hasla"
            className="text-xs text-sage-600 hover:text-sage-700 hover:underline"
          >
            {t('forgotPassword')}
          </Link>
        </div>
        <div className="relative">
          <Input
            id="password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            placeholder={t('passwordPlaceholder')}
            autoComplete="current-password"
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
      </div>

      {/* Submit */}
      <Button
        type="submit"
        variant="sage"
        size="lg"
        disabled={loading}
        className="w-full"
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Ładowanie...
          </>
        ) : (
          t('submitButton')
        )}
      </Button>

      {/* Register link */}
      <p className="text-center text-sm text-muted-foreground">
        {t('noAccount')}{' '}
        <Link
          href="/rejestracja"
          className="font-semibold text-sage-600 hover:text-sage-700 hover:underline"
        >
          {t('registerLink')}
        </Link>
      </p>
    </form>
  );
}
