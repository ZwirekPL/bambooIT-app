'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { api, ApiError } from '@/lib/api';

interface CheckInFormProps {
  lastWeight: number | null;
  hasGiCondition?: boolean; // 79.2: show GI fields for IBS/reflux patients
}

export function CheckInForm({ lastWeight, hasGiCondition }: CheckInFormProps) {
  const t = useTranslations('dashboard.checkin');
  const { data: session } = useSession();
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [weightKg, setWeightKg] = useState(lastWeight?.toString() ?? '');
  const [compliance, setCompliance] = useState('');
  const [hunger, setHunger] = useState(5);
  const [energy, setEnergy] = useState(5);
  const [sleep, setSleep] = useState(5);
  const [activity, setActivity] = useState(5);
  const [notes, setNotes] = useState('');
  // 79.2: GI fields
  const [digestion, setDigestion] = useState(5);
  const [bloating, setBloating] = useState(false);
  const [stoolBristol, setStoolBristol] = useState(4);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    const token = '';
    if (!token) return;

    setLoading(true);
    try {
      const payload: Record<string, unknown> = {};
      if (weightKg.trim()) payload.weightKg = parseFloat(weightKg);
      if (compliance.trim()) payload.compliance = parseInt(compliance, 10);
      payload.hunger = hunger;
      payload.energy = energy;
      payload.sleep = sleep;
      payload.activity = activity;
      if (hasGiCondition) {
        payload.digestion = digestion;
        payload.bloating = bloating;
        payload.stoolBristol = stoolBristol;
      }
      if (notes.trim()) payload.notes = notes.trim();

      await api.checkIns.create(payload, token);
      setSuccess(true);
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError(t('error'));
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Weight */}
      <div className="space-y-2">
        <Label htmlFor="weightKg">{t('weight')}</Label>
        <Input
          id="weightKg"
          type="number"
          step="0.1"
          min="10"
          max="500"
          placeholder={t('weightPlaceholder')}
          value={weightKg}
          onChange={(e) => setWeightKg(e.target.value)}
        />
        <p className="text-[11px] text-muted-foreground/70">Najlepiej rano, na czczo</p>
      </div>

      {/* Compliance */}
      <div className="space-y-2">
        <Label htmlFor="compliance">{t('compliance')}</Label>
        <Input
          id="compliance"
          type="number"
          min="0"
          max="100"
          placeholder={t('compliancePlaceholder')}
          value={compliance}
          onChange={(e) => setCompliance(e.target.value)}
        />
        <p className="text-[11px] text-muted-foreground/70">0% = wcale &middot; 100% = idealnie wg planu</p>
      </div>

      {/* Hunger */}
      <RangeField label={t('hunger')} value={hunger} onChange={setHunger} lowLabel="Syty" highLabel="Bardzo glodny" hint="Ogolne odczucie glodu w ciagu dnia" />

      {/* Energy */}
      <RangeField label={t('energy')} value={energy} onChange={setEnergy} lowLabel="Wyczerpanie" highLabel="Pelnia sil" hint="Jak czujesz sie dzis energetycznie?" />

      {/* Sleep */}
      <RangeField label={t('sleep')} value={sleep} onChange={setSleep} lowLabel="Kiepski" highLabel="Swietny" hint="Jakosc ostatniej nocy" />

      {/* Activity */}
      <RangeField label={t('activity')} value={activity} onChange={setActivity} lowLabel="Siedzaco" highLabel="Intensywnie" hint="Ile ruchu miales dzisiaj?" />

      {/* 79.2: GI/Digestion section — only for IBS/reflux patients */}
      {hasGiCondition && (
        <div className="space-y-4 rounded-lg border border-amber-200 bg-amber-50/30 p-4">
          <div>
            <p className="text-sm font-medium text-amber-800">Dziennik trawienia</p>
            <p className="text-xs text-amber-600 mt-0.5">
              Te pytania pomagaja dietetykowi dopasowac diete do Twojego ukladu pokarmowego. Wypelniaj codziennie — nawet krotko.
            </p>
          </div>

          {/* Digestion comfort 1-10 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Jak czul sie dzisiaj Twoj brzuch?</Label>
              <span className="text-sm tabular-nums">
                {digestion <= 3 ? '\ud83d\ude2b' : digestion <= 6 ? '\ud83d\ude10' : '\ud83d\ude0a'} {digestion}/10
              </span>
            </div>
            <p className="text-xs text-muted-foreground">1 = silny bol, skurcze, dyskomfort &middot; 10 = pelny komfort, zero dolegliwosci</p>
            <input
              type="range" min={1} max={10} step={1} value={digestion}
              onChange={(e) => setDigestion(parseInt(e.target.value, 10))}
              className="w-full accent-amber-500 h-2 cursor-pointer"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Bardzo zle</span>
              <span>Doskonale</span>
            </div>
          </div>

          <hr className="border-amber-200/60" />

          {/* Bloating toggle */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <div>
                <Label>Czy wystapily wzdecia?</Label>
                <p className="text-xs text-muted-foreground">Uczucie pelnosci, rozpierania lub &quot;nadmuchanego&quot; brzucha</p>
              </div>
              <div className="flex flex-col items-center gap-1 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setBloating(!bloating)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${bloating ? 'bg-amber-500' : 'bg-gray-200'}`}
                  aria-label={bloating ? 'Tak, wystapily wzdecia' : 'Nie, brak wzdec'}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${bloating ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
                <span className="text-xs font-medium" style={{ color: bloating ? '#b45309' : '#6b7280' }}>{bloating ? 'Tak' : 'Nie'}</span>
              </div>
            </div>
          </div>

          <hr className="border-amber-200/60" />

          {/* Bristol Stool Scale 1-7 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Skala Bristol — konsystencja stolca</Label>
              <span className="text-sm font-medium tabular-nums">{stoolBristol}/7</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Skala medyczna od 1 (twarde grudki) do 7 (plynny). Norma to 3-4 (miekki, uformowany).
            </p>
            <input
              type="range" min={1} max={7} step={1} value={stoolBristol}
              onChange={(e) => setStoolBristol(parseInt(e.target.value, 10))}
              className="w-full accent-amber-500 h-2 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>1 — twarde grudki</span>
              <span>3-4 norma</span>
              <span>7 — plynny</span>
            </div>
          </div>
        </div>
      )}

      {/* Notes */}
      <div className="space-y-2">
        <Label htmlFor="notes">{t('notes')}</Label>
        <Textarea
          id="notes"
          placeholder={t('notesPlaceholder')}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={2000}
          rows={3}
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {success && (
        <p className="flex items-center gap-1.5 text-sm text-green-600">
          <CheckCircle2 className="h-4 w-4" />
          {t('success')}
        </p>
      )}

      <Button type="submit" disabled={loading} className="w-full">
        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        {t('submit')}
      </Button>
    </form>
  );
}

function RangeField({
  label,
  hint,
  value,
  onChange,
  lowLabel,
  highLabel,
}: {
  label: string;
  hint?: string;
  value: number;
  onChange: (v: number) => void;
  lowLabel: string;
  highLabel: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <Label>{label}</Label>
          {hint && <p className="text-[11px] text-muted-foreground/70">{hint}</p>}
        </div>
        <span className="text-sm font-medium tabular-nums text-foreground">{value}</span>
      </div>
      <input
        type="range"
        min={1}
        max={10}
        step={1}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value, 10))}
        className="w-full accent-primary h-2 cursor-pointer"
      />
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{lowLabel}</span>
        <span>{highLabel}</span>
      </div>
    </div>
  );
}
