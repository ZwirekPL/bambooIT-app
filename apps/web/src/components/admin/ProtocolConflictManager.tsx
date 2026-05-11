'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import type { ProtocolConflict, ProtocolConflictCreateData } from '@/types/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Pencil, Trash2, X, Check, Loader2, ShieldAlert, AlertTriangle } from 'lucide-react';

// ─── Constants ───────────────────────────────────────────────────────────────

const INTERVIEW_FIELDS = [
  'mainGoal', 'chronicDiseases', 'allergies', 'intolerances',
  'dietType', 'activityTypes', 'digestiveIssues', 'medications',
  'hormonalIssues', 'pregnancyStatus',
] as const;

// ─── Component ───────────────────────────────────────────────────────────────

interface Props {
  token: string;
}

interface FormData {
  triggerAField: string;
  triggerAValue: string;
  triggerBField: string;
  triggerBValue: string;
  severity: 'BLOCK' | 'WARN';
  messageKey: string;
  winnerSide: 'A' | 'B';
}

const emptyForm: FormData = {
  triggerAField: 'mainGoal',
  triggerAValue: '',
  triggerBField: 'chronicDiseases',
  triggerBValue: '',
  severity: 'BLOCK',
  messageKey: '',
  winnerSide: 'B',
};

export function ProtocolConflictManager({ token }: Props) {
  const t = useTranslations('admin.protocolConflicts');

  const [conflicts, setConflicts] = useState<ProtocolConflict[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Filters
  const [filterSeverity, setFilterSeverity] = useState<string>('');

  // Form
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.protocolConflicts.list({}, token);
      setConflicts(res.conflicts);
    } catch {
      setError('Nie udało się załadować danych');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const filtered = conflicts.filter(c => {
    if (filterSeverity && c.severity !== filterSeverity) return false;
    return true;
  });

  function openCreate() {
    setForm(emptyForm);
    setEditId(null);
    setShowForm(true);
    setError('');
  }

  function openEdit(c: ProtocolConflict) {
    setForm({
      triggerAField: c.triggerAField,
      triggerAValue: c.triggerAValue,
      triggerBField: c.triggerBField,
      triggerBValue: c.triggerBValue,
      severity: c.severity,
      messageKey: c.messageKey,
      winnerSide: c.winnerSide as 'A' | 'B',
    });
    setEditId(c.id);
    setShowForm(true);
    setError('');
  }

  function closeForm() {
    setShowForm(false);
    setEditId(null);
    setError('');
  }

  async function handleSave() {
    if (!form.triggerAValue.trim() || !form.triggerBValue.trim() || !form.messageKey.trim()) {
      setError('Uzupełnij wszystkie wymagane pola');
      return;
    }
    setSaving(true);
    setError('');
    try {
      if (editId) {
        await api.protocolConflicts.update(editId, form, token);
      } else {
        const data: ProtocolConflictCreateData = {
          ...form,
          isActive: true,
        };
        await api.protocolConflicts.create(data, token);
      }
      closeForm();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Błąd zapisu');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(c: ProtocolConflict) {
    try {
      await api.protocolConflicts.toggle(c.id, !c.isActive, token);
      setConflicts(prev => prev.map(x => x.id === c.id ? { ...x, isActive: !x.isActive } : x));
    } catch {
      setError('Nie udało się zmienić statusu');
    }
  }

  async function handleDelete(c: ProtocolConflict) {
    if (!confirm(`Usunąć konflikt ${c.triggerAField}:${c.triggerAValue} vs ${c.triggerBField}:${c.triggerBValue}?`)) return;
    try {
      await api.protocolConflicts.remove(c.id, token);
      setConflicts(prev => prev.filter(x => x.id !== c.id));
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
        <Select value={filterSeverity} onValueChange={setFilterSeverity}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder={t('filterSeverity')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('allSeverities')}</SelectItem>
            <SelectItem value="BLOCK">BLOCK</SelectItem>
            <SelectItem value="WARN">WARN</SelectItem>
          </SelectContent>
        </Select>

        {filterSeverity && (
          <Button variant="ghost" size="sm" onClick={() => setFilterSeverity('')}>
            <X className="h-4 w-4 mr-1" />
            {t('clearFilters')}
          </Button>
        )}
      </div>

      {/* Form */}
      {showForm && (
        <div className="rounded-lg border bg-card p-6 space-y-4">
          <h3 className="font-semibold">{editId ? t('editConflict') : t('addConflict')}</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3 p-4 rounded-lg bg-muted/30">
              <p className="text-sm font-medium text-muted-foreground">{t('sideA')}</p>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">{t('field')}</label>
                <Select value={form.triggerAField} onValueChange={v => setForm(f => ({ ...f, triggerAField: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {INTERVIEW_FIELDS.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">{t('value')}</label>
                <Input
                  value={form.triggerAValue}
                  onChange={e => setForm(f => ({ ...f, triggerAValue: e.target.value }))}
                  placeholder="np. BUILD_MUSCLE"
                />
              </div>
            </div>

            <div className="space-y-3 p-4 rounded-lg bg-muted/30">
              <p className="text-sm font-medium text-muted-foreground">{t('sideB')}</p>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">{t('field')}</label>
                <Select value={form.triggerBField} onValueChange={v => setForm(f => ({ ...f, triggerBField: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {INTERVIEW_FIELDS.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">{t('value')}</label>
                <Input
                  value={form.triggerBValue}
                  onChange={e => setForm(f => ({ ...f, triggerBValue: e.target.value }))}
                  placeholder="np. CKD_4_5"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">{t('severity')}</label>
              <Select value={form.severity} onValueChange={(v: 'BLOCK' | 'WARN') => setForm(f => ({ ...f, severity: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="BLOCK">BLOCK — blokuje generowanie</SelectItem>
                  <SelectItem value="WARN">WARN — ostrzeżenie</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">{t('messageKey')}</label>
              <Input
                value={form.messageKey}
                onChange={e => setForm(f => ({ ...f, messageKey: e.target.value }))}
                placeholder="np. conflicts.renal_mass"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">{t('winner')}</label>
              <Select value={form.winnerSide} onValueChange={(v: 'A' | 'B') => setForm(f => ({ ...f, winnerSide: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="B">B (choroba wygrywa)</SelectItem>
                  <SelectItem value="A">A</SelectItem>
                </SelectContent>
              </Select>
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
                <th className="text-left px-4 py-3 font-medium">{t('sideA')}</th>
                <th className="text-center px-4 py-3 font-medium">vs</th>
                <th className="text-left px-4 py-3 font-medium">{t('sideB')}</th>
                <th className="text-left px-4 py-3 font-medium">{t('severity')}</th>
                <th className="text-left px-4 py-3 font-medium">{t('messageKey')}</th>
                <th className="text-center px-4 py-3 font-medium">{t('winner')}</th>
                <th className="text-center px-4 py-3 font-medium">{t('active')}</th>
                <th className="text-right px-4 py-3 font-medium">{t('actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                    {t('empty')}
                  </td>
                </tr>
              ) : (
                filtered.map(c => (
                  <tr key={c.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-0.5">
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{c.triggerAField}</code>
                        <span className="text-xs font-medium">{c.triggerAValue}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center text-muted-foreground">vs</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-0.5">
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{c.triggerBField}</code>
                        <span className="text-xs font-medium">{c.triggerBValue}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {c.severity === 'BLOCK' ? (
                        <Badge variant="destructive" className="gap-1">
                          <ShieldAlert className="h-3 w-3" />
                          BLOCK
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-yellow-50 text-yellow-800 border-yellow-200 gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          WARN
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <code className="text-xs">{c.messageKey}</code>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge variant="outline">{c.winnerSide}</Badge>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggle(c)}
                        className={c.isActive ? 'text-green-700' : 'text-muted-foreground'}
                      >
                        {c.isActive ? 'ON' : 'OFF'}
                      </Button>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(c)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(c)}>
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        {t('total')}: {filtered.length} / {conflicts.length}
      </p>
    </div>
  );
}
