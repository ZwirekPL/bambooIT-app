'use client';

import { useEffect, useCallback } from 'react';
import { driver, type DriveStep, type Config } from 'driver.js';
import 'driver.js/dist/driver.css';

interface UseTourOptions {
  /** localStorage key to check/set completion */
  storageKey: string;
  /** localStorage trigger key (set to '1' to start tour) */
  triggerKey: string;
  /** Tour steps */
  steps: DriveStep[];
  /** Additional driver.js config */
  config?: Partial<Config>;
  /** Called when tour completes or is dismissed */
  onComplete?: () => void;
}

export function useTour({ storageKey, triggerKey, steps, config, onComplete }: UseTourOptions) {
  const startTour = useCallback(() => {
    if (steps.length === 0) return;

    const driverObj = driver({
      showProgress: true,
      animate: true,
      overlayColor: 'rgba(0, 0, 0, 0.6)',
      stagePadding: 8,
      stageRadius: 8,
      popoverClass: 'dietetyk-tour-popover',
      nextBtnText: 'Dalej →',
      prevBtnText: '← Wstecz',
      doneBtnText: 'Gotowe ✓',
      progressText: '{{current}} z {{total}}',
      ...config,
      steps,
      onDestroyStarted: () => {
        localStorage.setItem(storageKey, '1');
        localStorage.removeItem(triggerKey);
        onComplete?.();
        driverObj.destroy();
      },
    });

    // Small delay to let DOM elements render
    setTimeout(() => {
      driverObj.drive();
    }, 500);
  }, [steps, storageKey, triggerKey, config, onComplete]);

  useEffect(() => {
    const shouldStart = localStorage.getItem(triggerKey) === '1';
    const alreadyCompleted = localStorage.getItem(storageKey) === '1';

    if (shouldStart && !alreadyCompleted) {
      startTour();
    }
  }, [triggerKey, storageKey, startTour]);

  return { startTour };
}
