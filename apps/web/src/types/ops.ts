// Operational core (hours ledger) — shared frontend types.
// Decimal values arrive as strings (Prisma Decimal → JSON).

export type Plan = 'START' | 'FIRMA' | 'FIRMA_PLUS';
export type ServicePeriodStatus = 'OPEN' | 'TO_SETTLE' | 'SETTLED';

export interface ServicePackage {
  plan: Plan;
  monthlyPriceNet: string;
  hoursIncluded: number;
  overageRatePerHour: string;
  reactionTimeHours: number;
  carryoverCapHours: number;
}

export interface OpsClientSummary {
  id: string;
  companyName: string | null;
  contactName: string;
  email: string;
  servicePlan: Plan | null;
  serviceSince: string | null;
  onboardingComplete: boolean;
  currentMonth: {
    consumedMinutes: number;
    availableMinutes: number;
    overageHours: string;
    status: ServicePeriodStatus;
  } | null;
}

export interface OpsTimeEntry {
  id: string;
  companyId: string;
  periodId: string;
  date: string;
  minutes: number;
  description: string;
  billable: boolean;
  createdById: string;
  createdAt: string;
  createdBy?: { email: string };
}

export interface OpsHoursView {
  year: number;
  month: number;
  plan: Plan;
  hoursIncluded: number;
  carryoverInMinutes: number;
  consumedMinutes: number;
  availableMinutes: number;
  overageHours: string;
  overageAmountNet: string;
  overageRatePerHour: string;
  status: ServicePeriodStatus;
  entries: OpsTimeEntry[];
}

export interface OpsPeriod {
  id: string;
  year: number;
  month: number;
  plan: Plan;
  hoursIncluded: number;
  carryoverInMinutes: number;
  carryoverOutMinutes: number;
  consumedMinutes: number;
  availableMinutes: number;
  overageHours: string;
  overageAmountNet: string;
  overageRatePerHour: string;
  status: ServicePeriodStatus;
  settledAt: string | null;
  reportSentAt: string | null;
}

export interface OpsOnboarding {
  companyId: string;
  accessCollected: string | null;
  remoteToolReady: string | null;
  monitoringSet: string | null;
  backupSet: string | null;
  docsCreated: string | null;
  completedAt: string | null;
  notes: string | null;
}
