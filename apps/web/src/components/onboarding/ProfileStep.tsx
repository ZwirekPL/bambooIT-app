'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { api, ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface ProfileStepProps {
  token: string;
  patient: {
    firstName?: string;
    lastName?: string;
    sex?: string;
    birthYear?: number;
    heightCm?: number;
    weightKg?: number;
  } | null;
  onComplete: () => void;
}

export function ProfileStep({ token, patient, onComplete }: ProfileStepProps) {
  const t = useTranslations('onboarding.profile');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    firstName: patient?.firstName ?? '',
    lastName: patient?.lastName ?? '',
    sex: patient?.sex ?? '',
    birthYear: patient?.birthYear?.toString() ?? '',
    heightCm: patient?.heightCm?.toString() ?? '',
    weightKg: patient?.weightKg?.toString() ?? '',
  });

  const [touched, setTouched] = useState<Record<string, boolean>>({});

  function validate() {
    const errors: Record<string, boolean> = {};
    if (!form.sex) errors.sex = true;
    if (!form.birthYear || isNaN(Number(form.birthYear))) errors.birthYear = true;
    if (!form.heightCm || isNaN(Number(form.heightCm))) errors.heightCm = true;
    if (!form.weightKg || isNaN(Number(form.weightKg))) errors.weightKg = true;
    return errors;
  }

  const errors = validate();
  const isValid = Object.keys(errors).length === 0;

  // Progress indicator: count filled required fields out of 4
  const filledCount = [form.sex, form.birthYear, form.heightCm, form.weightKg].filter(Boolean).length;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouched({ sex: true, birthYear: true, heightCm: true, weightKg: true });

    if (!isValid) return;

    setLoading(true);
    setError(null);

    try {
      const data: Record<string, unknown> = {
        sex: form.sex,
        birthYear: Number(form.birthYear),
        heightCm: Number(form.heightCm),
        weightKg: Number(form.weightKg),
      };
      if (form.firstName.trim()) data.firstName = form.firstName.trim();
      if (form.lastName.trim()) data.lastName = form.lastName.trim();

      await api.profile.update(data, token);
      onComplete();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Unknown error');
      }
    } finally {
      setLoading(false);
    }
  }

  const fieldClass = (field: string) =>
    touched[field] && errors[field as keyof typeof errors]
      ? 'border-red-500 focus-visible:ring-red-500'
      : '';

  return (
    <Card className="w-full max-w-lg mx-auto">
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
        <CardDescription>{t('description')}</CardDescription>
        {/* Progress bar */}
        <div className="mt-3">
          <div className="flex justify-between text-xs text-muted-foreground mb-1">
            <span>{filledCount}/4</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-300"
              style={{ width: `${(filledCount / 4) * 100}%` }}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Optional: name fields */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="firstName">{t('firstName')}</Label>
              <Input
                id="firstName"
                value={form.firstName}
                onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="lastName">{t('lastName')}</Label>
              <Input
                id="lastName"
                value={form.lastName}
                onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
              />
            </div>
          </div>

          {/* Sex */}
          <div>
            <Label>{t('sex')}</Label>
            <div className="flex gap-3 mt-1">
              {(['male', 'female'] as const).map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => {
                    setForm((f) => ({ ...f, sex: val }));
                    setTouched((t) => ({ ...t, sex: true }));
                  }}
                  className={`flex-1 py-2 px-4 rounded-md border text-sm font-medium transition-colors ${
                    form.sex === val
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-muted hover:border-primary/50'
                  } ${touched.sex && errors.sex ? 'border-red-500' : ''}`}
                >
                  {val === 'male' ? t('sexMale') : t('sexFemale')}
                </button>
              ))}
            </div>
            {touched.sex && errors.sex && (
              <p className="text-xs text-red-500 mt-1">{t('required')}</p>
            )}
          </div>

          {/* Birth Year */}
          <div>
            <Label htmlFor="birthYear">{t('birthYear')}</Label>
            <Input
              id="birthYear"
              type="number"
              min={1900}
              max={new Date().getFullYear()}
              className={fieldClass('birthYear')}
              value={form.birthYear}
              onChange={(e) => {
                setForm((f) => ({ ...f, birthYear: e.target.value }));
                setTouched((t) => ({ ...t, birthYear: true }));
              }}
            />
            {touched.birthYear && errors.birthYear && (
              <p className="text-xs text-red-500 mt-1">{t('required')}</p>
            )}
          </div>

          {/* Height */}
          <div>
            <Label htmlFor="heightCm">{t('heightCm')}</Label>
            <Input
              id="heightCm"
              type="number"
              min={50}
              max={300}
              className={fieldClass('heightCm')}
              value={form.heightCm}
              onChange={(e) => {
                setForm((f) => ({ ...f, heightCm: e.target.value }));
                setTouched((t) => ({ ...t, heightCm: true }));
              }}
            />
            {touched.heightCm && errors.heightCm && (
              <p className="text-xs text-red-500 mt-1">{t('required')}</p>
            )}
          </div>

          {/* Weight */}
          <div>
            <Label htmlFor="weightKg">{t('weightKg')}</Label>
            <Input
              id="weightKg"
              type="number"
              min={10}
              max={500}
              step={0.1}
              className={fieldClass('weightKg')}
              value={form.weightKg}
              onChange={(e) => {
                setForm((f) => ({ ...f, weightKg: e.target.value }));
                setTouched((t) => ({ ...t, weightKg: true }));
              }}
            />
            {touched.weightKg && errors.weightKg && (
              <p className="text-xs text-red-500 mt-1">{t('required')}</p>
            )}
          </div>

          {error && (
            <p className="text-sm text-red-500 bg-red-50 p-2 rounded">{error}</p>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? '...' : t('submit')}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
