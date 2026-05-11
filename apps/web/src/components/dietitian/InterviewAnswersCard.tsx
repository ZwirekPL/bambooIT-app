'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp, Mail, ClipboardList } from 'lucide-react';
import { api } from '@/lib/api';
import type { Interview } from '@/types/api';

// Human-readable labels for common interview fields
const FIELD_LABELS: Record<string, string> = {
  mainGoal: 'Główny cel',
  currentWeightKg: 'Aktualna waga (kg)',
  targetWeightKg: 'Waga docelowa (kg)',
  activityLevel: 'Poziom aktywności',
  activityTypes: 'Rodzaje aktywności',
  workoutsPerWeek: 'Treningi / tydzień',
  workoutDurationMin: 'Czas treningu (min)',
  chronicDiseases: 'Choroby przewlekłe',
  digestiveIssues: 'Problemy trawienne',
  medications: 'Leki',
  allergies: 'Alergie',
  intolerances: 'Nietolerancje',
  dislikedFoods: 'Nielubiane produkty',
  preferredFoods: 'Preferowane produkty',
  dietType: 'Typ diety',
  cuisinePreferences: 'Preferencje kuchni',
  mealsPerDay: 'Posiłki / dzień',
  cookingTime: 'Czas gotowania',
  budget: 'Budżet',
  firstMealTime: 'Pierwsza godzina posiłku',
  lastMealTime: 'Ostatnia godzina posiłku',
  eatsAtNight: 'Jada w nocy',
  alcoholFrequency: 'Alkohol',
  workType: 'Rodzaj pracy',
  mainMealAt: 'Główny posiłek w',
  supplements: 'Suplementy',
  pregnancyStatus: 'Status ciąży',
  pregnancyTrimester: 'Trymestr ciąży',
  hormonalIssues: 'Zaburzenia hormonalne',
  stressLevel: 'Poziom stresu',
  sleepHours: 'Godziny snu',
  hba1c: 'HbA1c (%)',
  egfr: 'eGFR',
  ckdStadium: 'Stadium PChN',
  additionalNotes: 'Uwagi dodatkowe',
};

function formatValue(val: unknown): string {
  if (val === null || val === undefined) return '—';
  if (Array.isArray(val)) return val.length > 0 ? val.join(', ') : '—';
  if (typeof val === 'boolean') return val ? 'Tak' : 'Nie';
  return String(val);
}

interface Props {
  patientId: string;
  latestInterview: Interview | null;
  token: string;
}

export function InterviewAnswersCard({ patientId, latestInterview, token }: Props) {
  const { data: session } = useSession();
  const [expanded, setExpanded] = useState(false);
  const [requestSent, setRequestSent] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);

  const handleRequestUpdate = async () => {
    setRequesting(true);
    setRequestError(null);
    try {
      await api.interviews.requestUpdate(patientId, token);
      setRequestSent(true);
    } catch {
      setRequestError('Nie udało się wysłać prośby. Spróbuj ponownie.');
    } finally {
      setRequesting(false);
    }
  };

  const answers = latestInterview?.answers ?? {};
  const filledFields = Object.entries(answers).filter(([, v]) => {
    if (v === null || v === undefined || v === '') return false;
    if (Array.isArray(v) && v.length === 0) return false;
    return true;
  });

  const canRequestUpdate = session?.user?.role === 'DIETITIAN' || session?.user?.role === 'ADMIN';

  return (
    <Card className="border-border">
      <CardHeader className="pb-3 flex-row items-center justify-between">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-muted-foreground" />
          Wywiad żywieniowy
          {latestInterview && (
            <span className="text-xs font-normal text-muted-foreground">
              — {new Date(latestInterview.createdAt).toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' })}
            </span>
          )}
        </CardTitle>
        <div className="flex items-center gap-2">
          {canRequestUpdate && (
            requestSent ? (
              <span className="text-xs text-green-700">Prośba wysłana</span>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="text-xs gap-1.5"
                onClick={handleRequestUpdate}
                disabled={requesting}
              >
                <Mail className="h-3.5 w-3.5" />
                {requesting ? 'Wysyłanie...' : 'Poproś o aktualizację'}
              </Button>
            )
          )}
          {latestInterview && (
            <Button
              size="sm"
              variant="ghost"
              className="text-xs gap-1"
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              {expanded ? 'Zwiń' : 'Pokaż odpowiedzi'}
            </Button>
          )}
        </div>
      </CardHeader>

      {!latestInterview && (
        <CardContent>
          <p className="text-sm text-muted-foreground">Pacjent nie wypełnił jeszcze wywiadu żywieniowego.</p>
        </CardContent>
      )}

      {requestError && (
        <CardContent className="pt-0">
          <p className="text-xs text-destructive">{requestError}</p>
        </CardContent>
      )}

      {latestInterview && expanded && (
        <CardContent className="pt-0">
          <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
            {filledFields.map(([key, value]) => (
              <div key={key} className="flex gap-2 py-1 border-b border-border/50 last:border-0">
                <span className="text-xs text-muted-foreground min-w-[140px] shrink-0">
                  {FIELD_LABELS[key] ?? key}
                </span>
                <span className="text-xs font-medium break-words">{formatValue(value)}</span>
              </div>
            ))}
            {filledFields.length === 0 && (
              <p className="text-xs text-muted-foreground col-span-2">Brak danych w wywiadzie.</p>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
