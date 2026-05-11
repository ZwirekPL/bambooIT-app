'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Loader2, CheckCircle2, Link2, Unlink, KeyRound, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { api, ApiError } from '@/lib/api';
import type { Patient } from '@/types/api';

interface ProfileFormProps {
  patient: Patient;
}

const SELECT_CLASS =
  'flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-base md:text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';

export function ProfileForm({ patient }: ProfileFormProps) {
  const t = useTranslations('dashboard.profile');
  const { data: session } = useSession();
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Dietitian code linking
  const [dietitianCode, setDietitianCode] = useState('');
  const [dietitianLoading, setDietitianLoading] = useState(false);
  const [dietitianError, setDietitianError] = useState<string | null>(null);
  const [dietitianSuccess, setDietitianSuccess] = useState<string | null>(null);

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

  const [form, setForm] = useState({
    firstName: patient.firstName ?? '',
    lastName: patient.lastName ?? '',
    sex: patient.sex ?? '',
    birthYear: patient.birthYear?.toString() ?? '',
    heightCm: patient.heightCm?.toString() ?? '',
  });

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setSuccess(false);
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    const token = '';

    const payload: Record<string, unknown> = {};
    if (form.firstName.trim()) payload.firstName = form.firstName.trim();
    if (form.lastName.trim()) payload.lastName = form.lastName.trim();
    if (form.sex) payload.sex = form.sex;
    if (form.birthYear) payload.birthYear = parseInt(form.birthYear, 10);
    if (form.heightCm) payload.heightCm = parseInt(form.heightCm, 10);

    if (Object.keys(payload).length === 0) return;

    setLoading(true);
    try {
      await api.profile.update(payload, token);
      setSuccess(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(t('errorGeneral'));
      } else {
        setError(t('errorGeneral'));
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setLoading(false);
    }
  }

  async function handleLinkDietitian() {
    if (!dietitianCode.trim()) return;
    const token = '';

    setDietitianError(null);
    setDietitianSuccess(null);
    setDietitianLoading(true);
    try {
      await api.profile.update({ dietitianCode: dietitianCode.trim() }, token);
      setDietitianCode('');
      setDietitianSuccess(t('dietitianLinked'));
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) {
        setDietitianError(t('dietitianInvalidCode'));
      } else {
        setDietitianError(t('errorGeneral'));
      }
    } finally {
      setDietitianLoading(false);
    }
  }

  async function handleUnlinkDietitian() {
    const token = '';

    setDietitianError(null);
    setDietitianSuccess(null);
    setDietitianLoading(true);
    try {
      await api.profile.update({ unlinkDietitian: true }, token);
      setDietitianSuccess(t('dietitianUnlinked'));
      router.refresh();
    } catch {
      setDietitianError(t('errorGeneral'));
    } finally {
      setDietitianLoading(false);
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
    <form onSubmit={handleSubmit} className="space-y-5 touch-manipulation" noValidate>
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

      {/* Name row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        <div className="space-y-2">
          <Label htmlFor="firstName">{t('firstName')}</Label>
          <Input
            id="firstName"
            name="firstName"
            type="text"
            value={form.firstName}
            onChange={handleChange}
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
            onChange={handleChange}
            placeholder={t('lastNamePlaceholder')}
            autoComplete="family-name"
          />
        </div>
      </div>

      {/* Sex */}
      <div className="space-y-2">
        <Label htmlFor="sex">{t('sex')}</Label>
        <select
          id="sex"
          name="sex"
          value={form.sex}
          onChange={handleChange}
          className={cn(SELECT_CLASS)}
        >
          <option value="">{t('sexPlaceholder')}</option>
          <option value="MALE">{t('sexMale')}</option>
          <option value="FEMALE">{t('sexFemale')}</option>
          <option value="OTHER">{t('sexOther')}</option>
        </select>
      </div>

      {/* Birth year + height */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        <div className="space-y-2">
          <Label htmlFor="birthYear">{t('birthYear')}</Label>
          <Input
            id="birthYear"
            name="birthYear"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={form.birthYear}
            onChange={handleChange}
            placeholder={t('birthYearPlaceholder')}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="heightCm">{t('heightCm')}</Label>
          <Input
            id="heightCm"
            name="heightCm"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={form.heightCm}
            onChange={handleChange}
            placeholder={t('heightCmPlaceholder')}
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

      {/* Dietitian code section */}
      <div className="border-t border-border pt-5 mt-5 space-y-3" data-tour="pt-dietitian-code">
        <Label className="text-base font-semibold">{t('dietitianSection')}</Label>

        {dietitianError && (
          <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
            {dietitianError}
          </div>
        )}
        {dietitianSuccess && (
          <div className="flex items-center gap-2 rounded-lg bg-sage-50 border border-sage-200 px-4 py-3 text-sm text-sage-800">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            {dietitianSuccess}
          </div>
        )}

        {patient.dietitian ? (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">{t('dietitianCurrentLabel')}</p>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border px-4 py-3 bg-muted/30">
              <div className="min-w-0 flex-1 text-sm">
                <span className="font-medium truncate block">{patient.dietitian.email}</span>
                {patient.dietitian.dietitianProfile?.code && (
                  <span className="text-muted-foreground">
                    {t('dietitianCodeLabel')}: {patient.dietitian.dietitianProfile.code}
                  </span>
                )}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleUnlinkDietitian}
                disabled={dietitianLoading}
                className="shrink-0 gap-1.5 text-destructive hover:text-destructive"
              >
                {dietitianLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Unlink className="h-3.5 w-3.5" />
                )}
                {t('dietitianUnlink')}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">{t('dietitianDescription')}</p>
            <div className="flex gap-2">
              <Input
                value={dietitianCode}
                onChange={(e) => {
                  setDietitianCode(e.target.value.toUpperCase());
                  setDietitianError(null);
                  setDietitianSuccess(null);
                }}
                placeholder={t('dietitianCodePlaceholder')}
                className="max-w-xs font-mono uppercase"
                maxLength={20}
              />
              <Button
                type="button"
                variant="sage"
                onClick={handleLinkDietitian}
                disabled={dietitianLoading || !dietitianCode.trim()}
                className="gap-1.5"
              >
                {dietitianLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Link2 className="h-4 w-4" />
                )}
                {t('dietitianLink')}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Change password section */}
      <div className="border-t border-border pt-5 mt-5 space-y-3" data-tour="pt-change-password">
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

        <div className="space-y-3">
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
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
            type="button"
            variant="sage"
            onClick={handleChangePassword}
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
        </div>
      </div>

      {/* Change email section */}
      <div className="border-t border-border pt-5 mt-5 space-y-3">
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

        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
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
            type="button"
            variant="sage"
            onClick={handleChangeEmail}
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
        </div>
      </div>
    </form>
  );
}
