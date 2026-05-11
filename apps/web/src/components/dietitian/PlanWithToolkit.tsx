'use client';

import { createContext, useContext, useState, useCallback } from 'react';
import { DietToolkit } from './DietToolkit';
import type { DietPlan } from '@/types/api';

// ─── Shared context for selected-day macros ─────────────────────────────────

interface DayMacros {
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
}

interface DayMacrosContextValue {
  macros: DayMacros | null;
  setMacros: (m: DayMacros | null) => void;
}

const DayMacrosContext = createContext<DayMacrosContextValue>({
  macros: null,
  setMacros: () => {},
});

export function useDayMacros() {
  return useContext(DayMacrosContext);
}

// ─── Main wrapper ────────────────────────────────────────────────────────────

interface PlanWithToolkitProps {
  plan: DietPlan;
  patientId: string;
  token: string;
  children?: React.ReactNode;
}

/**
 * Provides shared selected-day macros context.
 * DietPlanEditor writes macros, DietToolkit reads them.
 */
export function PlanWithToolkit({ plan, patientId, token, children }: PlanWithToolkitProps) {
  const [macros, setMacros] = useState<DayMacros | null>(null);

  const handleSetMacros = useCallback((m: DayMacros | null) => {
    setMacros(m);
  }, []);

  return (
    <DayMacrosContext.Provider value={{ macros, setMacros: handleSetMacros }}>
      {/* Main column */}
      <div className="flex-1 min-w-0 space-y-6">
        {children}
      </div>

      {/* Sticky toolkit sidebar — hidden on mobile */}
      <aside className="hidden xl:block shrink-0 sticky top-20 self-start max-h-[calc(100vh-5rem)] overflow-y-auto">
        <DietToolkit
          patientId={patientId}
          planId={plan.id}
          token={token}
          currentDayMacros={macros}
        />
      </aside>
    </DayMacrosContext.Provider>
  );
}
