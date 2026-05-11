'use client';

import { useState, useEffect } from 'react';
import { Pill, Plus, XCircle, CheckCircle2, Flame, ChevronDown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import type { SupplementPrescription, SupplementCompliance, SupplementFrequency } from '@/types/api';

interface SupplementsPanelProps {
  patientId: string;
  token: string;
}

const FREQUENCY_LABELS: Record<string, string> = {
  daily: 'Codziennie',
  twice_daily: '2× dziennie',
  three_times_daily: '3× dziennie',
  weekly: '1× w tygodniu',
  as_needed: 'W razie potrzeby',
};

const COMMON_SUPPLEMENTS = [
  { nutrientKey: 'vitaminD', label: 'Wit. D', dose: '2000', unit: 'IU' },
  { nutrientKey: 'vitaminB12', label: 'Wit. B12', dose: '500', unit: 'µg' },
  { nutrientKey: 'iron', label: 'Żelazo', dose: '28', unit: 'mg' },
  { nutrientKey: 'omega3', label: 'Omega-3', dose: '1000', unit: 'mg' },
  { nutrientKey: 'magnesium', label: 'Magnez', dose: '300', unit: 'mg' },
  { nutrientKey: 'zinc', label: 'Cynk', dose: '15', unit: 'mg' },
  { nutrientKey: 'folate', label: 'Kwas foliowy', dose: '400', unit: 'µg' },
  { nutrientKey: 'calcium', label: 'Wapń', dose: '500', unit: 'mg' },
];

export function SupplementsPanel({ patientId, token }: SupplementsPanelProps) {
  const [supplements, setSupplements] = useState<SupplementPrescription[]>([]);
  const [compliance, setCompliance] = useState<SupplementCompliance[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    nutrientKey: 'vitaminD',
    label: 'Wit. D',
    dose: '2000',
    unit: 'IU',
    frequency: 'daily' as SupplementFrequency,
    notes: '',
  });

  function loadData() {
    Promise.all([
      api.supplements.listByPatient(patientId, token),
      api.supplements.complianceByPatient(patientId, token),
    ]).then(([suppRes, compRes]) => {
      setSupplements(suppRes.supplements);
      setCompliance(compRes.compliance);
    }).catch(console.error).finally(() => setLoading(false));
  }

  useEffect(() => { loadData(); }, [patientId, token]);

  function getCompliance(id: string): SupplementCompliance | undefined {
    return compliance.find((c) => c.supplementId === id);
  }

  async function handleCreate() {
    setSaving(true);
    try {
      await api.supplements.create(patientId, {
        nutrientKey: form.nutrientKey,
        label: form.label,
        dose: form.dose,
        unit: form.unit,
        frequency: form.frequency,
        notes: form.notes || undefined,
      }, token);
      setShowForm(false);
      loadData();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeactivate(id: string) {
    try {
      await api.supplements.update(id, patientId, { active: false }, token);
      loadData();
    } catch (err) {
      console.error(err);
    }
  }

  function applyPreset(preset: typeof COMMON_SUPPLEMENTS[0]) {
    setForm((f) => ({ ...f, nutrientKey: preset.nutrientKey, label: preset.label, dose: preset.dose, unit: preset.unit }));
  }

  const active = supplements.filter((s) => s.active);

  if (loading) return null;

  return (
    <Card className="border-border">
      <CardHeader className="pb-3 flex-row items-center justify-between">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Pill className="h-4 w-4 text-muted-foreground" />
          Suplementy
          {active.length > 0 && (
            <span className="ml-1 text-xs font-normal text-muted-foreground">({active.length} aktywnych)</span>
          )}
        </CardTitle>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setShowForm((v) => !v)}>
          <Plus className="h-3.5 w-3.5" />
          Przepisz
        </Button>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Prescribe form */}
        {showForm && (
          <div className="rounded-lg border border-dashed border-border p-4 space-y-3 bg-muted/30">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Nowy suplement</p>

            {/* Presets */}
            <div className="flex flex-wrap gap-1.5">
              {COMMON_SUPPLEMENTS.map((p) => (
                <button
                  key={p.nutrientKey}
                  onClick={() => applyPreset(p)}
                  className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                    form.nutrientKey === p.nutrientKey
                      ? 'bg-brand-green text-white border-brand-green'
                      : 'border-border hover:bg-muted'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Nazwa</label>
                <input
                  value={form.label}
                  onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                  className="w-full rounded border border-input bg-background px-2 py-1.5 text-sm"
                  placeholder="np. Wit. D 2000IU"
                />
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-xs text-muted-foreground mb-1 block">Dawka</label>
                  <input
                    value={form.dose}
                    onChange={(e) => setForm((f) => ({ ...f, dose: e.target.value }))}
                    className="w-full rounded border border-input bg-background px-2 py-1.5 text-sm"
                    placeholder="2000"
                  />
                </div>
                <div className="w-16">
                  <label className="text-xs text-muted-foreground mb-1 block">Jedn.</label>
                  <input
                    value={form.unit}
                    onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
                    className="w-full rounded border border-input bg-background px-2 py-1.5 text-sm"
                    placeholder="IU"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Częstotliwość</label>
              <select
                value={form.frequency}
                onChange={(e) => setForm((f) => ({ ...f, frequency: e.target.value as SupplementFrequency }))}
                className="w-full rounded border border-input bg-background px-2 py-1.5 text-sm"
              >
                {Object.entries(FREQUENCY_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Uwagi (opcjonalne)</label>
              <input
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                className="w-full rounded border border-input bg-background px-2 py-1.5 text-sm"
                placeholder="np. Przyjmować z posiłkiem"
              />
            </div>

            <div className="flex gap-2">
              <Button size="sm" onClick={handleCreate} disabled={saving || !form.label || !form.dose}>
                {saving ? 'Zapisywanie...' : 'Zapisz'}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowForm(false)}>
                Anuluj
              </Button>
            </div>
          </div>
        )}

        {/* Active supplements list */}
        {active.length === 0 && !showForm && (
          <p className="text-sm text-muted-foreground py-2">Brak aktywnych suplementów.</p>
        )}

        {active.map((supp) => {
          const comp = getCompliance(supp.id);
          return (
            <div key={supp.id} className="flex items-start justify-between gap-3 rounded-lg border border-border p-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium">{supp.label}</span>
                  <span className="text-xs text-muted-foreground">{FREQUENCY_LABELS[supp.frequency]}</span>
                </div>
                {comp && comp.totalCheckIns > 0 && (
                  <div className="flex items-center gap-3 mt-1">
                    <span className={`text-xs ${comp.compliancePct >= 70 ? 'text-green-700' : comp.compliancePct >= 40 ? 'text-amber-600' : 'text-red-600'}`}>
                      Regularność: {comp.compliancePct}%
                    </span>
                    {comp.streak > 0 && (
                      <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                        <Flame className="h-3 w-3 text-orange-400" />{comp.streak}d
                      </span>
                    )}
                  </div>
                )}
              </div>
              <button
                onClick={() => handleDeactivate(supp.id)}
                className="text-muted-foreground hover:text-red-500 transition-colors shrink-0"
                title="Zakończ"
              >
                <XCircle className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
