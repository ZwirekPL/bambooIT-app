'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { api, ApiError } from '@/lib/api';
import type { PatientDetail } from '@/types/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Props {
  patient: PatientDetail;
  token: string;
  onSaved: (updated: PatientDetail) => void;
  onCancel: () => void;
}

export function PatientEditForm({ patient, token, onSaved, onCancel }: Props) {
  const t = useTranslations('dietitian.patientDetail');

  const [firstName, setFirstName] = useState(patient.firstName ?? '');
  const [lastName, setLastName] = useState(patient.lastName ?? '');
  const [sex, setSex] = useState(patient.sex ?? '');
  const [birthYear, setBirthYear] = useState(patient.birthYear ? String(patient.birthYear) : '');
  const [heightCm, setHeightCm] = useState(patient.heightCm ? String(patient.heightCm) : '');
  const [weightKg, setWeightKg] = useState(patient.weightKg ? String(patient.weightKg) : '');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const result = await api.patients.update(
        patient.id,
        {
          firstName: firstName || undefined,
          lastName: lastName || undefined,
          sex: sex || undefined,
          birthYear: birthYear ? parseInt(birthYear, 10) : undefined,
          heightCm: heightCm ? parseFloat(heightCm) : undefined,
          weightKg: weightKg ? parseFloat(weightKg) : undefined,
        },
        token
      );
      onSaved(result.patient);
    } catch (err) {
      setError(err instanceof ApiError ? t('saveError') : t('saveError'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="firstName">{t('fieldFirstName')}</Label>
          <Input
            id="firstName"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder={t('fieldFirstName')}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="lastName">{t('fieldLastName')}</Label>
          <Input
            id="lastName"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder={t('fieldLastName')}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sex">{t('fieldSex')}</Label>
          <select
            id="sex"
            value={sex}
            onChange={(e) => setSex(e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="">—</option>
            <option value="MALE">{t('sexMale')}</option>
            <option value="FEMALE">{t('sexFemale')}</option>
            <option value="OTHER">{t('sexOther')}</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="birthYear">{t('fieldBirthYear')}</Label>
          <Input
            id="birthYear"
            type="number"
            min={1900}
            max={new Date().getFullYear()}
            value={birthYear}
            onChange={(e) => setBirthYear(e.target.value)}
            placeholder="np. 1990"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="heightCm">{t('fieldHeight')}</Label>
          <Input
            id="heightCm"
            type="number"
            min={50}
            max={250}
            value={heightCm}
            onChange={(e) => setHeightCm(e.target.value)}
            placeholder="np. 175"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="weightKg">{t('fieldWeight')}</Label>
          <Input
            id="weightKg"
            type="number"
            min={20}
            max={500}
            step={0.1}
            value={weightKg}
            onChange={(e) => setWeightKg(e.target.value)}
            placeholder="np. 70.5"
          />
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-2 justify-end pt-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          {t('cancel')}
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? t('savingChanges') : t('saveChanges')}
        </Button>
      </div>
    </form>
  );
}
