'use client';

import { useEffect, useCallback, useRef } from 'react';
import { useRouter, usePathname } from '@/i18n/navigation';
import { driver, type DriveStep, type Config } from 'driver.js';
import 'driver.js/dist/driver.css';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface MultiPageTourStep {
  /** Page path this step belongs to (e.g., '/dietetyk', '/dietetyk/przepisy') */
  page: string;
  /** CSS selector for element to highlight. Omit for popover-only (centered). */
  element?: string;
  /** Popover content */
  popover: {
    title: string;
    description: string;
    side?: 'top' | 'bottom' | 'left' | 'right' | 'over';
    align?: 'start' | 'center' | 'end';
  };
}

interface UseMultiPageTourOptions {
  /** Unique role identifier (e.g., 'dietitian', 'patient') */
  role: string;
  /** All tour steps across all pages */
  steps: MultiPageTourStep[];
  /** Additional driver.js config */
  config?: Partial<Config>;
}

// ─── LocalStorage keys ───────────────────────────────────────────────────────

function keys(role: string) {
  return {
    active: `tour_${role}_active`,
    step: `tour_${role}_step`,
    completed: `tour_${role}_completed`,
  };
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useMultiPageTour({ role, steps, config }: UseMultiPageTourOptions) {
  const router = useRouter();
  const pathname = usePathname();
  const driverRef = useRef<ReturnType<typeof driver> | null>(null);
  const k = keys(role);

  // Normalize pathname: strip locale prefix (e.g., /pl/dietetyk → /dietetyk)
  const normalizePath = useCallback((path: string) => {
    return path.replace(/^\/(pl|en)/, '');
  }, []);

  const currentPath = normalizePath(pathname);

  // Check if a page path matches current location
  const isCurrentPage = useCallback((pagePath: string) => {
    return currentPath === pagePath || currentPath.startsWith(pagePath + '/');
  }, [currentPath]);

  // End tour completely (mark as completed)
  const endTour = useCallback(() => {
    localStorage.setItem(k.completed, '1');
    localStorage.removeItem(k.active);
    localStorage.removeItem(k.step);
    if (driverRef.current) {
      try { driverRef.current.destroy(); } catch { /* ignore */ }
    }
  }, [k]);

  // Pause tour (save progress but don't mark completed — user can resume)
  const pauseTour = useCallback(() => {
    // Keep tour_${role}_active = '1' and tour_${role}_step = current
    // Don't set completed — next page load will resume
    if (driverRef.current) {
      try { driverRef.current.destroy(); } catch { /* ignore */ }
    }
  }, []);

  // Get steps for current page, filtering out those with missing DOM elements
  const getPageSteps = useCallback((globalStepIndex: number): {
    localSteps: DriveStep[];
    localStartIndex: number;
    globalIndices: number[];
  } => {
    const localSteps: DriveStep[] = [];
    const globalIndices: number[] = [];
    let localStartIndex = 0;

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      if (!isCurrentPage(step.page)) continue;

      // Check if element exists (or is popover-only)
      if (step.element) {
        const el = document.querySelector(step.element);
        if (!el) continue; // Skip steps with missing elements
      }

      if (i === globalStepIndex) {
        localStartIndex = localSteps.length;
      }

      localSteps.push({
        element: step.element,
        popover: step.popover,
      });
      globalIndices.push(i);
    }

    return { localSteps, localStartIndex, globalIndices };
  }, [steps, isCurrentPage]);

  // Navigate to a step
  const goToStep = useCallback((globalIndex: number) => {
    if (globalIndex < 0 || globalIndex >= steps.length) {
      // Tour finished
      endTour();
      return;
    }

    const targetStep = steps[globalIndex];
    localStorage.setItem(k.step, String(globalIndex));

    if (!isCurrentPage(targetStep.page)) {
      // Navigate to different page — tour will resume on mount
      router.push(targetStep.page as Parameters<typeof router.push>[0]);
      return;
    }

    // Same page — restart driver at this step
    startDriverOnCurrentPage(globalIndex);
  }, [steps, k, isCurrentPage, router, endTour]); // eslint-disable-line react-hooks/exhaustive-deps

  const startDriverOnCurrentPage = useCallback((globalIndex: number) => {
    // Destroy existing driver
    if (driverRef.current) {
      try { driverRef.current.destroy(); } catch { /* ignore */ }
    }

    const { localSteps, localStartIndex, globalIndices } = getPageSteps(globalIndex);

    if (localSteps.length === 0) {
      // No steps on this page — move to next step on a different page
      const nextIdx = globalIndex + 1;
      if (nextIdx < steps.length) {
        localStorage.setItem(k.step, String(nextIdx));
        const nextStep = steps[nextIdx];
        if (!isCurrentPage(nextStep.page)) {
          router.push(nextStep.page as Parameters<typeof router.push>[0]);
        }
      } else {
        endTour();
      }
      return;
    }

    const totalGlobalSteps = steps.length;

    const driverObj = driver({
      showProgress: true,
      animate: true,
      overlayColor: 'rgba(0, 0, 0, 0.6)',
      stagePadding: 10,
      stageRadius: 10,
      popoverClass: 'dietetyk-tour-popover',
      nextBtnText: 'Dalej →',
      prevBtnText: '← Wstecz',
      doneBtnText: 'Zakończ tour ✓',
      progressText: `{{current}} z ${totalGlobalSteps}`,
      // Block all interactions outside the popover
      disableActiveInteraction: true,
      allowClose: false,
      // overlay click is blocked by allowClose: false
      ...config,
      steps: localSteps.map((s, i) => ({
        ...s,
        popover: {
          ...s.popover,
          // Override progress text to show global progress
          progressText: `${globalIndices[i] + 1} z ${totalGlobalSteps}`,
          // Custom button text for cross-page navigation
          ...(i === localSteps.length - 1 && globalIndices[i] < totalGlobalSteps - 1
            ? { nextBtnText: 'Dalej (nowa strona) →' }
            : {}),
          ...(i === 0 && globalIndices[0] > 0 && !isCurrentPage(steps[globalIndices[0] - 1].page)
            ? { prevBtnText: '← Wstecz (poprzednia strona)' }
            : {}),
        },
      })),

      onNextClick: () => {
        const currentLocalIndex = driverObj.getActiveIndex() ?? 0;
        const currentGlobalIndex = globalIndices[currentLocalIndex];

        if (currentLocalIndex === localSteps.length - 1) {
          // Last step on this page — move to next global step
          driverObj.destroy();
          goToStep(currentGlobalIndex + 1);
        } else {
          driverObj.moveNext();
          // Update global step tracker
          const nextLocalIndex = (driverObj.getActiveIndex() ?? 0);
          if (globalIndices[nextLocalIndex] !== undefined) {
            localStorage.setItem(k.step, String(globalIndices[nextLocalIndex]));
          }
        }
      },

      onPrevClick: () => {
        const currentLocalIndex = driverObj.getActiveIndex() ?? 0;
        const currentGlobalIndex = globalIndices[currentLocalIndex];

        if (currentLocalIndex === 0 && currentGlobalIndex > 0) {
          // First step on this page — go back to previous page
          driverObj.destroy();
          goToStep(currentGlobalIndex - 1);
        } else {
          driverObj.movePrevious();
          const prevLocalIndex = (driverObj.getActiveIndex() ?? 0);
          if (globalIndices[prevLocalIndex] !== undefined) {
            localStorage.setItem(k.step, String(globalIndices[prevLocalIndex]));
          }
        }
      },

      onDestroyStarted: () => {
        // Don't auto-destroy — we handle it ourselves
        // This fires when user somehow triggers destroy (shouldn't happen with allowClose: false)
        driverObj.destroy();
      },

      onPopoverRender: (popover) => {
        // Add "Zakończ tour" link to top-right of popover (next to X)
        const wrapper = popover.wrapper;
        if (!wrapper) return;

        const endBtn = document.createElement('button');
        endBtn.textContent = 'Zakończ tour';
        endBtn.className = 'driver-tour-end-btn';
        endBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          endTour();
        });
        wrapper.appendChild(endBtn);
      },
    });

    driverRef.current = driverObj;

    // Start at the correct local step
    setTimeout(() => {
      driverObj.drive(localStartIndex);
    }, 600);
  }, [getPageSteps, steps, k, isCurrentPage, router, config, goToStep, endTour]);

  // Auto-resume tour on page load
  useEffect(() => {
    const isActive = localStorage.getItem(k.active) === '1';
    const isCompleted = localStorage.getItem(k.completed) === '1';

    if (!isActive || isCompleted) return;

    const globalStep = parseInt(localStorage.getItem(k.step) ?? '0', 10);

    // Wait for DOM to be ready
    const timer = setTimeout(() => {
      startDriverOnCurrentPage(globalStep);
    }, 800);

    return () => {
      clearTimeout(timer);
      if (driverRef.current) {
        try { driverRef.current.destroy(); } catch { /* ignore */ }
      }
    };
  }, [currentPath]); // eslint-disable-line react-hooks/exhaustive-deps

  // Start tour manually (from step 0)
  const startTour = useCallback(() => {
    localStorage.setItem(k.active, '1');
    localStorage.setItem(k.step, '0');
    localStorage.removeItem(k.completed);

    const firstStep = steps[0];
    if (!isCurrentPage(firstStep.page)) {
      router.push(firstStep.page as Parameters<typeof router.push>[0]);
    } else {
      startDriverOnCurrentPage(0);
    }
  }, [k, steps, isCurrentPage, router, startDriverOnCurrentPage]);

  // Resume tour from last saved step
  const resumeTour = useCallback(() => {
    const savedStep = parseInt(localStorage.getItem(k.step) ?? '0', 10);
    localStorage.setItem(k.active, '1');
    localStorage.removeItem(k.completed);

    const targetStep = steps[savedStep];
    if (targetStep && !isCurrentPage(targetStep.page)) {
      router.push(targetStep.page as Parameters<typeof router.push>[0]);
    } else {
      startDriverOnCurrentPage(savedStep);
    }
  }, [k, steps, isCurrentPage, router, startDriverOnCurrentPage]);

  return { startTour, resumeTour, endTour, pauseTour };
}
