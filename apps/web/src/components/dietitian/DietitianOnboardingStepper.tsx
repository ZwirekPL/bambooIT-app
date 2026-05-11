'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { api, ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Check, User, Copy, Rocket } from 'lucide-react';

const STEP_KEYS = ['profile', 'code', 'ready'] as const;
type StepKey = (typeof STEP_KEYS)[number];

interface DietitianOnboardingStepperProps {
  token: string;
}

export function DietitianOnboardingStepper({ token }: DietitianOnboardingStepperProps) {
  const t = useTranslations('dietitian.onboarding');
  const router = useRouter();
  const [activeStep, setActiveStep] = useState<StepKey>('profile');
  const [loading, setLoading] = useState(true);

  // Profile state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dietitianCode, setDietitianCode] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [codeCopied, setCodeCopied] = useState(false);

  const fetchStatus = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [statusRes, profileRes] = await Promise.all([
        api.onboarding.getDietitianStatus(token),
        api.profile.getDietitian(token).catch(() => null),
      ]);

      if (profileRes?.profile) {
        setFirstName(profileRes.profile.firstName ?? '');
        setLastName(profileRes.profile.lastName ?? '');
        setDietitianCode(profileRes.profile.code ?? '');
      }

      if (!statusRes.profileComplete) {
        setActiveStep('profile');
      } else {
        // Profile done — show code step, then ready
        setActiveStep('code');
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleProfileSubmit = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      setError(t('fieldsRequired') ?? 'Wypełnij imię i nazwisko');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await api.profile.updateDietitian({ firstName: firstName.trim(), lastName: lastName.trim() }, token);
      await fetchStatus();
      setActiveStep('code');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : (t('saveError') ?? 'Wystąpił błąd'));
    } finally {
      setSaving(false);
    }
  };

  const handleCopyCode = async () => {
    if (!dietitianCode) return;
    await navigator.clipboard.writeText(dietitianCode);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  };

  const handleFinish = () => {
    localStorage.setItem('dietitian_onboarding_completed', '1');
    // Activate multi-page tour
    localStorage.setItem('tour_dietitian_active', '1');
    localStorage.setItem('tour_dietitian_step', '0');
    localStorage.removeItem('tour_dietitian_completed');
    router.push('/dietetyk');
  };

  const handleSkipTour = () => {
    localStorage.setItem('dietitian_onboarding_completed', '1');
    router.push('/dietetyk');
  };

  function getStepStatus(step: StepKey): 'completed' | 'current' | 'upcoming' {
    const stepIndex = STEP_KEYS.indexOf(step);
    const activeIndex = STEP_KEYS.indexOf(activeStep);
    if (stepIndex < activeIndex) return 'completed';
    if (stepIndex === activeIndex) return 'current';
    return 'upcoming';
  }

  const stepLabels: Record<StepKey, string> = {
    profile: t('stepProfile') ?? 'Profil',
    code: t('stepCode') ?? 'Twój kod',
    ready: t('stepReady') ?? 'Gotowe',
  };

  if (loading) {
    return <div className="text-center py-12 text-muted-foreground">{t('loading') ?? 'Ładowanie...'}</div>;
  }

  return (
    <div className="space-y-8">
      {/* Stepper indicator */}
      <div className="flex items-center justify-center gap-0">
        {STEP_KEYS.map((step, idx) => {
          const status = getStepStatus(step);
          return (
            <div key={step} className="flex items-center">
              {idx > 0 && (
                <div className={`w-12 h-0.5 ${status === 'upcoming' ? 'bg-muted' : 'bg-primary'}`} />
              )}
              <div className="flex flex-col items-center gap-1.5">
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-medium border-2 transition-colors ${
                    status === 'completed'
                      ? 'bg-primary text-primary-foreground border-primary'
                      : status === 'current'
                        ? 'border-primary text-primary bg-background'
                        : 'border-muted text-muted-foreground bg-background'
                  }`}
                >
                  {status === 'completed' ? <Check className="h-4 w-4" /> : idx + 1}
                </div>
                <span className={`text-xs ${status === 'current' ? 'font-medium' : 'text-muted-foreground'}`}>
                  {stepLabels[step]}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Step content */}
      <div className="rounded-lg border bg-card p-6">
        {/* Step 1: Profile */}
        {activeStep === 'profile' && (
          <div className="space-y-6">
            <div className="text-center">
              <User className="h-10 w-10 mx-auto text-primary mb-3" />
              <h2 className="text-lg font-semibold">{t('profileTitle') ?? 'Uzupełnij swój profil'}</h2>
              <p className="text-sm text-muted-foreground mt-1">
                {t('profileDesc') ?? 'Twoi pacjenci zobaczą te dane. Uzupełnij imię i nazwisko.'}
              </p>
            </div>
            <div className="max-w-sm mx-auto space-y-4">
              <div>
                <Label htmlFor="firstName">{t('firstName') ?? 'Imię'}</Label>
                <Input
                  id="firstName"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder={t('firstNamePlaceholder') ?? 'np. Anna'}
                />
              </div>
              <div>
                <Label htmlFor="lastName">{t('lastName') ?? 'Nazwisko'}</Label>
                <Input
                  id="lastName"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder={t('lastNamePlaceholder') ?? 'np. Kowalska'}
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button onClick={handleProfileSubmit} disabled={saving} className="w-full">
                {saving ? (t('saving') ?? 'Zapisuję...') : (t('continue') ?? 'Dalej')}
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Code */}
        {activeStep === 'code' && (
          <div className="space-y-6">
            <div className="text-center">
              <Copy className="h-10 w-10 mx-auto text-primary mb-3" />
              <h2 className="text-lg font-semibold">{t('codeTitle') ?? 'Twój kod dietetyka'}</h2>
              <p className="text-sm text-muted-foreground mt-1">
                {t('codeDesc') ?? 'Podaj ten kod swoim pacjentom. Użyją go podczas rejestracji, aby się z Tobą połączyć.'}
              </p>
            </div>
            <div className="max-w-sm mx-auto space-y-4">
              <div className="flex items-center gap-2 justify-center">
                <div className="px-6 py-3 bg-muted rounded-lg text-xl font-mono font-bold tracking-wider">
                  {dietitianCode}
                </div>
                <Button variant="outline" size="icon" onClick={handleCopyCode} title={t('copy') ?? 'Kopiuj'}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              {codeCopied && (
                <p className="text-sm text-green-600 text-center">{t('codeCopied') ?? 'Skopiowano!'}</p>
              )}
              <p className="text-xs text-muted-foreground text-center">
                {t('codeHint') ?? 'Kod jest przypisany do Twojego konta i nie zmienia się. Możesz go też znaleźć w ustawieniach profilu.'}
              </p>
              <Button onClick={() => setActiveStep('ready')} className="w-full">
                {t('continue') ?? 'Dalej'}
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Ready */}
        {activeStep === 'ready' && (
          <div className="space-y-6">
            <div className="text-center">
              <Rocket className="h-10 w-10 mx-auto text-primary mb-3" />
              <h2 className="text-lg font-semibold">{t('readyTitle') ?? 'Wszystko gotowe!'}</h2>
              <p className="text-sm text-muted-foreground mt-1">
                {t('readyDesc') ?? 'Twoje konto jest skonfigurowane. Możesz teraz rozpocząć pracę z pacjentami.'}
              </p>
            </div>
            <div className="max-w-sm mx-auto space-y-3">
              <div className="rounded-md border p-3 space-y-2 text-sm">
                <p className="font-medium">{t('readyChecklist') ?? 'Co możesz teraz zrobić:'}</p>
                <ul className="space-y-1.5 text-muted-foreground">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                    <li key={n} className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px] shrink-0">{n}</Badge>
                      {t(`readyStep${n}`)}
                    </li>
                  ))}
                </ul>
              </div>
              <Button onClick={handleFinish} className="w-full gap-2">
                <Rocket className="h-4 w-4" />
                {t('startTour') ?? 'Rozpocznij interaktywny tour'}
              </Button>
              <Button variant="ghost" onClick={handleSkipTour} className="w-full text-muted-foreground">
                {t('skipTour') ?? 'Pomiń i przejdź do panelu'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
