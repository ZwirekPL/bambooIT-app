'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Loader2, CheckCircle2, KeyRound, Mail, Copy, Check, RotateCcw, Play } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api, ApiError } from '@/lib/api';

interface DietitianProfileFormProps {
  profile: {
    code: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
  };
}

export function DietitianProfileForm({ profile }: DietitianProfileFormProps) {
  const t = useTranslations('dietitian.profile');
  const { data: session } = useSession();
  const router = useRouter();

  // Profile form
  const [form, setForm] = useState({
    firstName: profile.firstName ?? '',
    lastName: profile.lastName ?? '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Code copy
  const [codeCopied, setCodeCopied] = useState(false);

  // Change password
  const [pwForm, setPwForm] = useState({ oldPassword: '', newPassword: '', confirmPassword: '' });
  const [pwLoading, setPwLoading] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSuccess, setPwSuccess] = useState(false);

  // Change email
  const [emailForm, setEmailForm] = useState({ newEmail: '', password: '' });
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailSuccess, setEmailSuccess] = useState(false);

  async function handleCopyCode() {
    await navigator.clipboard.writeText(profile.code);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    const token = '';
    if (!token) return;

    const payload: Record<string, string> = {};
    if (form.firstName.trim()) payload.firstName = form.firstName.trim();
    if (form.lastName.trim()) payload.lastName = form.lastName.trim();

    if (Object.keys(payload).length === 0) return;

    setLoading(true);
    try {
      await api.profile.updateDietitian(payload, token);
      setSuccess(true);
      router.refresh();
    } catch {
      setError(t('errorGeneral'));
    } finally {
      setLoading(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwError(null);
    setPwSuccess(false);

    if (pwForm.newPassword !== pwForm.confirmPassword) {
      setPwError(t('passwordMismatch'));
      return;
    }
    if (pwForm.newPassword.length < 12) {
      setPwError(t('passwordTooShort'));
      return;
    }
    if (!/[a-zA-Z]/.test(pwForm.newPassword)) {
      setPwError(t('passwordNoLetter'));
      return;
    }
    if (!/[0-9]/.test(pwForm.newPassword)) {
      setPwError(t('passwordNoDigit'));
      return;
    }

    const token = '';
    if (!token) return;

    setPwLoading(true);
    try {
      await api.profile.changePassword(
        { oldPassword: pwForm.oldPassword, newPassword: pwForm.newPassword },
        token,
      );
      setPwSuccess(true);
      setPwForm({ oldPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      if (err instanceof ApiError && err.message.includes('Old password')) {
        setPwError(t('wrongOldPassword'));
      } else {
        setPwError(t('errorGeneral'));
      }
    } finally {
      setPwLoading(false);
    }
  }

  async function handleChangeEmail(e: React.FormEvent) {
    e.preventDefault();
    setEmailError(null);
    setEmailSuccess(false);

    if (!emailForm.newEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailForm.newEmail)) {
      setEmailError(t('emailInvalid'));
      return;
    }

    const token = '';
    if (!token) return;

    setEmailLoading(true);
    try {
      await api.profile.changeEmail(
        { newEmail: emailForm.newEmail.trim(), password: emailForm.password },
        token,
      );
      setEmailSuccess(true);
      setEmailForm({ newEmail: '', password: '' });
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.message.includes('same as current')) {
          setEmailError(t('emailSameAsCurrent'));
        } else if (err.message.includes('already registered')) {
          setEmailError(t('emailTaken'));
        } else if (err.message.includes('incorrect')) {
          setEmailError(t('emailWrongPassword'));
        } else {
          setEmailError(t('errorGeneral'));
        }
      } else {
        setEmailError(t('errorGeneral'));
      }
    } finally {
      setEmailLoading(false);
    }
  }

  return (
    <div className="space-y-6 touch-manipulation">
      {/* Dietitian code (read-only) */}
      <div className="space-y-2" data-tour="dt-profile-code">
        <Label className="text-base font-semibold">{t('codeLabel')}</Label>
        <p className="text-sm text-muted-foreground">{t('codeDescription')}</p>
        <div className="flex items-center gap-2">
          <div className="flex-1 rounded-lg border border-border bg-muted/30 px-4 py-3 font-mono text-lg tracking-widest select-all">
            {profile.code}
          </div>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={handleCopyCode}
            className="h-12 w-12 shrink-0"
          >
            {codeCopied ? (
              <Check className="h-4 w-4 text-sage-600" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </Button>
        </div>
        {codeCopied && (
          <p className="text-xs text-sage-600">{t('codeCopied')}</p>
        )}
        {/* QR Code */}
        <div className="flex flex-col items-center gap-2 pt-2">
          <QRCodeSVG
            value={`${typeof window !== 'undefined' ? window.location.origin : ''}/pl/rejestracja?code=${profile.code}`}
            size={160}
            level="M"
            includeMargin
            className="rounded-lg border p-1"
          />
          <p className="text-xs text-muted-foreground">{t('qrCodeHint') ?? 'Pacjent skanuje QR → otwiera rejestrację z Twoim kodem'}</p>
        </div>
      </div>

      {/* Email (read-only display) */}
      <div className="space-y-2">
        <Label>{t('emailLabel')}</Label>
        <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          {profile.email}
        </div>
      </div>

      {/* Name form */}
      <form onSubmit={handleSubmit} className="space-y-5" noValidate data-tour="dt-profile-form">
        {error && (
          <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}
        {success && (
          <div className="flex items-center gap-2 rounded-lg bg-sage-50 border border-sage-200 px-4 py-3 text-sm text-sage-800">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            {t('successMessage')}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="firstName">{t('firstName')}</Label>
            <Input
              id="firstName"
              name="firstName"
              type="text"
              value={form.firstName}
              onChange={(e) => { setForm((p) => ({ ...p, firstName: e.target.value })); setSuccess(false); setError(null); }}
              placeholder={t('firstNamePlaceholder')}
              autoComplete="given-name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lastName">{t('lastName')}</Label>
            <Input
              id="lastName"
              name="lastName"
              type="text"
              value={form.lastName}
              onChange={(e) => { setForm((p) => ({ ...p, lastName: e.target.value })); setSuccess(false); setError(null); }}
              placeholder={t('lastNamePlaceholder')}
              autoComplete="family-name"
            />
          </div>
        </div>

        <Button type="submit" variant="sage" size="lg" disabled={loading} className="w-full sm:w-auto min-h-[48px]">
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {t('saving')}
            </>
          ) : (
            t('save')
          )}
        </Button>
      </form>

      {/* Change password section */}
      <div className="border-t border-border pt-5 space-y-3" data-tour="dt-profile-password">
        <div className="flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-muted-foreground" />
          <Label className="text-base font-semibold">{t('changePasswordSection')}</Label>
        </div>
        <p className="text-sm text-muted-foreground">{t('changePasswordDescription')}</p>

        {pwError && (
          <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
            {pwError}
          </div>
        )}
        {pwSuccess && (
          <div className="flex items-center gap-2 rounded-lg bg-sage-50 border border-sage-200 px-4 py-3 text-sm text-sage-800">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            {t('passwordChanged')}
          </div>
        )}

        <form onSubmit={handleChangePassword} className="space-y-3" noValidate>
          <div className="space-y-2">
            <Label htmlFor="oldPassword">{t('oldPassword')}</Label>
            <Input
              id="oldPassword"
              type="password"
              value={pwForm.oldPassword}
              onChange={(e) => { setPwForm((p) => ({ ...p, oldPassword: e.target.value })); setPwError(null); setPwSuccess(false); }}
              placeholder={t('oldPasswordPlaceholder')}
              autoComplete="current-password"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="newPassword">{t('newPassword')}</Label>
              <Input
                id="newPassword"
                type="password"
                value={pwForm.newPassword}
                onChange={(e) => { setPwForm((p) => ({ ...p, newPassword: e.target.value })); setPwError(null); setPwSuccess(false); }}
                placeholder={t('newPasswordPlaceholder')}
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">{t('confirmPassword')}</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={pwForm.confirmPassword}
                onChange={(e) => { setPwForm((p) => ({ ...p, confirmPassword: e.target.value })); setPwError(null); setPwSuccess(false); }}
                placeholder={t('confirmPasswordPlaceholder')}
                autoComplete="new-password"
              />
            </div>
          </div>
          <Button
            type="submit"
            variant="sage"
            disabled={pwLoading || !pwForm.oldPassword || !pwForm.newPassword || !pwForm.confirmPassword}
            className="min-h-[48px]"
          >
            {pwLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {t('changingPassword')}
              </>
            ) : (
              t('changePasswordButton')
            )}
          </Button>
        </form>
      </div>

      {/* Change email section */}
      <div className="border-t border-border pt-5 space-y-3" data-tour="dt-profile-email">
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4 text-muted-foreground" />
          <Label className="text-base font-semibold">{t('changeEmailSection')}</Label>
        </div>
        <p className="text-sm text-muted-foreground">{t('changeEmailDescription')}</p>

        {emailError && (
          <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
            {emailError}
          </div>
        )}
        {emailSuccess && (
          <div className="flex items-center gap-2 rounded-lg bg-sage-50 border border-sage-200 px-4 py-3 text-sm text-sage-800">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            {t('emailChanged')}
          </div>
        )}

        <form onSubmit={handleChangeEmail} className="space-y-3" noValidate>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="newEmail">{t('newEmail')}</Label>
              <Input
                id="newEmail"
                type="email"
                value={emailForm.newEmail}
                onChange={(e) => { setEmailForm((p) => ({ ...p, newEmail: e.target.value })); setEmailError(null); setEmailSuccess(false); }}
                placeholder={t('newEmailPlaceholder')}
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="emailPassword">{t('emailPassword')}</Label>
              <Input
                id="emailPassword"
                type="password"
                value={emailForm.password}
                onChange={(e) => { setEmailForm((p) => ({ ...p, password: e.target.value })); setEmailError(null); setEmailSuccess(false); }}
                placeholder={t('emailPasswordPlaceholder')}
                autoComplete="current-password"
              />
            </div>
          </div>
          <Button
            type="submit"
            variant="sage"
            disabled={emailLoading || !emailForm.newEmail || !emailForm.password}
            className="min-h-[48px]"
          >
            {emailLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {t('changingEmail')}
              </>
            ) : (
              t('changeEmailButton')
            )}
          </Button>
        </form>
      </div>

      {/* Restart tour */}
      <div className="border-t border-border pt-5 space-y-3">
        <div className="flex items-center gap-2">
          <RotateCcw className="h-4 w-4 text-muted-foreground" />
          <Label className="text-base font-semibold">{t('restartTourSection') ?? 'Tour aplikacji'}</Label>
        </div>
        <p className="text-sm text-muted-foreground">
          {t('restartTourDescription') ?? 'Uruchom ponownie interaktywny tour po wszystkich funkcjach panelu dietetyka.'}
        </p>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            className="gap-2"
            onClick={() => {
              localStorage.setItem('tour_dietitian_active', '1');
              localStorage.setItem('tour_dietitian_step', '0');
              localStorage.removeItem('tour_dietitian_completed');
              window.location.href = window.location.pathname.replace(/\/profil$/, '');
            }}
          >
            <RotateCcw className="h-4 w-4" />
            {t('restartTourButton') ?? 'Uruchom od początku'}
          </Button>
        </div>
      </div>
    </div>
  );
}
