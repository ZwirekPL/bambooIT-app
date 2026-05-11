'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { Link } from '@/i18n/navigation';
import { ChevronRight, Users, UserX } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PatientSearchForm } from './PatientSearchForm';
import type { PatientWithLatestPlan, DietPlanStatus } from '@/types/api';

const PLAN_STATUS_STYLES: Record<
  DietPlanStatus,
  { label: string; className: string }
> = {
  AI_DRAFT:   { label: 'Szkic AI',             className: 'bg-violet-100 text-violet-800' },
  GENERATED:  { label: 'Oczekuje weryfikacji', className: 'bg-amber-100 text-amber-800' },
  REVIEWED:   { label: 'Zweryfikowany',        className: 'bg-blue-100 text-blue-800' },
  SENT:       { label: 'Wysłany',              className: 'bg-teal-100 text-teal-800' },
  PUBLISHED:  { label: 'Opublikowany',         className: 'bg-sage-100 text-sage-800' },
  MANUAL_REVIEW_REQUIRED: { label: 'Wymaga przeglądu', className: 'text-amber-600 bg-amber-50' },
  GENERATION_FAILED: { label: 'Błąd generowania',      className: 'text-red-600 bg-red-50' },
};

function PlanStatusBadge({ status }: { status: DietPlanStatus | undefined }) {
  if (!status) return null;
  const style = PLAN_STATUS_STYLES[status];
  if (!style) return null;
  return (
    <Badge className={`text-xs font-medium pointer-events-none ${style.className}`}>
      {style.label}
    </Badge>
  );
}

function PatientRow({
  patient,
  noPlanLabel,
  viewLabel,
  isUnassigned,
}: {
  patient: PatientWithLatestPlan;
  noPlanLabel: string;
  viewLabel: string;
  isUnassigned?: boolean;
}) {
  const displayName =
    patient.firstName && patient.lastName
      ? `${patient.firstName} ${patient.lastName}`
      : patient.user.email;

  const latestPlan = patient.dietPlans[0];
  const joinedDate = new Date(patient.createdAt).toLocaleDateString('pl-PL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  return (
    <tr className="border-b border-border last:border-0 hover:bg-muted/40 transition-colors">
      <td className="px-4 py-3">
        <p className="text-sm font-medium">{displayName}</p>
        {patient.firstName && patient.lastName && (
          <p className="text-xs text-muted-foreground">{patient.user.email}</p>
        )}
      </td>
      <td className="px-4 py-3 hidden md:table-cell">
        <span className="text-sm text-muted-foreground">{patient.user.email}</span>
      </td>
      <td className="px-4 py-3">
        {latestPlan ? (
          <PlanStatusBadge status={latestPlan.status} />
        ) : (
          <span className="text-xs text-muted-foreground">{noPlanLabel}</span>
        )}
      </td>
      <td className="px-4 py-3 hidden sm:table-cell">
        <span className="text-sm text-muted-foreground">{joinedDate}</span>
      </td>
      <td className="px-4 py-3">
        <Link
          href={`/dietetyk/pacjenci/${patient.id}${isUnassigned ? '?readonly=1' : ''}`}
          className="inline-flex items-center gap-1 text-xs font-medium text-sage-600 hover:text-sage-800 transition-colors"
        >
          {viewLabel}
          <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </td>
    </tr>
  );
}

function PatientTable({
  patients,
  total,
  isUnassigned,
}: {
  patients: PatientWithLatestPlan[];
  total: number;
  isUnassigned?: boolean;
}) {
  const t = useTranslations('dietitian.patients');

  if (patients.length === 0) {
    return (
      <Card className="border-border">
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          {t('noResults')}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {t('colName')}
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider hidden md:table-cell">
                {t('colEmail')}
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {t('colPlanStatus')}
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider hidden sm:table-cell">
                {t('colCreated')}
              </th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {patients.map((patient) => (
              <PatientRow
                key={patient.id}
                patient={patient}
                noPlanLabel={t('noPlan')}
                viewLabel={t('viewDetails')}
                isUnassigned={isUnassigned}
              />
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

interface PatientTabsProps {
  token: string;
  initialMine: PatientWithLatestPlan[];
  initialMineTotal: number;
  initialUnassigned: PatientWithLatestPlan[];
  initialUnassignedTotal: number;
}

export function PatientTabs({
  token,
  initialMine,
  initialMineTotal,
  initialUnassigned,
  initialUnassignedTotal,
}: PatientTabsProps) {
  const t = useTranslations('dietitian.patients');
  const searchParams = useSearchParams();
  const defaultTab = searchParams.get('tab') === 'unassigned' ? 'unassigned' : 'mine';

  return (
    <div className="space-y-4">
      <Tabs defaultValue={defaultTab}>
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="mine" className="gap-2">
            <Users className="h-4 w-4" />
            {t('tabMine')}
            {initialMineTotal > 0 && (
              <span className="ml-1 text-xs text-muted-foreground">({initialMineTotal})</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="unassigned" className="gap-2">
            <UserX className="h-4 w-4" />
            {t('tabUnassigned')}
            {initialUnassignedTotal > 0 && (
              <span className="ml-1 text-xs text-muted-foreground">({initialUnassignedTotal})</span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="mine">
          <div className="space-y-4">
            <PatientSearchForm />
            <PatientTable
              patients={initialMine}
              total={initialMineTotal}
            />
          </div>
        </TabsContent>

        <TabsContent value="unassigned">
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {t('unassignedDescription')}
            </p>
            <PatientSearchForm />
            <PatientTable
              patients={initialUnassigned}
              total={initialUnassignedTotal}
              isUnassigned
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
