'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

/**
 * Legacy wrapper — converts old tour triggers to the new multi-page tour system.
 * The actual tour is handled by PatientTour component in the layout.
 */
export function DashboardTour() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const shouldShow =
      searchParams.get('tour') === '1' ||
      localStorage.getItem('show_dashboard_tour') === 'true' ||
      localStorage.getItem('show_dashboard_tour') === '1';

    const alreadyCompleted =
      localStorage.getItem('tour_patient_completed') === '1' ||
      localStorage.getItem('onboarding_tour_completed') === '1' ||
      localStorage.getItem('onboarding_tour_completed') === 'true';

    if (shouldShow && !alreadyCompleted) {
      // Activate multi-page tour
      localStorage.setItem('tour_patient_active', '1');
      localStorage.setItem('tour_patient_step', '0');
      localStorage.removeItem('show_dashboard_tour');
    }

    // Clean up URL param
    if (searchParams.get('tour')) {
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [searchParams]);

  return null;
}
