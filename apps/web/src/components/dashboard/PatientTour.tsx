'use client';

import { useMultiPageTour } from '@/hooks/useMultiPageTour';
import { PATIENT_TOUR_STEPS } from '@/tours/patient-steps';

/**
 * Multi-page interactive tour for patients.
 * Mounted in dashboard layout — renders on all patient pages.
 * Triggered via localStorage: tour_patient_active = '1'
 */
export function PatientTour() {
  useMultiPageTour({
    role: 'patient',
    steps: PATIENT_TOUR_STEPS,
  });

  return null;
}
