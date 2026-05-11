'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import type { OnboardingStatus, Patient } from '@/types/api';
import { ProfileStep } from './ProfileStep';
import { TrialStep } from './TrialStep';
import { InterviewStep } from './InterviewStep';
import { TourStep } from './TourStep';

const STEP_KEYS = ['registration', 'profile', 'trial', 'interview', 'tour'] as const;
type StepKey = (typeof STEP_KEYS)[number];

export function OnboardingStepper() {
  const t = useTranslations('onboarding');
  const { data: session } = useSession();
  const token = '';

  const [status, setStatus] = useState<OnboardingStatus | null>(null);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeStep, setActiveStep] = useState<StepKey>('profile');

  const fetchStatus = useCallback(async () => {
    if (!token) return;
    try {
      const [onboardingRes, profileRes] = await Promise.all([
        api.onboarding.getStatus(token),
        api.profile.get(token).catch(() => null),
      ]);
      setStatus(onboardingRes);
      if (profileRes && 'patient' in profileRes) {
        setPatient((profileRes as { patient: Patient }).patient);
      }

      // Determine current step based on status
      if (!onboardingRes.profileComplete) {
        setActiveStep('profile');
      } else if (!onboardingRes.trialActive) {
        setActiveStep('trial');
      } else if (!onboardingRes.interviewComplete) {
        setActiveStep('interview');
      } else {
        setActiveStep('tour');
      }
    } catch {
      // If error, start at profile
      setActiveStep('profile');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  function getStepStatus(step: StepKey): 'completed' | 'current' | 'upcoming' {
    if (!status) return 'upcoming';

    const stepIndex = STEP_KEYS.indexOf(step);
    const activeIndex = STEP_KEYS.indexOf(activeStep);

    if (step === 'registration') return 'completed'; // Always done
    if (stepIndex < activeIndex) return 'completed';
    if (stepIndex === activeIndex) return 'current';
    return 'upcoming';
  }

  async function handleProfileComplete() {
    setActiveStep('trial');
    await fetchStatus();
  }

  function handleTrialComplete() {
    setActiveStep('interview');
    fetchStatus();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-muted-foreground">{t('loading')}</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Title */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold">{t('title')}</h1>
        <p className="text-muted-foreground mt-2">{t('subtitle')}</p>
      </div>

      {/* Stepper indicator */}
      <div className="flex items-center justify-center mb-10">
        {STEP_KEYS.map((step, i) => {
          const stepStatus = getStepStatus(step);
          return (
            <div key={step} className="flex items-center">
              {/* Step circle */}
              <div className="flex flex-col items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                    stepStatus === 'completed'
                      ? 'bg-primary text-primary-foreground'
                      : stepStatus === 'current'
                        ? 'bg-primary text-primary-foreground ring-4 ring-primary/20'
                        : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {stepStatus === 'completed' ? (
                    <span>&#10003;</span>
                  ) : (
                    i + 1
                  )}
                </div>
                <span
                  className={`text-xs mt-1 hidden sm:block ${
                    stepStatus === 'current' ? 'font-semibold text-primary' : 'text-muted-foreground'
                  }`}
                >
                  {t(`steps.${step}`)}
                </span>
              </div>
              {/* Connector line */}
              {i < STEP_KEYS.length - 1 && (
                <div
                  className={`w-8 sm:w-12 h-0.5 mx-1 ${
                    getStepStatus(STEP_KEYS[i + 1]) !== 'upcoming' || stepStatus === 'completed'
                      ? 'bg-primary'
                      : 'bg-muted'
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Active step content */}
      {activeStep === 'profile' && (
        <ProfileStep token={token} patient={patient} onComplete={handleProfileComplete} />
      )}
      {activeStep === 'trial' && (
        <TrialStep token={token} onComplete={handleTrialComplete} />
      )}
      {activeStep === 'interview' && <InterviewStep />}
      {activeStep === 'tour' && <TourStep />}
    </div>
  );
}
