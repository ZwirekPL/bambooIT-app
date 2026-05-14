'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Eye, EyeOff, Loader2, CheckCircle } from 'lucide-react';
import { useDeviceFingerprint } from '@/hooks/useDeviceFingerprint';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Link } from '@/i18n/navigation';
import { api, ApiError } from '@/lib/api';
import { isValidNIP } from '@/lib/validators/nip';

/**
 * Same callbackUrl sanitizer as LoginForm — accept only same-origin paths.
 */
function safeCallback(raw: string | null): string | null {
  if (!raw) return null;
  if (raw.startsWith('//') || /^[a-z][a-z0-9+.-]*:/i.test(raw)) return null;
  if (!raw.startsWith('/')) return null;
  return raw;
}

const INDUSTRY_OPTIONS = [
  'accounting',
  'law',
  'medical',
  'production',
  'hospitality',
  'other',
] as const;
type IndustryValue = (typeof INDUSTRY_OPTIONS)[number];

interface RegisterFormProps {
  initialReferralCode?: string;
}

export function RegisterForm({ initialReferralCode }: RegisterFormProps) {
  const t = useTranslations('auth');
  const deviceFingerprint = useDeviceFingerprint();
  const searchParams = useSearchParams();
  const callbackUrl = safeCallback(searchParams?.get('callbackUrl') ?? null);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successEmail, setSuccessEmail] = useState<string | null>(null);
  const [consentHealth, setConsentHealth] = useState(false);
  const [consentAi, setConsentAi] = useState(false);
  const [consentEmail, setConsentEmail] = useState(false);
  const [showConsentErrors, setShowConsentErrors] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const form = e.currentTarget;
    const firstName = (form.elements.namedItem('firstName') as HTMLInputElement).value.trim();
    const lastName = (form.elements.namedItem('lastName') as HTMLInputElement).value.trim();
    const email = (form.elements.namedItem('email') as HTMLInputElement).value.trim();
    const password = (form.elements.namedItem('password') as HTMLInputElement).value;
    const confirmPassword = (form.elements.namedItem('confirmPassword') as HTMLInputElement).value;
    const companyName = (form.elements.namedItem('companyName') as HTMLInputElement).value.trim();
    const nipRaw = (form.elements.namedItem('nip') as HTMLInputElement).value.trim();
    const industry = (form.elements.namedItem('industry') as HTMLSelectElement).value as IndustryValue;
    const phone = (form.elements.namedItem('phone') as HTMLInputElement).value.trim();
    const employeesCountRaw = (form.elements.namedItem('employeesCount') as HTMLInputElement).value.trim();
    const website = (form.elements.namedItem('website') as HTMLInputElement).value.trim() || undefined;
    const referralCode = (form.elements.namedItem('referralCode') as HTMLInputElement).value.trim() || undefined;

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

    if (!isValidNIP(nipRaw)) {
      setError(t('errorNipInvalid'));
      return;
    }

    if (!INDUSTRY_OPTIONS.includes(industry)) {
      setError(t('errorIndustryRequired'));
      return;
    }

    const employeesCount = employeesCountRaw ? Number(employeesCountRaw) : undefined;
    if (employeesCount !== undefined && (!Number.isFinite(employeesCount) || employeesCount < 1)) {
      setError(t('errorEmployeesCountInvalid'));
      return;
    }

    if (!consentHealth || !consentAi) {
      setShowConsentErrors(true);
      setError(t('errorConsentsRequired'));
      return;
    }

    setShowConsentErrors(false);

    setLoading(true);

    try {
      await api.auth.register({
        email,
        password,
        firstName,
        lastName,
        companyName,
        nip: nipRaw.replace(/[\s-]/g, ''),
        industry,
        phone,
        employeesCount,
        website,
        referralCode,
        consents: {
          healthDataProcessing: consentHealth,
          aiDisclaimer: consentAi,
          emailNotifications: consentEmail,
        },
        deviceFingerprint: deviceFingerprint ?? undefined,
      });
      setSuccessEmail(email);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError(err.code === 'NIP_TAKEN' ? t('errorNipTaken') : t('errorEmailTaken'));
      } else if (err instanceof ApiError && err.status === 400) {
        setError(t('errorValidation'));
      } else {
        setError(t('errorGeneral'));
      }
    } finally {
      setLoading(false);
    }
  }

  if (successEmail) {
    return (
      <div className="space-y-4 text-center">
        <div className="flex justify-center">
          <CheckCircle className="h-12 w-12 text-bamboo-deep" />
        </div>
        <h2 className="font-display text-2xl font-semibold tracking-[-0.02em] text-navy-deep">
          {t('registerSuccessTitle')}
        </h2>
        <p className="text-sm text-navy-soft">
          {t('registerSuccessMessage', { email: successEmail })}
        </p>
        {/* Preserve callbackUrl so verify-email → login → original
            checkout target chain keeps working. */}
        <Link
          href={
            callbackUrl
              ? { pathname: '/zaloguj', query: { callbackUrl } }
              : '/zaloguj'
          }
          className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-navy-deep px-7 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-bamboo hover:text-navy-deep"
        >
          {t('loginLink')}
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      {error && (
        <div
          role="alert"
          className="rounded-2xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      {/* Name row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="firstName">{t('firstNameLabel')}</Label>
          <Input
            id="firstName"
            name="firstName"
            type="text"
            placeholder={t('firstNamePlaceholder')}
            autoComplete="given-name"
            required
            className="h-11"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="lastName">{t('lastNameLabel')}</Label>
          <Input
            id="lastName"
            name="lastName"
            type="text"
            placeholder={t('lastNamePlaceholder')}
            autoComplete="family-name"
            required
            className="h-11"
          />
        </div>
      </div>

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

      {/* Phone */}
      <div className="space-y-2">
        <Label htmlFor="phone">{t('phoneLabel')}</Label>
        <Input
          id="phone"
          name="phone"
          type="tel"
          placeholder={t('phonePlaceholder')}
          autoComplete="tel"
          required
          minLength={6}
          maxLength={30}
          className="h-11"
        />
      </div>

      {/* Company section divider */}
      <div className="pt-2">
        <p className="text-xs font-medium text-navy-soft uppercase tracking-wide mb-3">
          {t('companySectionTitle')}
        </p>
      </div>

      {/* Company name + NIP */}
      <div className="grid grid-cols-1 sm:grid-cols-[1.4fr_1fr] gap-3">
        <div className="space-y-2">
          <Label htmlFor="companyName">{t('companyNameLabel')}</Label>
          <Input
            id="companyName"
            name="companyName"
            type="text"
            placeholder={t('companyNamePlaceholder')}
            autoComplete="organization"
            required
            className="h-11"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="nip">{t('nipLabel')}</Label>
          <Input
            id="nip"
            name="nip"
            type="text"
            placeholder={t('nipPlaceholder')}
            autoComplete="off"
            required
            inputMode="numeric"
            className="h-11"
          />
        </div>
      </div>

      {/* Industry + employees count */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="industry">{t('industryLabel')}</Label>
          <select
            id="industry"
            name="industry"
            required
            defaultValue=""
            className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="" disabled hidden>
              {t('industryPlaceholder')}
            </option>
            {INDUSTRY_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {t(`industryOptions.${value}`)}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="employeesCount">
            {t('employeesCountLabel')}
            <span className="ml-1 text-xs text-navy-soft">({t('optional')})</span>
          </Label>
          <Input
            id="employeesCount"
            name="employeesCount"
            type="number"
            min={1}
            max={10000}
            placeholder={t('employeesCountPlaceholder')}
            autoComplete="off"
            className="h-11"
          />
        </div>
      </div>

      {/* Website */}
      <div className="space-y-2">
        <Label htmlFor="website">
          {t('websiteLabel')}
          <span className="ml-1 text-xs text-navy-soft">({t('optional')})</span>
        </Label>
        <Input
          id="website"
          name="website"
          type="url"
          placeholder={t('websitePlaceholder')}
          autoComplete="url"
          maxLength={200}
          className="h-11"
        />
      </div>

      {/* Password */}
      <div className="space-y-2">
        <Label htmlFor="password">{t('passwordLabel')}</Label>
        <div className="relative">
          <Input
            id="password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            placeholder={t('passwordPlaceholder')}
            autoComplete="new-password"
            required
            className="h-11 pr-10"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-1 top-1/2 -translate-y-1/2 h-9 w-9 flex items-center justify-center text-navy-soft hover:text-navy-deep transition-colors"
            aria-label={showPassword ? 'Ukryj hasło' : 'Pokaż hasło'}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <p className="text-xs text-navy-soft">{t('passwordHint')}</p>
      </div>

      {/* Confirm Password */}
      <div className="space-y-2">
        <Label htmlFor="confirmPassword">{t('confirmPasswordLabel')}</Label>
        <div className="relative">
          <Input
            id="confirmPassword"
            name="confirmPassword"
            type={showConfirm ? 'text' : 'password'}
            placeholder={t('confirmPasswordPlaceholder')}
            autoComplete="new-password"
            required
            className="h-11 pr-10"
          />
          <button
            type="button"
            onClick={() => setShowConfirm((v) => !v)}
            className="absolute right-1 top-1/2 -translate-y-1/2 h-9 w-9 flex items-center justify-center text-navy-soft hover:text-navy-deep transition-colors"
            aria-label={showConfirm ? 'Ukryj hasło' : 'Pokaż hasło'}
          >
            {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Referral code */}
      <div className="space-y-2">
        <Label htmlFor="referralCode">{t('referralCodeLabel')}</Label>
        <Input
          id="referralCode"
          name="referralCode"
          type="text"
          placeholder={t('referralCodePlaceholder')}
          autoComplete="off"
          className="h-11 uppercase"
          maxLength={20}
          defaultValue={initialReferralCode}
        />
        <p className="text-xs text-navy-soft">{t('referralCodeHint')}</p>
      </div>

      {/* Consents */}
      <div className="space-y-3 rounded-2xl border border-line bg-paper p-4">
        <p className="text-xs font-medium text-navy-soft uppercase tracking-wide">{t('consentsTitle')}</p>

        <label className={`flex items-start gap-3 cursor-pointer rounded-md p-2 -m-2 transition-colors ${showConsentErrors && !consentHealth ? 'bg-red-50 ring-1 ring-red-300' : ''}`}>
          <input
            type="checkbox"
            checked={consentHealth}
            onChange={(e) => setConsentHealth(e.target.checked)}
            className={`mt-0.5 h-4 w-4 rounded shrink-0 ${showConsentErrors && !consentHealth ? 'border-red-400 accent-red-500' : 'border-input accent-bamboo-deep'}`}
          />
          <span className={`text-sm leading-snug ${showConsentErrors && !consentHealth ? 'text-red-700' : 'text-navy-deep'}`}>
            {t('consentHealthData')} <span className="text-red-600">*</span>
          </span>
        </label>

        <label className={`flex items-start gap-3 cursor-pointer rounded-md p-2 -m-2 transition-colors ${showConsentErrors && !consentAi ? 'bg-red-50 ring-1 ring-red-300' : ''}`}>
          <input
            type="checkbox"
            checked={consentAi}
            onChange={(e) => setConsentAi(e.target.checked)}
            className={`mt-0.5 h-4 w-4 rounded shrink-0 ${showConsentErrors && !consentAi ? 'border-red-400 accent-red-500' : 'border-input accent-bamboo-deep'}`}
          />
          <span className={`text-sm leading-snug ${showConsentErrors && !consentAi ? 'text-red-700' : 'text-navy-deep'}`}>
            {t('consentAiDisclaimer')} <span className="text-red-600">*</span>
          </span>
        </label>

        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={consentEmail}
            onChange={(e) => setConsentEmail(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-input accent-bamboo-deep shrink-0"
          />
          <span className="text-sm text-navy-soft leading-snug">
            {t('consentEmailNotifications')}
          </span>
        </label>

        <p className="text-xs text-navy-soft">
          {t.rich('consentsLinks', {
            privacy: (chunks) => (
              <Link href="/dokumenty-prawne" className="underline hover:text-navy-deep">{chunks}</Link>
            ),
            terms: (chunks) => (
              <Link href="/dokumenty-prawne" className="underline hover:text-navy-deep">{chunks}</Link>
            ),
          })}
        </p>
        <p className="text-xs text-navy-soft">
          <span className="text-red-600">*</span> {t('consentsRequiredNote')}
        </p>
      </div>

      {/* GDPR Art. 13 Information Clause */}
      <details className="text-xs text-navy-soft">
        <summary className="cursor-pointer hover:text-navy-deep transition-colors">
          {t('gdprInfoClause')}
        </summary>
        <div className="mt-2 space-y-1 pl-2 border-l-2 border-border/50">
          <p>{t('gdprInfoText')}</p>
        </div>
      </details>

      {/* Submit */}
      <button
        type="submit"
        disabled={loading}
        className="inline-flex w-full items-center justify-center gap-3 rounded-full bg-navy-deep px-8 py-3.5 text-base font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-bamboo hover:text-navy-deep disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:bg-navy-deep disabled:hover:text-white"
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        {loading ? 'Ładowanie...' : t('registerButton')}
      </button>

      {/* Login link — preserve callbackUrl on login redirect */}
      <p className="text-center text-sm text-navy-soft">
        {t('hasAccount')}{' '}
        <Link
          href={
            callbackUrl
              ? { pathname: '/zaloguj', query: { callbackUrl } }
              : '/zaloguj'
          }
          className="font-semibold text-bamboo-deep underline-offset-4 hover:underline"
        >
          {t('loginLink')}
        </Link>
      </p>
    </form>
  );
}
