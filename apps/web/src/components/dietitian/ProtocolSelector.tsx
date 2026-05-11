'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import type { DietitianProtocolWithAccess } from '@/types/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Star, ChevronDown, ChevronRight } from 'lucide-react';

interface Props { token: string }

function MacroBadge({ label, pct }: { label: string; pct: number }) {
  return (
    <span className="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{pct}%</span>
    </span>
  );
}

function ProtocolCard({ protocol, onSetActive, loading }: {
  protocol: DietitianProtocolWithAccess;
  onSetActive: (id: string) => void;
  loading: boolean;
}) {
  const t = useTranslations('dietitian.protocol');
  const [expanded, setExpanded] = useState(false);

  const r = protocol.macroRatios.REDUCE;

  return (
    <div className={`rounded-lg border p-4 transition-colors ${protocol.isActive ? 'border-sage-500 bg-sage-50/40' : 'border-border'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {protocol.isDefault && <Star className="h-4 w-4 text-yellow-500 fill-yellow-400 shrink-0" />}
            <h3 className="font-semibold text-base truncate">{protocol.name}</h3>
            {protocol.isActive && (
              <Badge className="bg-sage-600 text-white text-xs">{t('active')}</Badge>
            )}
            <Badge variant="outline" className="text-xs">v{protocol.version}</Badge>
          </div>
          {protocol.description && (
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{protocol.description}</p>
          )}
          <div className="flex gap-1.5 mt-2 flex-wrap">
            <MacroBadge label="B" pct={r.proteinPct} />
            <MacroBadge label="T" pct={r.fatPct} />
            <MacroBadge label="W" pct={r.carbsPct} />
            <span className="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              {protocol.defaultMealCount} {t('mealsPerDay')}
            </span>
          </div>
        </div>
        <div className="flex flex-col gap-2 shrink-0">
          {!protocol.isActive && (
            <Button size="sm" onClick={() => onSetActive(protocol.id)} disabled={loading}>
              <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
              {t('setActive')}
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => setExpanded(e => !e)} className="text-xs">
            {expanded ? <ChevronDown className="h-3.5 w-3.5 mr-1" /> : <ChevronRight className="h-3.5 w-3.5 mr-1" />}
            {t('details')}
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="mt-4 pt-4 border-t space-y-3 text-sm">
          <div>
            <p className="font-medium text-xs text-muted-foreground uppercase tracking-wide mb-2">{t('macrosAllGoals')}</p>
            <div className="grid grid-cols-3 gap-2">
              {(['REDUCE', 'GAIN', 'MAINTAIN'] as const).map(goal => {
                const macro = protocol.macroRatios[goal];
                const adj = protocol.caloricAdjustments[goal];
                const goalLabel = { REDUCE: 'Redukcja', GAIN: 'Masa', MAINTAIN: 'Utrzymanie' }[goal];
                return (
                  <div key={goal} className="rounded bg-muted/50 p-2">
                    <p className="text-xs font-medium mb-1">{goalLabel}</p>
                    <p className="text-xs text-muted-foreground">B: {macro.proteinPct}% / T: {macro.fatPct}% / W: {macro.carbsPct}%</p>
                    <p className="text-xs text-muted-foreground">Korekta: {adj > 0 ? '+' : ''}{adj}%</p>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <p className="font-medium text-xs text-muted-foreground uppercase tracking-wide mb-2">{t('mealDistribution')}</p>
            <div className="flex flex-wrap gap-1.5">
              {protocol.mealDistribution.map((m, i) => (
                <span key={i} className="rounded bg-muted px-2 py-0.5 text-xs">
                  {m.mealName}: {m.pct}%
                </span>
              ))}
            </div>
          </div>

          {protocol.foodRestrictions.length > 0 && (
            <div>
              <p className="font-medium text-xs text-muted-foreground uppercase tracking-wide mb-2">{t('restrictions')}</p>
              <div className="space-y-1">
                {protocol.foodRestrictions.map((r, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Badge
                      variant={r.level === 'HARD_BLOCK' ? 'destructive' : r.level === 'STRONG' ? 'secondary' : 'outline'}
                      className="text-xs"
                    >
                      {r.level === 'HARD_BLOCK' ? 'ZAKAZ' : r.level === 'STRONG' ? 'SILNY' : 'MIĘKKI'}
                    </Badge>
                    <span className="text-xs">{r.category}</span>
                    <span className="text-xs text-muted-foreground">— {r.reason}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {protocol.systemPromptAdditions && (
            <div>
              <p className="font-medium text-xs text-muted-foreground uppercase tracking-wide mb-1">{t('aiInstructions')}</p>
              <p className="text-xs text-muted-foreground bg-muted/50 rounded p-2">{protocol.systemPromptAdditions}</p>
            </div>
          )}

          <div>
            <p className="font-medium text-xs text-muted-foreground uppercase tracking-wide mb-1">{t('proteinRange')}</p>
            <p className="text-xs">{protocol.minProteinPerKg}–{protocol.maxProteinPerKg} g/kg mc.</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function ProtocolSelector({ token }: Props) {
  const t = useTranslations('dietitian.protocol');
  const [protocols, setProtocols] = useState<DietitianProtocolWithAccess[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.dietitianProtocol.listMy(token);
      setProtocols(res.protocols);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Błąd ładowania');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  async function handleSetActive(protocolId: string) {
    setWorking(true); setError(null); setSuccess(null);
    try {
      await api.dietitianProtocol.setActive(protocolId, token);
      setSuccess(t('setActiveSuccess'));
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Błąd');
    } finally {
      setWorking(false);
    }
  }

  const active = protocols.find(p => p.isActive);

  if (loading) return <div className="p-8 text-center text-muted-foreground">Ładowanie protokołów...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <p className="text-muted-foreground">{t('description')}</p>
      </div>

      {active && (
        <div className="rounded-lg bg-sage-50 border border-sage-200 px-4 py-3 text-sm flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-sage-600 shrink-0" />
          <span>{t('currentlyUsing')} <strong>{active.name}</strong></span>
        </div>
      )}

      {error && <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</div>}
      {success && <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-700">{success}</div>}

      {protocols.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          <p className="font-medium">{t('noProtocols')}</p>
          <p className="text-sm mt-1">{t('noProtocolsHint')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {protocols.map(p => (
            <ProtocolCard
              key={p.id}
              protocol={p}
              onSetActive={handleSetActive}
              loading={working}
            />
          ))}
        </div>
      )}
    </div>
  );
}
