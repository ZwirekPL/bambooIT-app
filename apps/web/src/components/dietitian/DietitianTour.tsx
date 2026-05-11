'use client';

import { useMultiPageTour } from '@/hooks/useMultiPageTour';
import { DIETITIAN_TOUR_STEPS } from '@/tours/dietitian-steps';

/**
 * Multi-page interactive tour for dietitians.
 * Mounted in dietitian layout — renders on all dietitian pages.
 * Triggered via localStorage: tour_dietitian_active = '1'
 */
export function DietitianTour() {
  useMultiPageTour({
    role: 'dietitian',
    steps: DIETITIAN_TOUR_STEPS,
  });

  return null;
}
