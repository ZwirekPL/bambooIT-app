'use client';

import { useState } from 'react';
import { Plus, X, Pill, Ban, Tag, Target, Activity, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ClinicalRule, ClinicalRuleSource, ClinicalRuleType, RuleSeverity } from '@/types/api';

// ─── Constants (shared with manager) ─────────────────────────────────────────

export const RULE_CATEGORIES = [
  'metabolic', 'cardio', 'liver', 'hepatic', 'digestive', 'kidney', 'renal',
  'endocrine', 'bone', 'oncology', 'deficiency', 'eating-disorder',
  'drug-interaction', 'allergen', 'intolerance',
] as const;

export const CATEGORY_LABELS: Record<typeof RULE_CATEGORIES[number], string> = {
  metabolic: 'Metaboliczne',
  cardio: 'Kardiologiczne',
  liver: 'Wątrobowe',
  hepatic: 'Wątrobowe (czerwone flagi)',
  digestive: 'Żołądkowo-jelitowe',
  kidney: 'Nerkowe',
  renal: 'Nerkowe (czerwone flagi)',
  endocrine: 'Endokrynologiczne',
  bone: 'Kostne',
  oncology: 'Onkologiczne',
  deficiency: 'Niedobory',
  'eating-disorder': 'Zaburzenia odżywiania',
  'drug-interaction': 'Interakcje lekowe',
  allergen: 'Alergie',
  intolerance: 'Nietolerancje',
};

// ─── Form Data Type ───────────────────────────────────────────────────────────

export interface RuleFormData {
  name: string;
  description: string;
  type: ClinicalRuleType;
  severity: RuleSeverity;
  priority: number;
  condition: Record<string, unknown>;
  effects: Record<string, unknown>[];
  redFlagMessage: string;
  source: string;
  version: string;
  sources: ClinicalRuleSource[];
  conflictsWith: string;
  category: string;
}

function defaultCondition(): Record<string, unknown> {
  return { type: 'HAS_CONDITION', terms: [] };
}

export function ruleToFormData(rule?: ClinicalRule): RuleFormData {
  if (!rule) {
    return {
      name: '', description: '', type: 'POLICY', severity: 'LOW', priority: 50,
      condition: defaultCondition(), effects: [], redFlagMessage: '',
      source: '', version: '1.0', sources: [], conflictsWith: '', category: '',
    };
  }
  const isRedFlag = rule.type === 'RED_FLAG';
  const eff = rule.effects;
  return {
    name: rule.name,
    description: rule.description,
    type: rule.type,
    severity: rule.severity,
    priority: rule.priority,
    condition: rule.conditions as Record<string, unknown>,
    effects: isRedFlag ? [] : (Array.isArray(eff) ? eff as Record<string, unknown>[] : []),
    redFlagMessage: isRedFlag && eff && !Array.isArray(eff) ? (eff as { message?: string }).message ?? '' : '',
    source: rule.source ?? '',
    version: rule.version,
    sources: rule.sources ?? [],
    conflictsWith: rule.conflictsWith.join(', '),
    category: rule.category ?? '',
  };
}

// ─── Tags Input ───────────────────────────────────────────────────────────────

function TagsInput({ tags, onChange, placeholder = 'Wpisz i naciśnij Enter' }: {
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
}) {
  const [input, setInput] = useState('');

  function addTag() {
    const val = input.trim();
    if (val && !tags.includes(val)) onChange([...tags, val]);
    setInput('');
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') { e.preventDefault(); addTag(); }
    if (e.key === 'Backspace' && !input && tags.length > 0) onChange(tags.slice(0, -1));
  }

  return (
    <div className="flex flex-wrap gap-1.5 rounded-md border border-input bg-background p-2 min-h-[40px]">
      {tags.map(tag => (
        <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 bg-muted rounded text-xs">
          {tag}
          <button type="button" onClick={() => onChange(tags.filter(t => t !== tag))} className="hover:text-destructive">
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <input
        className="flex-1 min-w-[120px] bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={addTag}
        placeholder={tags.length === 0 ? placeholder : ''}
      />
    </div>
  );
}

// ─── Condition Display ────────────────────────────────────────────────────────

const CONDITION_LABELS: Record<string, string> = {
  HAS_CONDITION: 'Ma chorobę/problem',
  HAS_ALLERGY: 'Ma alergię na',
  HAS_DIET: 'Stosuje dietę',
  HAS_HORMONAL_ISSUE: 'Problem hormonalny',
  FIELD_COMPARE: 'Porównanie wartości',
  FIELD_EQUALS: 'Pole równa się',
  HAS_MEDICATIONS: 'Przyjmuje leki',
  HAS_STAGE: 'Stadium choroby',
  AGE_RANGE: 'Przedział wiekowy',
  HAS_SURGERY: 'Przebyta operacja',
  HAS_MEDICATION: 'Przyjmuje lek',
  AND: 'WSZYSTKIE z',
  OR: 'KTÓRAKOLWIEK z',
};

const OPERATOR_LABELS: Record<string, string> = { LT: '<', LTE: '≤', GT: '>', GTE: '≥', EQ: '=' };
const FIELD_LABELS: Record<string, string> = {
  bmi: 'BMI', ageYears: 'Wiek', targetKcal: 'Cel kcal',
  weightKg: 'Waga (kg)', heightCm: 'Wzrost (cm)', chronicDiseasesCount: 'Liczba chorób',
  pregnancyStatus: 'Status ciąży', goal: 'Cel', sex: 'Płeć', dietType: 'Typ diety',
};

export function ConditionDisplay({ cond }: { cond: Record<string, unknown> }) {
  const type = cond.type as string;
  const terms = cond.terms as string[] | undefined;

  if (type === 'AND' || type === 'OR') {
    const subs = (cond.conditions as Record<string, unknown>[]) || [];
    return (
      <div className="space-y-1">
        <span className="text-xs font-semibold text-muted-foreground">{CONDITION_LABELS[type]}:</span>
        <div className="pl-3 border-l-2 border-sage-200 space-y-1">
          {subs.map((c, i) => <ConditionDisplay key={i} cond={c} />)}
        </div>
      </div>
    );
  }
  if (type === 'FIELD_COMPARE') {
    return (
      <span className="text-sm">
        <span className="font-medium">{FIELD_LABELS[cond.field as string] || cond.field as string}</span>
        {' '}{OPERATOR_LABELS[cond.operator as string] || cond.operator as string}{' '}
        <span className="font-medium">{cond.value as number}</span>
      </span>
    );
  }
  if (type === 'FIELD_EQUALS') {
    return (
      <span className="text-sm">
        <span className="font-medium">{FIELD_LABELS[cond.field as string] || cond.field as string}</span>
        {' = '}
        <span className="font-medium">{cond.value as string}</span>
      </span>
    );
  }
  if (type === 'HAS_MEDICATIONS') {
    return <span className="text-sm font-medium">Przyjmuje jakiekolwiek leki</span>;
  }
  if (type === 'AGE_RANGE') {
    const min = cond.min as number | undefined;
    const max = cond.max as number | undefined;
    return (
      <span className="text-sm">
        Wiek: {min !== undefined ? `od ${min}` : ''}{max !== undefined ? ` do ${max}` : ''} lat
      </span>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-1">
      <span className="text-xs text-muted-foreground">{CONDITION_LABELS[type] || type}:</span>
      {terms?.map(t => (
        <span key={t} className="inline-flex px-1.5 py-0.5 bg-muted rounded text-[11px]">{t}</span>
      ))}
    </div>
  );
}

// ─── Effects Display ──────────────────────────────────────────────────────────

const NOTE_STYLES: Record<string, string> = {
  RESTRICTION: 'bg-red-50 border-red-200 text-red-800',
  WARNING: 'bg-orange-50 border-orange-200 text-orange-800',
  RECOMMENDATION: 'bg-blue-50 border-blue-200 text-blue-800',
  INFO: 'bg-gray-50 border-gray-200 text-gray-700',
};
const NOTE_LABELS: Record<string, string> = {
  RESTRICTION: 'Ograniczenie', WARNING: 'Ostrzeżenie',
  RECOMMENDATION: 'Zalecenie', INFO: 'Info',
};

function EffectDisplay({ effect }: { effect: Record<string, unknown> }) {
  const type = effect.type as string;

  if (type === 'CLINICAL_NOTE') {
    const cat = effect.category as string;
    return (
      <div className={`rounded-md border px-3 py-2 text-xs ${NOTE_STYLES[cat] || NOTE_STYLES.INFO}`}>
        <span className="font-semibold">{NOTE_LABELS[cat] || cat}: </span>
        {effect.note as string}
      </div>
    );
  }
  if (type === 'EXCLUDE_KEYWORDS') {
    const kws = effect.keywords as string[];
    return (
      <div>
        <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground mb-1">
          <Ban className="h-3 w-3" /> Wyklucz słowa kluczowe
        </div>
        <div className="flex flex-wrap gap-1">
          {kws.map(k => (
            <span key={k} className="px-1.5 py-0.5 bg-red-50 text-red-700 border border-red-200 rounded text-[11px]">{k}</span>
          ))}
        </div>
      </div>
    );
  }
  if (type === 'SUGGEST_SUPPLEMENT') {
    return (
      <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-xs">
        <div className="flex items-center gap-1 font-semibold text-green-800 mb-0.5">
          <Pill className="h-3 w-3" /> Suplement: {effect.name as string}
        </div>
        <div className="text-green-700">Dawka: <span className="font-medium">{effect.dose as string}</span></div>
        {effect.reason != null && <div className="text-green-700 mt-0.5">{String(effect.reason)}</div>}
      </div>
    );
  }
  if (type === 'MODIFY_TARGETS') {
    const OP: Record<string, string> = { SET: '=', MULTIPLY: '×', ADD: '+', MAX: 'maks.', MIN: 'min.' };
    const FLDS: Record<string, string> = {
      targetKcal: 'Cel kcal', targetProteinG: 'Białko (g)',
      targetFatG: 'Tłuszcz (g)', targetCarbsG: 'Węglowodany (g)',
    };
    return (
      <div className="flex items-center gap-1.5 text-xs">
        <Target className="h-3 w-3 text-purple-600" />
        <span className="font-medium text-purple-700">Modyfikacja celu:</span>
        <span>{FLDS[effect.field as string] || effect.field as string}</span>
        <span className="font-bold">{OP[effect.operation as string] || effect.operation as string}</span>
        <span className="font-medium">{effect.value as number}</span>
      </div>
    );
  }
  if (type === 'NUTRIENT_LIMIT') {
    return (
      <div className="flex items-center gap-1.5 text-xs">
        <Activity className="h-3 w-3 text-blue-600" />
        <span className="font-medium text-blue-700">Limit składnika:</span>
        <span>{effect.nutrient as string}</span>
        {effect.min !== undefined && <span>min: {effect.min as number}</span>}
        {effect.max !== undefined && <span>maks: {effect.max as number}</span>}
        <span className="text-muted-foreground">({effect.scope as string})</span>
      </div>
    );
  }
  if (type === 'MEAL_DISTRIBUTION') {
    return (
      <div className="flex items-center gap-1.5 text-xs">
        <Zap className="h-3 w-3 text-yellow-600" />
        <span className="font-medium text-yellow-700">Rozkład posiłków:</span>
        <span>{effect.nutrient as string} maks. {effect.maxPerMealPct as number}% / posiłek</span>
      </div>
    );
  }
  if (type === 'EXCLUDE_PRODUCTS' || type === 'PREFER_PRODUCTS') {
    return (
      <div className="flex items-center gap-1.5 text-xs">
        <Tag className="h-3 w-3 text-orange-600" />
        <span className="font-medium">{type === 'EXCLUDE_PRODUCTS' ? 'Wyklucz produkty' : 'Preferuj produkty'}:</span>
        <span>{effect.flagKey as string} = {String(effect.flagValue)}</span>
      </div>
    );
  }
  return (
    <div className="text-xs text-muted-foreground rounded bg-muted/50 px-2 py-1">
      {type}: {JSON.stringify(effect)}
    </div>
  );
}

export function EffectsDisplay({ effects }: {
  effects: Array<Record<string, unknown>> | Record<string, unknown> | null | undefined;
}) {
  if (!effects) return null;
  if (!Array.isArray(effects)) {
    const msg = (effects as { message?: string }).message;
    return msg ? (
      <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
        <span className="font-semibold">Komunikat: </span>{msg}
      </div>
    ) : null;
  }
  return (
    <div className="space-y-2">
      {(effects as Record<string, unknown>[]).map((e, i) => <EffectDisplay key={i} effect={e} />)}
    </div>
  );
}

// ─── Condition Builder ────────────────────────────────────────────────────────

const TERMS_TYPES = ['HAS_CONDITION', 'HAS_ALLERGY', 'HAS_DIET', 'HAS_HORMONAL_ISSUE', 'HAS_STAGE', 'HAS_SURGERY', 'HAS_MEDICATION'];

function SingleConditionEditor({ value, onChange }: {
  value: Record<string, unknown>;
  onChange: (v: Record<string, unknown>) => void;
}) {
  const type = value.type as string;

  function changeType(newType: string) {
    if (TERMS_TYPES.includes(newType)) { onChange({ type: newType, terms: value.terms ?? [] }); return; }
    if (newType === 'FIELD_COMPARE') { onChange({ type: 'FIELD_COMPARE', field: 'bmi', operator: 'LT', value: 18.5 }); return; }
    if (newType === 'FIELD_EQUALS') { onChange({ type: 'FIELD_EQUALS', field: 'goal', value: '' }); return; }
    if (newType === 'AGE_RANGE') { onChange({ type: 'AGE_RANGE' }); return; }
    onChange({ type: newType });
  }

  return (
    <div className="space-y-2">
      <select value={type} onChange={e => changeType(e.target.value)}
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
        <option value="HAS_CONDITION">Ma chorobę/problem</option>
        <option value="HAS_ALLERGY">Ma alergię</option>
        <option value="HAS_DIET">Stosuje dietę</option>
        <option value="HAS_HORMONAL_ISSUE">Problem hormonalny</option>
        <option value="HAS_STAGE">Stadium choroby</option>
        <option value="HAS_SURGERY">Przebyta operacja</option>
        <option value="HAS_MEDICATION">Przyjmuje lek (z listy)</option>
        <option value="HAS_MEDICATIONS">Przyjmuje jakiekolwiek leki</option>
        <option value="FIELD_COMPARE">Porównaj wartość (BMI, wiek...)</option>
        <option value="FIELD_EQUALS">Pole równa się</option>
        <option value="AGE_RANGE">Przedział wiekowy</option>
      </select>

      {TERMS_TYPES.includes(type) && (
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Słowa kluczowe (Enter = dodaj)</label>
          <TagsInput
            tags={(value.terms as string[]) || []}
            onChange={terms => onChange({ ...value, terms })}
          />
        </div>
      )}

      {type === 'FIELD_COMPARE' && (
        <div className="flex gap-2">
          <select value={value.field as string} onChange={e => onChange({ ...value, field: e.target.value })}
            className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm">
            <option value="bmi">BMI</option>
            <option value="ageYears">Wiek</option>
            <option value="targetKcal">Cel kcal</option>
            <option value="weightKg">Waga (kg)</option>
            <option value="heightCm">Wzrost (cm)</option>
            <option value="chronicDiseasesCount">Liczba chorób</option>
          </select>
          <select value={value.operator as string} onChange={e => onChange({ ...value, operator: e.target.value })}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm">
            <option value="LT">&lt;</option>
            <option value="LTE">≤</option>
            <option value="GT">&gt;</option>
            <option value="GTE">≥</option>
            <option value="EQ">=</option>
          </select>
          <Input type="number" step="0.1" className="w-24"
            value={value.value as number}
            onChange={e => onChange({ ...value, value: Number(e.target.value) })} />
        </div>
      )}

      {type === 'FIELD_EQUALS' && (
        <div className="flex gap-2">
          <select value={value.field as string} onChange={e => onChange({ ...value, field: e.target.value })}
            className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm">
            <option value="pregnancyStatus">Status ciąży</option>
            <option value="goal">Cel</option>
            <option value="sex">Płeć</option>
            <option value="dietType">Typ diety</option>
          </select>
          <Input className="flex-1" placeholder="wartość"
            value={value.value as string}
            onChange={e => onChange({ ...value, value: e.target.value })} />
        </div>
      )}

      {type === 'AGE_RANGE' && (
        <div className="flex gap-2 items-center">
          <label className="text-sm shrink-0">Od:</label>
          <Input type="number" className="w-20" placeholder="min"
            value={(value.min as number) ?? ''}
            onChange={e => onChange({ ...value, min: e.target.value ? Number(e.target.value) : undefined })} />
          <label className="text-sm shrink-0">Do:</label>
          <Input type="number" className="w-20" placeholder="max"
            value={(value.max as number) ?? ''}
            onChange={e => onChange({ ...value, max: e.target.value ? Number(e.target.value) : undefined })} />
          <span className="text-sm text-muted-foreground">lat</span>
        </div>
      )}
    </div>
  );
}

function ConditionBuilder({ value, onChange }: {
  value: Record<string, unknown>;
  onChange: (v: Record<string, unknown>) => void;
}) {
  const type = value.type as string;
  const isLogical = type === 'AND' || type === 'OR';
  const subs = isLogical ? (value.conditions as Record<string, unknown>[]) || [] : [];

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Button type="button" size="sm" variant={!isLogical ? 'sage' : 'outline'} className="text-xs"
          onClick={() => onChange(defaultCondition())}>
          Pojedynczy
        </Button>
        <Button type="button" size="sm" variant={type === 'AND' ? 'sage' : 'outline'} className="text-xs"
          onClick={() => isLogical ? onChange({ ...value, type: 'AND' }) : onChange({ type: 'AND', conditions: [value] })}>
          ORAZ (AND)
        </Button>
        <Button type="button" size="sm" variant={type === 'OR' ? 'sage' : 'outline'} className="text-xs"
          onClick={() => isLogical ? onChange({ ...value, type: 'OR' }) : onChange({ type: 'OR', conditions: [value] })}>
          LUB (OR)
        </Button>
      </div>

      {isLogical ? (
        <div className="space-y-2 pl-3 border-l-2 border-sage-200">
          {subs.map((c, i) => (
            <div key={i} className="flex gap-2 items-start">
              <div className="flex-1">
                <SingleConditionEditor value={c} onChange={updated => {
                  const next = [...subs]; next[i] = updated;
                  onChange({ ...value, conditions: next });
                }} />
              </div>
              {subs.length > 1 && (
                <Button type="button" size="sm" variant="ghost" className="mt-1 hover:text-destructive"
                  onClick={() => onChange({ ...value, conditions: subs.filter((_, j) => j !== i) })}>
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
          <Button type="button" size="sm" variant="outline" className="gap-1.5 text-xs"
            onClick={() => onChange({ ...value, conditions: [...subs, defaultCondition()] })}>
            <Plus className="h-3.5 w-3.5" /> Dodaj warunek
          </Button>
        </div>
      ) : (
        <SingleConditionEditor value={value} onChange={onChange} />
      )}
    </div>
  );
}

// ─── Effect Builder ───────────────────────────────────────────────────────────

const EFFECT_TYPES = [
  { value: 'CLINICAL_NOTE', label: 'Notatka kliniczna' },
  { value: 'EXCLUDE_KEYWORDS', label: 'Wyklucz słowa kluczowe' },
  { value: 'SUGGEST_SUPPLEMENT', label: 'Sugeruj suplement' },
  { value: 'MODIFY_TARGETS', label: 'Modyfikuj cel (kcal/makro)' },
  { value: 'NUTRIENT_LIMIT', label: 'Limit składnika odżywczego' },
  { value: 'MEAL_DISTRIBUTION', label: 'Rozkład posiłków' },
  { value: 'EXCLUDE_PRODUCTS', label: 'Wyklucz produkty (flaga)' },
  { value: 'PREFER_PRODUCTS', label: 'Preferuj produkty (flaga)' },
];

const NUTRIENTS = ['kcal', 'protein', 'fat', 'carbs', 'fiber', 'sugar', 'salt', 'saturatedFat', 'sodium', 'cholesterol', 'potassium', 'purines', 'phosphorus', 'calcium'];

function defaultEffect(type: string): Record<string, unknown> {
  switch (type) {
    case 'CLINICAL_NOTE': return { type, note: '', category: 'RESTRICTION' };
    case 'EXCLUDE_KEYWORDS': return { type, keywords: [] };
    case 'SUGGEST_SUPPLEMENT': return { type, name: '', dose: '', reason: '' };
    case 'MODIFY_TARGETS': return { type, field: 'targetKcal', operation: 'SET', value: 2000 };
    case 'NUTRIENT_LIMIT': return { type, nutrient: 'sodium', scope: 'DAILY_TOTAL', max: 2300 };
    case 'MEAL_DISTRIBUTION': return { type, nutrient: 'carbs', maxPerMealPct: 33 };
    case 'EXCLUDE_PRODUCTS': return { type, flagKey: 'glutenFree', flagValue: false };
    case 'PREFER_PRODUCTS': return { type, flagKey: 'glutenFree', flagValue: true };
    default: return { type };
  }
}

function EffectEditor({ effect, onChange, onRemove }: {
  effect: Record<string, unknown>;
  onChange: (v: Record<string, unknown>) => void;
  onRemove: () => void;
}) {
  const type = effect.type as string;

  return (
    <div className="rounded-md border border-border p-3 space-y-2 bg-muted/20">
      <div className="flex gap-2 items-center">
        <select value={type} onChange={e => onChange(defaultEffect(e.target.value))}
          className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm">
          {EFFECT_TYPES.map(et => <option key={et.value} value={et.value}>{et.label}</option>)}
        </select>
        <Button type="button" size="sm" variant="ghost" onClick={onRemove} className="hover:text-destructive shrink-0">
          <X className="h-4 w-4" />
        </Button>
      </div>

      {type === 'CLINICAL_NOTE' && (
        <div className="space-y-2">
          <select value={effect.category as string} onChange={e => onChange({ ...effect, category: e.target.value })}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
            <option value="RESTRICTION">Ograniczenie</option>
            <option value="WARNING">Ostrzeżenie</option>
            <option value="RECOMMENDATION">Zalecenie</option>
            <option value="INFO">Info</option>
          </select>
          <textarea value={effect.note as string} onChange={e => onChange({ ...effect, note: e.target.value })}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px] resize-y"
            placeholder="Treść notatki klinicznej..." />
        </div>
      )}

      {type === 'EXCLUDE_KEYWORDS' && (
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Słowa do wykluczenia (Enter = dodaj)</label>
          <TagsInput tags={(effect.keywords as string[]) || []} onChange={keywords => onChange({ ...effect, keywords })} />
        </div>
      )}

      {type === 'SUGGEST_SUPPLEMENT' && (
        <div className="space-y-2">
          <Input placeholder="Nazwa suplementu (np. Witamina D3)" value={effect.name as string}
            onChange={e => onChange({ ...effect, name: e.target.value })} />
          <Input placeholder="Dawka (np. 2000 IU/d)" value={effect.dose as string}
            onChange={e => onChange({ ...effect, dose: e.target.value })} />
          <textarea value={effect.reason as string} onChange={e => onChange({ ...effect, reason: e.target.value })}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[60px] resize-y"
            placeholder="Powód suplementacji..." />
        </div>
      )}

      {type === 'MODIFY_TARGETS' && (
        <div className="flex gap-2 flex-wrap">
          <select value={effect.field as string} onChange={e => onChange({ ...effect, field: e.target.value })}
            className="flex-1 min-w-[140px] rounded-md border border-input bg-background px-3 py-2 text-sm">
            <option value="targetKcal">Cel kcal</option>
            <option value="targetProteinG">Białko (g)</option>
            <option value="targetFatG">Tłuszcz (g)</option>
            <option value="targetCarbsG">Węglowodany (g)</option>
          </select>
          <select value={effect.operation as string} onChange={e => onChange({ ...effect, operation: e.target.value })}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm">
            <option value="SET">Ustaw (=)</option>
            <option value="ADD">Dodaj (+)</option>
            <option value="MULTIPLY">Mnóż (×)</option>
            <option value="MAX">Maks.</option>
            <option value="MIN">Min.</option>
          </select>
          <Input type="number" className="w-28" value={effect.value as number}
            onChange={e => onChange({ ...effect, value: Number(e.target.value) })} />
        </div>
      )}

      {type === 'NUTRIENT_LIMIT' && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <select value={effect.nutrient as string} onChange={e => onChange({ ...effect, nutrient: e.target.value })}
              className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm">
              {NUTRIENTS.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            <select value={effect.scope as string} onChange={e => onChange({ ...effect, scope: e.target.value })}
              className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm">
              <option value="DAILY_TOTAL">Dzienna suma</option>
              <option value="PER_100G">Na 100g</option>
            </select>
          </div>
          <div className="flex gap-2 items-center">
            <label className="text-sm">Min:</label>
            <Input type="number" className="w-24" placeholder="—"
              value={(effect.min as number) ?? ''}
              onChange={e => onChange({ ...effect, min: e.target.value ? Number(e.target.value) : undefined })} />
            <label className="text-sm">Maks:</label>
            <Input type="number" className="w-24" placeholder="—"
              value={(effect.max as number) ?? ''}
              onChange={e => onChange({ ...effect, max: e.target.value ? Number(e.target.value) : undefined })} />
          </div>
        </div>
      )}

      {type === 'MEAL_DISTRIBUTION' && (
        <div className="flex gap-2 items-center flex-wrap">
          <select value={effect.nutrient as string} onChange={e => onChange({ ...effect, nutrient: e.target.value })}
            className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm">
            {['kcal', 'protein', 'fat', 'carbs', 'fiber', 'sugar'].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
          <label className="text-sm shrink-0">maks. % / posiłek:</label>
          <Input type="number" min={1} max={100} className="w-20"
            value={effect.maxPerMealPct as number}
            onChange={e => onChange({ ...effect, maxPerMealPct: Number(e.target.value) })} />
        </div>
      )}

      {(type === 'EXCLUDE_PRODUCTS' || type === 'PREFER_PRODUCTS') && (
        <div className="flex gap-2 items-center">
          <Input placeholder="Klucz flagi (np. glutenFree)" className="flex-1"
            value={effect.flagKey as string}
            onChange={e => onChange({ ...effect, flagKey: e.target.value })} />
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={effect.flagValue as boolean}
              onChange={e => onChange({ ...effect, flagValue: e.target.checked })} />
            flaga = true
          </label>
        </div>
      )}
    </div>
  );
}

function EffectsBuilder({ effects, onChange }: {
  effects: Record<string, unknown>[];
  onChange: (effects: Record<string, unknown>[]) => void;
}) {
  return (
    <div className="space-y-2">
      {effects.map((e, i) => (
        <EffectEditor key={i} effect={e}
          onChange={updated => { const next = [...effects]; next[i] = updated; onChange(next); }}
          onRemove={() => onChange(effects.filter((_, j) => j !== i))} />
      ))}
      <Button type="button" size="sm" variant="outline" className="gap-1.5 text-xs w-full"
        onClick={() => onChange([...effects, defaultEffect('CLINICAL_NOTE')])}>
        <Plus className="h-3.5 w-3.5" /> Dodaj efekt
      </Button>
    </div>
  );
}

// ─── Sources Editor ───────────────────────────────────────────────────────────

function SourcesEditor({ sources, onChange }: {
  sources: ClinicalRuleSource[];
  onChange: (s: ClinicalRuleSource[]) => void;
}) {
  return (
    <div className="space-y-2">
      {sources.map((s, i) => (
        <div key={i} className="flex gap-2 items-center">
          <Input placeholder="Referencja (np. PTD 2024)" className="flex-1" value={s.ref}
            onChange={e => { const n = [...sources]; n[i] = { ...s, ref: e.target.value }; onChange(n); }} />
          <Input type="number" className="w-20" placeholder="Rok" value={s.year ?? ''}
            onChange={e => { const n = [...sources]; n[i] = { ...s, year: e.target.value ? Number(e.target.value) : undefined }; onChange(n); }} />
          <Button type="button" size="sm" variant="ghost" className="hover:text-destructive shrink-0"
            onClick={() => onChange(sources.filter((_, j) => j !== i))}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button type="button" size="sm" variant="outline" className="gap-1.5 text-xs"
        onClick={() => onChange([...sources, { ref: '' }])}>
        <Plus className="h-3.5 w-3.5" /> Dodaj źródło
      </Button>
    </div>
  );
}

// ─── Rule Form ────────────────────────────────────────────────────────────────

export function RuleForm({ initial, onSave, onCancel, isNew }: {
  initial?: ClinicalRule;
  onSave: (data: RuleFormData) => Promise<void>;
  onCancel: () => void;
  isNew: boolean;
}) {
  const [form, setForm] = useState<RuleFormData>(() => ruleToFormData(initial));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await onSave(form);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Błąd zapisu');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="border-sage-200">
      <CardHeader>
        <CardTitle className="text-base">{isNew ? 'Nowa reguła' : 'Edytuj regułę'}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">{error}</div>
          )}

          {/* Podstawowe */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Nazwa</label>
              <Input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Kategoria</label>
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                <option value="">—</option>
                {RULE_CATEGORIES.map(cat => <option key={cat} value={cat}>{CATEGORY_LABELS[cat]}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Opis</label>
            <textarea required value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[60px] resize-y" />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {isNew && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Typ</label>
                <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as ClinicalRuleType }))}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <option value="POLICY">Polityka</option>
                  <option value="RED_FLAG">Czerwona flaga</option>
                </select>
              </div>
            )}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Waga</label>
              <select value={form.severity} onChange={e => setForm(f => ({ ...f, severity: e.target.value as RuleSeverity }))}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                <option value="CRITICAL">Krytyczna</option>
                <option value="HIGH">Wysoka</option>
                <option value="MODERATE">Umiarkowana</option>
                <option value="LOW">Niska</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Priorytet</label>
              <Input type="number" min={0} max={200} value={form.priority}
                onChange={e => setForm(f => ({ ...f, priority: Number(e.target.value) }))} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Wersja</label>
              <Input placeholder="1.0" value={form.version}
                onChange={e => setForm(f => ({ ...f, version: e.target.value }))} />
            </div>
          </div>

          {/* Warunek */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Warunek aktywacji</label>
            <div className="rounded-md border border-input p-3 bg-muted/20">
              <ConditionBuilder value={form.condition} onChange={condition => setForm(f => ({ ...f, condition }))} />
            </div>
          </div>

          {/* Efekty */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              {form.type === 'RED_FLAG' ? 'Komunikat czerwonej flagi' : 'Efekty'}
            </label>
            {form.type === 'RED_FLAG' ? (
              <textarea value={form.redFlagMessage} onChange={e => setForm(f => ({ ...f, redFlagMessage: e.target.value }))}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px] resize-y"
                placeholder="Komunikat wyświetlany dietetykowi..." />
            ) : (
              <EffectsBuilder effects={form.effects} onChange={effects => setForm(f => ({ ...f, effects }))} />
            )}
          </div>

          {/* Dodatkowe */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Źródło (ogólne)</label>
              <Input placeholder="np. PTD 2023" value={form.source}
                onChange={e => setForm(f => ({ ...f, source: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Konflikty z regułami</label>
              <Input placeholder="Reguła A, Reguła B" value={form.conflictsWith}
                onChange={e => setForm(f => ({ ...f, conflictsWith: e.target.value }))} />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Źródła naukowe</label>
            <SourcesEditor sources={form.sources} onChange={sources => setForm(f => ({ ...f, sources }))} />
          </div>

          <div className="flex gap-2 justify-end pt-2 border-t border-border">
            <Button type="button" variant="outline" onClick={onCancel}>Anuluj</Button>
            <Button type="submit" variant="sage" disabled={saving}>{saving ? '...' : 'Zapisz'}</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
