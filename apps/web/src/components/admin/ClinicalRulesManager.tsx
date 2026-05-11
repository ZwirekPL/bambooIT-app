'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Plus, Search, Shield, AlertTriangle, ChevronDown, ChevronUp, History, Trash2, Power, PowerOff, Pencil, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import type { ClinicalRule, ClinicalRuleType, RuleSeverity, ClinicalRuleHistory } from '@/types/api';
import { RuleForm, ConditionDisplay, EffectsDisplay, RULE_CATEGORIES, CATEGORY_LABELS, ruleToFormData } from './ClinicalRuleForm';
import type { RuleFormData } from './ClinicalRuleForm';

// ─── Severity config ──────────────────────────────────────────────────────────

const SEVERITY_COLORS: Record<RuleSeverity, string> = {
  CRITICAL: 'bg-red-100 text-red-800 border-red-200',
  HIGH: 'bg-orange-100 text-orange-800 border-orange-200',
  MODERATE: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  LOW: 'bg-blue-100 text-blue-800 border-blue-200',
};

const SEVERITY_LABELS: Record<RuleSeverity, string> = {
  CRITICAL: 'Krytyczna', HIGH: 'Wysoka', MODERATE: 'Umiarkowana', LOW: 'Niska',
};

// ─── Rule Row ─────────────────────────────────────────────────────────────────

function RuleRow({ rule, token, onUpdated }: {
  rule: ClinicalRule;
  token: string;
  onUpdated: () => void;
}) {
  const t = useTranslations('admin.clinicalRules');
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<ClinicalRuleHistory[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  async function handleToggleActive() {
    const msg = rule.isActive ? t('confirmDeactivate') : t('confirmActivate');
    if (!confirm(msg)) return;
    await api.clinicalRules.toggleActive(rule.id, !rule.isActive, token);
    onUpdated();
  }

  async function handleDelete() {
    if (rule.isDefault) { alert(t('cannotDeleteDefault')); return; }
    if (!confirm(t('confirmDelete'))) return;
    await api.clinicalRules.remove(rule.id, token);
    onUpdated();
  }

  async function handleLoadHistory() {
    if (showHistory) { setShowHistory(false); return; }
    setHistoryLoading(true);
    try {
      const data = await api.clinicalRules.getHistory(rule.id, token);
      setHistory(data);
      setShowHistory(true);
    } finally {
      setHistoryLoading(false);
    }
  }

  async function handleSaveEdit(form: RuleFormData) {
    const conflictsArr = form.conflictsWith.trim()
      ? form.conflictsWith.split(',').map(s => s.trim()).filter(Boolean)
      : [];
    const effectsData = form.type === 'RED_FLAG'
      ? { message: form.redFlagMessage }
      : form.effects;
    await api.clinicalRules.update(rule.id, {
      name: form.name,
      description: form.description,
      severity: form.severity,
      priority: form.priority,
      conditions: form.condition,
      effects: effectsData,
      source: form.source || null,
      version: form.version || '1.0',
      sources: form.sources.length > 0 ? form.sources : null,
      conflictsWith: conflictsArr,
      category: form.category || null,
    }, token);
    setEditing(false);
    onUpdated();
  }

  if (editing) {
    return <RuleForm initial={rule} onSave={handleSaveEdit} onCancel={() => setEditing(false)} isNew={false} />;
  }

  const catLabel = rule.category
    ? (CATEGORY_LABELS as Record<string, string>)[rule.category] ?? rule.category
    : null;

  return (
    <div className={`rounded-lg border ${rule.isActive ? 'border-border' : 'border-border/50 opacity-60'} bg-card`}>
      {/* Header row */}
      <div className="flex items-center gap-3 px-4 py-3 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="shrink-0">
          {rule.type === 'RED_FLAG'
            ? <AlertTriangle className="h-4 w-4 text-red-500" />
            : <Shield className="h-4 w-4 text-sage-600" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium truncate">{rule.name}</span>
            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${SEVERITY_COLORS[rule.severity]}`}>
              {SEVERITY_LABELS[rule.severity]}
            </Badge>
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              {rule.type === 'RED_FLAG' ? 'Czerwona flaga' : 'Polityka'}
            </Badge>
            {rule.isDefault && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-sage-50">{t('default')}</Badge>
            )}
            {catLabel && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-purple-50 text-purple-700 border-purple-200">
                {catLabel}
              </Badge>
            )}
            {!rule.isActive && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-muted">{t('inactive')}</Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground truncate mt-0.5">{rule.description}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <span className="text-xs text-muted-foreground mr-2">v{rule.version} | P:{rule.priority}</span>
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-border px-4 py-4 space-y-4">

          {/* Condition */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Warunek aktywacji</p>
            <div className="rounded-md bg-muted/30 px-3 py-2">
              <ConditionDisplay cond={rule.conditions as Record<string, unknown>} />
            </div>
          </div>

          {/* Effects */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              {rule.type === 'RED_FLAG' ? 'Komunikat' : 'Efekty'}
            </p>
            <EffectsDisplay effects={rule.effects as Array<Record<string, unknown>> | Record<string, unknown>} />
          </div>

          {/* Sources */}
          {rule.sources && rule.sources.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Źródła</p>
              <ul className="space-y-0.5">
                {rule.sources.map((s, i) => (
                  <li key={i} className="text-xs text-foreground">
                    {s.url
                      ? <a href={s.url} target="_blank" rel="noopener noreferrer" className="underline">{s.ref}</a>
                      : s.ref}
                    {s.year && <span className="text-muted-foreground ml-1">({s.year})</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {rule.source && (
            <p className="text-xs text-muted-foreground">Źródło: {rule.source}</p>
          )}

          {rule.conflictsWith.length > 0 && (
            <p className="text-xs text-orange-600">
              Konflikty z: {rule.conflictsWith.join(', ')}
            </p>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-2 border-t border-border/50 flex-wrap">
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setEditing(true)}>
              <Pencil className="h-3.5 w-3.5" /> Edytuj
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={handleToggleActive}>
              {rule.isActive ? <PowerOff className="h-3.5 w-3.5" /> : <Power className="h-3.5 w-3.5" />}
              {rule.isActive ? 'Dezaktywuj' : 'Aktywuj'}
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={handleLoadHistory} disabled={historyLoading}>
              <History className="h-3.5 w-3.5" /> Historia
            </Button>
            {!rule.isDefault && (
              <Button size="sm" variant="outline" className="gap-1.5 text-destructive hover:text-destructive" onClick={handleDelete}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>

          {/* History */}
          {showHistory && (
            <div className="space-y-2 pt-2 border-t border-border/50">
              <p className="text-xs font-medium text-muted-foreground">{t('history')}</p>
              {history.length === 0 ? (
                <p className="text-xs text-muted-foreground">Brak historii zmian</p>
              ) : (
                history.map(h => (
                  <div key={h.id} className="rounded-md border border-border/50 px-3 py-2 text-xs space-y-0.5">
                    <div className="flex justify-between text-muted-foreground">
                      <span>{h.changedBy ?? 'system'}</span>
                      <span>{new Date(h.createdAt).toLocaleString('pl-PL')}</span>
                    </div>
                    <p>{h.changeSummary}</p>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Manager ─────────────────────────────────────────────────────────────

export function ClinicalRulesManager({ token }: { token: string }) {
  const t = useTranslations('admin.clinicalRules');

  const [rules, setRules] = useState<ClinicalRule[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<ClinicalRuleType | ''>('');
  const [severityFilter, setSeverityFilter] = useState<RuleSeverity | ''>('');
  const [activeFilter, setActiveFilter] = useState<'true' | 'false' | ''>('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  const fetchRules = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = { page, limit: 50 };
      if (typeFilter) params.type = typeFilter;
      if (severityFilter) params.severity = severityFilter;
      if (activeFilter) params.isActive = activeFilter === 'true';
      if (categoryFilter) params.category = categoryFilter;
      if (search.trim()) params.search = search.trim();
      const data = await api.clinicalRules.list(params as Parameters<typeof api.clinicalRules.list>[0], token);
      setRules(data.rules);
      setTotal(data.total);
    } finally {
      setLoading(false);
    }
  }, [token, page, typeFilter, severityFilter, activeFilter, categoryFilter, search]);

  useEffect(() => { fetchRules(); }, [fetchRules]);

  async function handleCreate(form: RuleFormData) {
    const conflictsArr = form.conflictsWith.trim()
      ? form.conflictsWith.split(',').map(s => s.trim()).filter(Boolean)
      : undefined;
    const effectsData = form.type === 'RED_FLAG'
      ? { message: form.redFlagMessage }
      : form.effects;
    await api.clinicalRules.create({
      name: form.name,
      description: form.description,
      type: form.type,
      severity: form.severity,
      priority: form.priority,
      conditions: form.condition,
      effects: effectsData,
      source: form.source || undefined,
      version: form.version || '1.0',
      sources: form.sources.length > 0 ? form.sources : undefined,
      conflictsWith: conflictsArr,
      category: form.category || undefined,
    }, token);
    setShowCreate(false);
    fetchRules();
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">{t('description')}</p>
        </div>
        <Button variant="sage" className="gap-2" onClick={() => setShowCreate(!showCreate)}>
          {showCreate ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showCreate ? t('cancel') : t('addRule')}
        </Button>
      </div>

      {/* Create form */}
      {showCreate && (
        <RuleForm onSave={handleCreate} onCancel={() => setShowCreate(false)} isNew />
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder={t('search')}
            className="pl-9"
          />
        </div>

        <select value={typeFilter} onChange={e => { setTypeFilter(e.target.value as ClinicalRuleType | ''); setPage(1); }}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm">
          <option value="">Wszystkie typy</option>
          <option value="POLICY">Polityka</option>
          <option value="RED_FLAG">Czerwona flaga</option>
        </select>

        <select value={severityFilter} onChange={e => { setSeverityFilter(e.target.value as RuleSeverity | ''); setPage(1); }}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm">
          <option value="">Wszystkie wagi</option>
          <option value="CRITICAL">Krytyczna</option>
          <option value="HIGH">Wysoka</option>
          <option value="MODERATE">Umiarkowana</option>
          <option value="LOW">Niska</option>
        </select>

        <select value={activeFilter} onChange={e => { setActiveFilter(e.target.value as 'true' | 'false' | ''); setPage(1); }}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm">
          <option value="">Wszystkie statusy</option>
          <option value="true">Aktywne</option>
          <option value="false">Nieaktywne</option>
        </select>

        <select value={categoryFilter} onChange={e => { setCategoryFilter(e.target.value); setPage(1); }}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm">
          <option value="">Wszystkie kategorie</option>
          {RULE_CATEGORIES.map(cat => (
            <option key={cat} value={cat}>{CATEGORY_LABELS[cat]}</option>
          ))}
        </select>
      </div>

      {/* Stats */}
      <p className="text-xs text-muted-foreground">
        {total} {total === 1 ? 'reguła' : total < 5 ? 'reguły' : 'reguł'}
      </p>

      {/* Rules list */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Ładowanie...</div>
      ) : rules.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">{t('noRules')}</div>
      ) : (
        <div className="space-y-2">
          {rules.map(rule => (
            <RuleRow key={rule.id} rule={rule} token={token} onUpdated={fetchRules} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {total > 50 && (
        <div className="flex justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Poprzednia</Button>
          <span className="text-sm text-muted-foreground self-center">{page} / {Math.ceil(total / 50)}</span>
          <Button variant="outline" size="sm" disabled={page >= Math.ceil(total / 50)} onClick={() => setPage(p => p + 1)}>Następna</Button>
        </div>
      )}
    </div>
  );
}
