'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import type { NutritionProtocol, NutritionProtocolCreateData, MacroRatios, CaloricAdjustments, MealSlot, ProtocolAssignedDietitian, AdminDietitian } from '@/types/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Pencil, Users, CheckCircle2, XCircle, Star } from 'lucide-react';

interface Props { token: string }

const DEFAULT_MACRO_RATIOS: MacroRatios = {
  REDUCE:   { proteinPct: 30, fatPct: 30, carbsPct: 40 },
  GAIN:     { proteinPct: 30, fatPct: 25, carbsPct: 45 },
  MAINTAIN: { proteinPct: 20, fatPct: 30, carbsPct: 50 },
};

const DEFAULT_CALORIC_ADJ: CaloricAdjustments = {
  REDUCE:   -15,
  GAIN:     +12,
  MAINTAIN: 0,
};

const DEFAULT_MEAL_DIST: MealSlot[] = [
  { mealName: 'Śniadanie',          pct: 25 },
  { mealName: 'II śniadanie',       pct: 10 },
  { mealName: 'Obiad',              pct: 35 },
  { mealName: 'Podwieczorek',       pct: 10 },
  { mealName: 'Kolacja',            pct: 20 },
];

function emptyForm(): NutritionProtocolCreateData {
  return {
    name: '',
    description: '',
    scope: 'GLOBAL',
    isDefault: false,
    macroRatios: DEFAULT_MACRO_RATIOS,
    caloricAdjustments: DEFAULT_CALORIC_ADJ,
    minProteinPerKg: 0.8,
    maxProteinPerKg: 2.5,
    defaultMealCount: 5,
    mealDistribution: [...DEFAULT_MEAL_DIST],
    foodRestrictions: [],
    systemPromptAdditions: '',
    preferredCuisines: [],
    recipeComplexity: 'MODERATE',
    avoidFoodCategories: [],
  };
}

// ─── MacroGoalRow ─────────────────────────────────────────────────────────────

function MacroGoalRow({ goal, label, ratios, calAdj, onChangeRatio, onChangeAdj }: {
  goal: 'REDUCE' | 'GAIN' | 'MAINTAIN';
  label: string;
  ratios: { proteinPct: number; fatPct: number; carbsPct: number };
  calAdj: number;
  onChangeRatio: (field: 'proteinPct' | 'fatPct' | 'carbsPct', val: number) => void;
  onChangeAdj: (val: number) => void;
}) {
  const sum = ratios.proteinPct + ratios.fatPct + ratios.carbsPct;
  const ok = Math.abs(sum - 100) < 0.6;

  return (
    <div className="border rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="font-medium text-sm">{label}</span>
        <span className={`text-xs ${ok ? 'text-green-600' : 'text-red-500'}`}>
          suma: {sum}% {!ok && '≠ 100%'}
        </span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {(['proteinPct', 'fatPct', 'carbsPct'] as const).map(f => (
          <div key={f}>
            <p className="text-xs text-muted-foreground mb-1">
              {f === 'proteinPct' ? 'B%' : f === 'fatPct' ? 'T%' : 'W%'}
            </p>
            <Input
              type="number" min={0} max={100} step={1}
              value={ratios[f]}
              onChange={e => onChangeRatio(f, Number(e.target.value))}
              className="h-8 text-sm"
            />
          </div>
        ))}
        <div>
          <p className="text-xs text-muted-foreground mb-1">Korekta kcal%</p>
          <Input
            type="number" min={-25} max={30} step={1}
            value={calAdj}
            onChange={e => onChangeAdj(Number(e.target.value))}
            className="h-8 text-sm"
          />
        </div>
      </div>
    </div>
  );
}

// ─── MealDistEditor ───────────────────────────────────────────────────────────

function MealDistEditor({ slots, onChange }: {
  slots: MealSlot[];
  onChange: (slots: MealSlot[]) => void;
}) {
  const sum = slots.reduce((s, m) => s + m.pct, 0);
  const ok = Math.abs(sum - 100) < 0.6;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>Rozkład posiłków</Label>
        <span className={`text-xs ${ok ? 'text-green-600' : 'text-red-500'}`}>suma: {sum}%</span>
      </div>
      {slots.map((slot, i) => (
        <div key={i} className="flex gap-2 items-center">
          <Input
            value={slot.mealName}
            onChange={e => {
              const next = [...slots];
              next[i] = { ...next[i], mealName: e.target.value };
              onChange(next);
            }}
            className="h-8 text-sm flex-1"
            placeholder="Nazwa posiłku"
          />
          <Input
            type="number" min={0} max={100}
            value={slot.pct}
            onChange={e => {
              const next = [...slots];
              next[i] = { ...next[i], pct: Number(e.target.value) };
              onChange(next);
            }}
            className="h-8 text-sm w-20"
          />
          <span className="text-xs text-muted-foreground">%</span>
          <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-red-500"
            onClick={() => onChange(slots.filter((_, j) => j !== i))}>✕</Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm"
        onClick={() => onChange([...slots, { mealName: '', pct: 0 }])}>
        + dodaj posiłek
      </Button>
    </div>
  );
}

// ─── ProtocolForm ─────────────────────────────────────────────────────────────

function ProtocolForm({ token, initial, onSave, onClose }: {
  token: string;
  initial?: NutritionProtocol;
  onSave: () => void;
  onClose: () => void;
}) {
  const t = useTranslations('admin.protocols');
  const [form, setForm] = useState<NutritionProtocolCreateData>(() =>
    initial ? {
      name: initial.name,
      description: initial.description ?? '',
      scope: initial.scope,
      isDefault: initial.isDefault,
      macroRatios: { ...initial.macroRatios },
      caloricAdjustments: { ...initial.caloricAdjustments },
      minProteinPerKg: initial.minProteinPerKg,
      maxProteinPerKg: initial.maxProteinPerKg,
      defaultMealCount: initial.defaultMealCount,
      mealDistribution: [...initial.mealDistribution],
      foodRestrictions: [...(initial.foodRestrictions ?? [])],
      systemPromptAdditions: initial.systemPromptAdditions ?? '',
      preferredCuisines: [...(initial.preferredCuisines ?? [])],
      recipeComplexity: initial.recipeComplexity,
      avoidFoodCategories: [...(initial.avoidFoodCategories ?? [])],
    } : emptyForm()
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Snapshot of initial form state for dirty-checking
  const [initialSnapshot] = useState(() => JSON.stringify(form));

  function setRatio(goal: 'REDUCE' | 'GAIN' | 'MAINTAIN', field: 'proteinPct' | 'fatPct' | 'carbsPct', val: number) {
    setForm(f => ({ ...f, macroRatios: { ...f.macroRatios, [goal]: { ...f.macroRatios[goal], [field]: val } } }));
  }
  function setAdj(goal: 'REDUCE' | 'GAIN' | 'MAINTAIN', val: number) {
    setForm(f => ({ ...f, caloricAdjustments: { ...f.caloricAdjustments, [goal]: val } }));
  }

  async function handleSave() {
    // Skip API call if nothing changed (edit mode)
    if (initial && JSON.stringify(form) === initialSnapshot) {
      onClose();
      return;
    }
    setSaving(true); setError(null);
    try {
      if (initial) {
        await api.protocols.update(initial.id, form, token);
      } else {
        await api.protocols.create(form, token);
      }
      onSave();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Błąd zapisu');
    } finally {
      setSaving(false);
    }
  }

  const goalLabels: Record<string, string> = { REDUCE: 'Redukcja', GAIN: 'Masa', MAINTAIN: 'Utrzymanie' };

  return (
    <div className="space-y-4 py-2">
      <Tabs defaultValue="basic">
        <TabsList className="grid grid-cols-3 w-full">
          <TabsTrigger value="basic">Podstawowe</TabsTrigger>
          <TabsTrigger value="macros">Makro</TabsTrigger>
          <TabsTrigger value="meals">Posiłki</TabsTrigger>
        </TabsList>

        <TabsContent value="basic" className="space-y-4 mt-3">
          <div className="space-y-1">
            <Label>{t('name')}</Label>
            <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="np. Standard WHO" />
          </div>
          <div className="space-y-1">
            <Label>{t('description')}</Label>
            <Textarea rows={2} value={form.description ?? ''} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Min białko (g/kg)</Label>
              <Input type="number" min={0.8} max={3} step={0.1} value={form.minProteinPerKg ?? 0.8}
                onChange={e => setForm(f => ({ ...f, minProteinPerKg: Number(e.target.value) }))} />
            </div>
            <div className="space-y-1">
              <Label>Max białko (g/kg)</Label>
              <Input type="number" min={0.8} max={3} step={0.1} value={form.maxProteinPerKg ?? 2.5}
                onChange={e => setForm(f => ({ ...f, maxProteinPerKg: Number(e.target.value) }))} />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Złożoność przepisów</Label>
            <Select value={form.recipeComplexity ?? 'MODERATE'}
              onValueChange={v => setForm(f => ({ ...f, recipeComplexity: v as 'SIMPLE' | 'MODERATE' | 'COMPLEX' }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="SIMPLE">Prosta</SelectItem>
                <SelectItem value="MODERATE">Umiarkowana</SelectItem>
                <SelectItem value="COMPLEX">Złożona</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Dodatkowe instrukcje dla AI</Label>
            <Textarea rows={3} value={form.systemPromptAdditions ?? ''}
              onChange={e => setForm(f => ({ ...f, systemPromptAdditions: e.target.value }))}
              placeholder="np. Unikaj smażonych potraw, preferuj kuchnię śródziemnomorską..." />
          </div>
          <div className="flex items-center gap-2">
            <input
              id="isDefault"
              type="checkbox"
              checked={!!form.isDefault}
              onChange={e => setForm(f => ({ ...f, isDefault: e.target.checked }))}
              className="h-4 w-4 rounded border-gray-300"
            />
            <Label htmlFor="isDefault">{t('setAsDefault')}</Label>
          </div>
        </TabsContent>

        <TabsContent value="macros" className="space-y-3 mt-3">
          <p className="text-sm text-muted-foreground">B = białko, T = tłuszcz, W = węglowodany (suma musi = 100%)</p>
          {(['REDUCE', 'GAIN', 'MAINTAIN'] as const).map(g => (
            <MacroGoalRow
              key={g}
              goal={g}
              label={goalLabels[g]}
              ratios={form.macroRatios[g]}
              calAdj={form.caloricAdjustments[g]}
              onChangeRatio={(f, v) => setRatio(g, f, v)}
              onChangeAdj={v => setAdj(g, v)}
            />
          ))}
        </TabsContent>

        <TabsContent value="meals" className="mt-3">
          <MealDistEditor slots={form.mealDistribution} onChange={slots => setForm(f => ({ ...f, mealDistribution: slots }))} />
        </TabsContent>
      </Tabs>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="flex gap-2 pt-2">
        <Button onClick={handleSave} disabled={saving} className="flex-1">
          {saving ? 'Zapisuję...' : t('save')}
        </Button>
        <Button variant="outline" onClick={onClose}>{t('cancel')}</Button>
      </div>
    </div>
  );
}

// ─── AssignPanel ──────────────────────────────────────────────────────────────

function AssignPanel({ token, protocol, onClose }: {
  token: string;
  protocol: NutritionProtocol;
  onClose: () => void;
}) {
  const [assigned, setAssigned] = useState<ProtocolAssignedDietitian[]>([]);
  const [allDietitians, setAllDietitians] = useState<AdminDietitian[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [assignedRes, dietitiansRes] = await Promise.all([
        api.protocols.listAssigned(protocol.id, token),
        api.admin.listDietitians({ limit: 200 }, token),
      ]);
      setAssigned(assignedRes.assigned);
      setAllDietitians(dietitiansRes.dietitians);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Błąd ładowania');
    } finally {
      setLoading(false);
    }
  }, [token, protocol.id]);

  useEffect(() => { load(); }, [load]);

  const assignedIds = new Set(assigned.map(a => a.dietitianId));

  async function handleAssign(dietitianId: string) {
    setWorking(dietitianId); setError(null);
    try {
      await api.protocols.assign(protocol.id, dietitianId, token);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Błąd');
    } finally { setWorking(null); }
  }

  async function handleUnassign(dietitianId: string) {
    setWorking(dietitianId); setError(null);
    try {
      await api.protocols.unassign(protocol.id, dietitianId, token);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Błąd');
    } finally { setWorking(null); }
  }

  if (loading) return <p className="text-sm text-muted-foreground py-4">Ładowanie...</p>;

  return (
    <div className="space-y-4 py-2">
      <p className="text-sm text-muted-foreground">
        Przypisz protokół <strong>{protocol.name}</strong> do dietetyków.
      </p>
      {error && <p className="text-sm text-red-500">{error}</p>}
      <div className="divide-y">
        {allDietitians.map(d => {
          const isAssigned = assignedIds.has(d.userId);
          const a = assigned.find(a => a.dietitianId === d.userId);
          return (
            <div key={d.userId} className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-medium">{d.firstName} {d.lastName}</p>
                <p className="text-xs text-muted-foreground">{d.email}</p>
                {a?.isActive && <Badge variant="secondary" className="text-xs mt-0.5">Aktywny</Badge>}
              </div>
              {isAssigned ? (
                <Button variant="outline" size="sm" disabled={working === d.userId}
                  onClick={() => handleUnassign(d.userId)}>
                  Usuń przypisanie
                </Button>
              ) : (
                <Button size="sm" disabled={working === d.userId}
                  onClick={() => handleAssign(d.userId)}>
                  Przypisz
                </Button>
              )}
            </div>
          );
        })}
        {allDietitians.length === 0 && (
          <p className="text-sm text-muted-foreground py-2">Brak dietetyków w systemie.</p>
        )}
      </div>
      <Button variant="outline" className="w-full" onClick={onClose}>Zamknij</Button>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ProtocolsManager({ token }: Props) {
  const t = useTranslations('admin.protocols');
  const [protocols, setProtocols] = useState<NutritionProtocol[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [sheetMode, setSheetMode] = useState<'form' | 'assign' | null>(null);
  const [selected, setSelected] = useState<NutritionProtocol | undefined>(undefined);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.protocols.list(token);
      setProtocols(res.protocols);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Błąd ładowania');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  async function handleToggle(p: NutritionProtocol) {
    try {
      await api.protocols.toggle(p.id, !p.isActive, token);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Błąd');
    }
  }

  function openCreate() { setSelected(undefined); setSheetMode('form'); }
  function openEdit(p: NutritionProtocol) { setSelected(p); setSheetMode('form'); }
  function openAssign(p: NutritionProtocol) { setSelected(p); setSheetMode('assign'); }

  if (loading) return <div className="p-8 text-center text-muted-foreground">Ładowanie protokołów...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <p className="text-muted-foreground">{t('description')}</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          {t('addProtocol')}
        </Button>
      </div>

      {error && <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</div>}

      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left px-4 py-2 font-medium">Nazwa</th>
              <th className="text-center px-3 py-2 font-medium">v</th>
              <th className="text-center px-3 py-2 font-medium">Zakres</th>
              <th className="text-center px-3 py-2 font-medium">Domyślny</th>
              <th className="text-center px-3 py-2 font-medium">Status</th>
              <th className="text-left px-3 py-2 font-medium">Makro (Redukcja B/T/W)</th>
              <th className="text-right px-4 py-2 font-medium">Akcje</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {protocols.map(p => (
              <tr key={p.id} className={`hover:bg-muted/30 transition-colors ${!p.isActive ? 'opacity-50' : ''}`}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {p.isDefault && <Star className="h-3.5 w-3.5 text-yellow-500 fill-yellow-400" />}
                    <span className="font-medium">{p.name}</span>
                  </div>
                  {p.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{p.description}</p>}
                </td>
                <td className="px-3 py-3 text-center text-muted-foreground">{p.version}</td>
                <td className="px-3 py-3 text-center">
                  <Badge variant={p.scope === 'GLOBAL' ? 'default' : 'secondary'} className="text-xs">
                    {p.scope === 'GLOBAL' ? 'Globalny' : 'Dietetyk'}
                  </Badge>
                </td>
                <td className="px-3 py-3 text-center">
                  {p.isDefault
                    ? <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto" />
                    : <span className="text-muted-foreground text-xs">—</span>}
                </td>
                <td className="px-3 py-3 text-center">
                  <button onClick={() => handleToggle(p)} className="focus:outline-none">
                    {p.isActive
                      ? <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto" />
                      : <XCircle className="h-4 w-4 text-gray-400 mx-auto" />}
                  </button>
                </td>
                <td className="px-3 py-3 text-xs text-muted-foreground">
                  {p.macroRatios.REDUCE.proteinPct}% / {p.macroRatios.REDUCE.fatPct}% / {p.macroRatios.REDUCE.carbsPct}%
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex gap-1 justify-end">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(p)}
                      title="Edytuj">
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openAssign(p)}
                      title="Przypisz dietetyków">
                      <Users className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {protocols.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                  {t('noProtocols')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Sheet open={sheetMode !== null} onOpenChange={open => { if (!open) setSheetMode(null); }}>
        <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>
              {sheetMode === 'assign'
                ? `Przypisania: ${selected?.name}`
                : selected ? t('editProtocol') : t('addProtocol')}
            </SheetTitle>
          </SheetHeader>
          {sheetMode === 'form' && (
            <ProtocolForm
              token={token}
              initial={selected}
              onSave={() => { setSheetMode(null); load(); }}
              onClose={() => setSheetMode(null)}
            />
          )}
          {sheetMode === 'assign' && selected && (
            <AssignPanel
              token={token}
              protocol={selected}
              onClose={() => setSheetMode(null)}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
