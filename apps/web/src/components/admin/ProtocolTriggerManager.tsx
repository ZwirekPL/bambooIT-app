'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import type { ProtocolTrigger, ProtocolTriggerCreateData, NutritionProtocol } from '@/types/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Pencil, Trash2, X, Check, Loader2 } from 'lucide-react';

// ─── Constants ───────────────────────────────────────────────────────────────

const INTERVIEW_FIELDS = [
  'mainGoal', 'chronicDiseases', 'allergies', 'intolerances',
  'dietType', 'activityTypes', 'digestiveIssues', 'medications',
  'hormonalIssues', 'cuisinePreferences', 'supplements',
  'pregnancyStatus', 'stressLevel', 'sleepHours', 'alcoholFrequency', 'workType', 'cookingTime',
] as const;

const PRIORITY_LABELS: Record<number, { label: string; color: string }> = {
  1: { label: 'Krytyczny (choroby)', color: 'bg-red-100 text-red-800' },
  2: { label: 'Wysoki (alergie)', color: 'bg-orange-100 text-orange-800' },
  3: { label: 'Normalny (preferencje)', color: 'bg-blue-100 text-blue-800' },
};

// ─── Component ───────────────────────────────────────────────────────────────

interface Props {
  token: string;
}

interface FormData {
  interviewField: string;
  interviewValue: string;
  protocolId: string;
  priority: number;
  score: number;
}

const emptyForm: FormData = {
  interviewField: 'mainGoal',
  interviewValue: '',
  protocolId: '',
  priority: 3,
  score: 1.0,
};

export function ProtocolTriggerManager({ token }: Props) {
  const t = useTranslations('admin.protocolTriggers');

  const [triggers, setTriggers] = useState<ProtocolTrigger[]>([]);
  const [protocols, setProtocols] = useState<NutritionProtocol[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Filters
  const [filterField, setFilterField] = useState<string>('');
  const [filterProtocol, setFilterProtocol] = useState<string>('');
  const [filterPriority, setFilterPriority] = useState<string>('');

  // Form
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [triggerRes, protocolRes] = await Promise.all([
        api.protocolTriggers.list({}, token),
        api.protocols.list(token),
      ]);
      setTriggers(triggerRes.triggers);
      setProtocols(protocolRes.protocols);
    } catch {
      setError('Nie udało się załadować danych');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const filtered = triggers.filter(tr => {
    if (filterField && tr.interviewField !== filterField) return false;
    if (filterProtocol && tr.protocolId !== filterProtocol) return false;
    if (filterPriority && tr.priority !== Number(filterPriority)) return false;
    return true;
  });

  function openCreate() {
    setForm(emptyForm);
    setEditId(null);
    setShowForm(true);
    setError('');
  }

  function openEdit(tr: ProtocolTrigger) {
    setForm({
      interviewField: tr.interviewField,
      interviewValue: tr.interviewValue,
      protocolId: tr.protocolId,
      priority: tr.priority,
      score: tr.score,
    });
    setEditId(tr.id);
    setShowForm(true);
    setError('');
  }

  function closeForm() {
    setShowForm(false);
    setEditId(null);
    setError('');
  }

  async function handleSave() {
    if (!form.interviewValue.trim() || !form.protocolId) {
      setError('Uzupełnij wszystkie wymagane pola');
      return;
    }
    setSaving(true);
    setError('');
    try {
      if (editId) {
        await api.protocolTriggers.update(editId, form, token);
      } else {
        const data: ProtocolTriggerCreateData = {
          ...form,
          isActive: true,
        };
        await api.protocolTriggers.create(data, token);
      }
      closeForm();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Błąd zapisu');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(tr: ProtocolTrigger) {
    try {
      await api.protocolTriggers.toggle(tr.id, !tr.isActive, token);
      setTriggers(prev => prev.map(t => t.id === tr.id ? { ...t, isActive: !t.isActive } : t));
    } catch {
      setError('Nie udało się zmienić statusu');
    }
  }

  async function handleDelete(tr: ProtocolTrigger) {
    if (!confirm(`Usunąć mapowanie ${tr.interviewField}:${tr.interviewValue} → ${tr.protocol.name}?`)) return;
    try {
      await api.protocolTriggers.remove(tr.id, token);
      setTriggers(prev => prev.filter(t => t.id !== tr.id));
    } catch {
      setError('Nie udało się usunąć');
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t('description')}</p>
        </div>
        <Button onClick={openCreate} size="sm">
          <Plus className="h-4 w-4 mr-1" />
          {t('add')}
        </Button>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select value={filterField} onValueChange={setFilterField}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder={t('filterField')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('allFields')}</SelectItem>
            {INTERVIEW_FIELDS.map(f => (
              <SelectItem key={f} value={f}>{f}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterProtocol} onValueChange={setFilterProtocol}>
          <SelectTrigger className="w-[240px]">
            <SelectValue placeholder={t('filterProtocol')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('allProtocols')}</SelectItem>
            {protocols.map(p => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterPriority} onValueChange={setFilterPriority}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder={t('filterPriority')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('allPriorities')}</SelectItem>
            <SelectItem value="1">{PRIORITY_LABELS[1].label}</SelectItem>
            <SelectItem value="2">{PRIORITY_LABELS[2].label}</SelectItem>
            <SelectItem value="3">{PRIORITY_LABELS[3].label}</SelectItem>
          </SelectContent>
        </Select>

        {(filterField || filterProtocol || filterPriority) && (
          <Button variant="ghost" size="sm" onClick={() => { setFilterField(''); setFilterProtocol(''); setFilterPriority(''); }}>
            <X className="h-4 w-4 mr-1" />
            {t('clearFilters')}
          </Button>
        )}
      </div>

      {/* Form */}
      {showForm && (
        <div className="rounded-lg border bg-card p-6 space-y-4">
          <h3 className="font-semibold">{editId ? t('editTrigger') : t('addTrigger')}</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">{t('field')}</label>
              <Select value={form.interviewField} onValueChange={v => setForm(f => ({ ...f, interviewField: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INTERVIEW_FIELDS.map(f => (
                    <SelectItem key={f} value={f}>{f}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">{t('value')}</label>
              <Input
                value={form.interviewValue}
                onChange={e => setForm(f => ({ ...f, interviewValue: e.target.value }))}
                placeholder="np. DIABETES_T2, LACTOSE, BUILD_MUSCLE"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">{t('protocol')}</label>
              <Select value={form.protocolId} onValueChange={v => setForm(f => ({ ...f, protocolId: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder={t('selectProtocol')} />
                </SelectTrigger>
                <SelectContent>
                  {protocols.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">{t('priority')}</label>
              <Select value={String(form.priority)} onValueChange={v => setForm(f => ({ ...f, priority: Number(v) }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">{PRIORITY_LABELS[1].label}</SelectItem>
                  <SelectItem value="2">{PRIORITY_LABELS[2].label}</SelectItem>
                  <SelectItem value="3">{PRIORITY_LABELS[3].label}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">{t('score')}</label>
              <Input
                type="number"
                step="0.1"
                min="0"
                max="1"
                value={form.score}
                onChange={e => setForm(f => ({ ...f, score: parseFloat(e.target.value) || 0 }))}
              />
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button onClick={handleSave} disabled={saving} size="sm">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Check className="h-4 w-4 mr-1" />}
              {editId ? t('save') : t('create')}
            </Button>
            <Button variant="outline" onClick={closeForm} size="sm">
              <X className="h-4 w-4 mr-1" />
              {t('cancel')}
            </Button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="rounded-lg border">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-3 font-medium">{t('field')}</th>
                <th className="text-left px-4 py-3 font-medium">{t('value')}</th>
                <th className="text-left px-4 py-3 font-medium">{t('protocol')}</th>
                <th className="text-left px-4 py-3 font-medium">{t('priority')}</th>
                <th className="text-center px-4 py-3 font-medium">{t('score')}</th>
                <th className="text-center px-4 py-3 font-medium">{t('active')}</th>
                <th className="text-right px-4 py-3 font-medium">{t('actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                    {t('empty')}
                  </td>
                </tr>
              ) : (
                filtered.map(tr => {
                  const prio = PRIORITY_LABELS[tr.priority] ?? PRIORITY_LABELS[3];
                  return (
                    <tr key={tr.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{tr.interviewField}</code>
                      </td>
                      <td className="px-4 py-3">
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{tr.interviewValue}</code>
                      </td>
                      <td className="px-4 py-3 font-medium">{tr.protocol.name}</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={prio.color}>
                          {prio.label}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-center">{tr.score}</td>
                      <td className="px-4 py-3 text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggle(tr)}
                          className={tr.isActive ? 'text-green-700' : 'text-muted-foreground'}
                        >
                          {tr.isActive ? 'ON' : 'OFF'}
                        </Button>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(tr)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(tr)}>
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        {t('total')}: {filtered.length} / {triggers.length}
      </p>
    </div>
  );
}
