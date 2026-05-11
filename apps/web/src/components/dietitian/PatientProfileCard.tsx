'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { PatientDetail } from '@/types/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Pencil, CheckCircle2 } from 'lucide-react';
import { PatientEditForm } from './PatientEditForm';

interface Props {
  initialPatient: PatientDetail;
  token: string;
  readOnly?: boolean;
}

function calcBmi(heightCm?: number, weightKg?: number): string | null {
  if (!heightCm || !weightKg) return null;
  const bmi = weightKg / Math.pow(heightCm / 100, 2);
  return bmi.toFixed(1);
}

function calcAge(birthYear?: number): number | null {
  if (!birthYear) return null;
  return new Date().getFullYear() - birthYear;
}

export function PatientProfileCard({ initialPatient, token, readOnly }: Props) {
  const t = useTranslations('dietitian.patientDetail');
  const [patient, setPatient] = useState<PatientDetail>(initialPatient);
  const [editing, setEditing] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  function handleSaved(updated: PatientDetail) {
    setPatient(updated);
    setEditing(false);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 3000);
  }

  const displayName =
    patient.firstName && patient.lastName
      ? `${patient.firstName} ${patient.lastName}`
      : patient.user.email;

  const bmi = calcBmi(patient.heightCm, patient.weightKg);
  const age = calcAge(patient.birthYear);

  const SEX_LABELS: Record<string, string> = {
    MALE: t('sexMale'),
    FEMALE: t('sexFemale'),
    OTHER: t('sexOther'),
  };

  const profileRows: { label: string; value: string | null | undefined }[] = [
    { label: t('fieldEmail'), value: patient.user.email },
    { label: t('fieldSex'), value: patient.sex ? SEX_LABELS[patient.sex] : undefined },
    { label: t('fieldBirthYear'), value: patient.birthYear ? String(patient.birthYear) : undefined },
    { label: t('age'), value: age ? `${age} ${t('years')}` : undefined },
    { label: t('fieldHeight'), value: patient.heightCm ? `${patient.heightCm} cm` : undefined },
    { label: t('fieldWeight'), value: patient.weightKg ? `${patient.weightKg} kg` : undefined },
    { label: t('bmi'), value: bmi ?? undefined },
  ];

  return (
    <Card className="border-border">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base font-semibold">{t('profileTitle')}</CardTitle>
        {!editing && !readOnly && (
          <Button variant="ghost" size="sm" onClick={() => setEditing(true)} className="gap-1.5">
            <Pencil className="h-3.5 w-3.5" />
            {t('editProfile')}
          </Button>
        )}
        {savedFlash && (
          <span className="flex items-center gap-1 text-sm text-teal-600">
            <CheckCircle2 className="h-4 w-4" />
            {t('saveSuccess')}
          </span>
        )}
      </CardHeader>
      <CardContent>
        {editing ? (
          <PatientEditForm
            patient={patient}
            token={token}
            onSaved={handleSaved}
            onCancel={() => setEditing(false)}
          />
        ) : (
          <div>
            <p className="text-lg font-semibold mb-4">{displayName}</p>
            <dl className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-4 sm:gap-x-6 gap-y-2 sm:gap-y-3">
              {profileRows.map(({ label, value }) => (
                <div key={label}>
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                  <dd className="text-sm font-medium mt-0.5">{value ?? t('noValue')}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
