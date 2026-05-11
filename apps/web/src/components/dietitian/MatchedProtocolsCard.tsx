'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import type {
  MatchedProtocolEntry,
  DetectedConflictEntry,
  MergedProtocolSummary,
} from '@/types/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Crosshair,
  AlertTriangle,
  ShieldAlert,
  ChevronDown,
  ChevronRight,
  Layers,
  Info,
} from 'lucide-react';

interface Props {
  patientId: string;
  token: string;
}

// ─── Priority labels ─────────────────────────────────────────────────────────

const PRIORITY_STYLES: Record<number, { label: string; className: string }> = {
  1: { label: 'Choroby', className: 'bg-red-100 text-red-800' },
  2: { label: 'Alergie', className: 'bg-amber-100 text-amber-800' },
  3: { label: 'Preferencje', className: 'bg-blue-100 text-blue-800' },
};

// ─── Field label mapping ─────────────────────────────────────────────────────

const FIELD_LABELS: Record<string, string> = {
  mainGoal: 'Cel główny',
  chronicDiseases: 'Choroby przewlekłe',
  allergies: 'Alergie',
  intolerances: 'Nietolerancje',
  dietType: 'Typ diety',
  activityTypes: 'Aktywność',
  digestiveIssues: 'Problemy trawienne',
  medications: 'Leki',
  hormonalIssues: 'Hormony',
  cuisinePreferences: 'Kuchnia',
  supplements: 'Suplementy',
  pregnancyStatus: 'Ciąża',
  stressLevel: 'Stres',
  sleepHours: 'Sen',
  alcoholFrequency: 'Alkohol',
  workType: 'Praca',
  cookingTime: 'Czas gotowania',
};

function MacroBadge({ label, pct }: { label: string; pct: number }) {
  return (
    <span className="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{pct}%</span>
    </span>
  );
}

export function MatchedProtocolsCard({ patientId, token }: Props) {
  const t = useTranslations('dietitian.patientDetail');

  const [loading, setLoading] = useState(true);
  const [matchedProtocols, setMatchedProtocols] = useState<MatchedProtocolEntry[]>([]);
  const [conflicts, setConflicts] = useState<DetectedConflictEntry[]>([]);
  const [mergedProtocol, setMergedProtocol] = useState<MergedProtocolSummary | null>(null);
  const [hasBlockingConflict, setHasBlockingConflict] = useState(false);
  const [showMerged, setShowMerged] = useState(false);
  const [noInterview, setNoInterview] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const result = await api.dietitianProtocol.matchedProtocols(patientId, token);
        if (cancelled) return;

        if (!result.interviewId) {
          setNoInterview(true);
          return;
        }

        setMatchedProtocols(result.matchedProtocols);
        setConflicts(result.conflicts);
        setMergedProtocol(result.mergedProtocol);
        setHasBlockingConflict(result.hasBlockingConflict ?? false);
      } catch {
        // Silently fail — non-critical section
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [patientId, token]);

  if (loading) {
    return (
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Crosshair className="h-4 w-4" />
            {t('matchedProtocolsTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-16 flex items-center justify-center">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-sage-600 border-t-transparent" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (noInterview) {
    return (
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Crosshair className="h-4 w-4" />
            {t('matchedProtocolsTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{t('matchedProtocolsNoInterview')}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Crosshair className="h-4 w-4" />
          {t('matchedProtocolsTitle')}
          {matchedProtocols.length > 0 && (
            <span className="text-sm font-normal text-muted-foreground">
              ({matchedProtocols.length})
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Conflicts */}
        {conflicts.length > 0 && (
          <div className="space-y-2">
            {conflicts.map((c) => (
              <div
                key={c.conflictId}
                className={`rounded-lg border px-3 py-2 text-sm flex items-start gap-2 ${
                  c.severity === 'BLOCK'
                    ? 'border-red-200 bg-red-50 text-red-800'
                    : 'border-amber-200 bg-amber-50 text-amber-800'
                }`}
              >
                {c.severity === 'BLOCK' ? (
                  <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0" />
                ) : (
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                )}
                <div>
                  <span className="font-medium">
                    {c.severity === 'BLOCK' ? t('conflictBlock') : t('conflictWarn')}:
                  </span>{' '}
                  {FIELD_LABELS[c.triggerAField] ?? c.triggerAField}={c.triggerAValue}{' '}
                  <span className="text-muted-foreground">vs</span>{' '}
                  {FIELD_LABELS[c.triggerBField] ?? c.triggerBField}={c.triggerBValue}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Matched protocols list */}
        {matchedProtocols.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('matchedProtocolsEmpty')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {t('colProtocolName')}
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {t('colTrigger')}
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {t('colPriority')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {matchedProtocols.map((mp) => {
                  const pStyle = PRIORITY_STYLES[mp.priority] ?? PRIORITY_STYLES[3];
                  return (
                    <tr
                      key={`${mp.protocolId}-${mp.interviewField}-${mp.interviewValue}`}
                      className="border-b border-border last:border-0"
                    >
                      <td className="px-3 py-2 font-medium">{mp.protocolName}</td>
                      <td className="px-3 py-2 text-muted-foreground">
                        <span className="text-xs">
                          {FIELD_LABELS[mp.interviewField] ?? mp.interviewField}
                        </span>
                        <span className="mx-1">=</span>
                        <Badge variant="outline" className="text-xs">
                          {mp.interviewValue}
                        </Badge>
                      </td>
                      <td className="px-3 py-2">
                        <Badge className={`text-xs pointer-events-none ${pStyle.className}`}>
                          {pStyle.label}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Merged protocol details (collapsible) */}
        {mergedProtocol && (
          <div className="border rounded-lg">
            <button
              type="button"
              className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium hover:bg-muted/30 transition-colors"
              onClick={() => setShowMerged(!showMerged)}
            >
              {showMerged ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
              <Layers className="h-4 w-4 text-muted-foreground" />
              {t('mergedProtocolTitle')}
              {mergedProtocol.sourceProtocols.length > 1 && (
                <span className="text-xs text-muted-foreground">
                  ({mergedProtocol.sourceProtocols.length} {t('mergedProtocolSources')})
                </span>
              )}
            </button>

            {showMerged && (
              <div className="px-3 pb-3 space-y-3 border-t">
                {/* Macro ratios */}
                <div className="pt-3">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                    {t('mergedMacros')} (REDUCE)
                  </p>
                  <div className="flex gap-1.5 flex-wrap">
                    <MacroBadge label="B" pct={mergedProtocol.macroRatios.REDUCE.proteinPct} />
                    <MacroBadge label="T" pct={mergedProtocol.macroRatios.REDUCE.fatPct} />
                    <MacroBadge label="W" pct={mergedProtocol.macroRatios.REDUCE.carbsPct} />
                  </div>
                </div>

                {/* Protein range */}
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                    {t('mergedProtein')}
                  </p>
                  <p className="text-sm">
                    {mergedProtocol.minProteinPerKg}–{mergedProtocol.maxProteinPerKg} g/kg
                  </p>
                </div>

                {/* Food restrictions */}
                {mergedProtocol.foodRestrictions.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                      {t('mergedRestrictions')}
                    </p>
                    <div className="flex gap-1.5 flex-wrap">
                      {mergedProtocol.foodRestrictions.map((r) => (
                        <Badge
                          key={r.category}
                          variant="outline"
                          className={`text-xs ${
                            r.level === 'HARD_BLOCK'
                              ? 'border-red-300 text-red-700'
                              : r.level === 'STRONG'
                                ? 'border-amber-300 text-amber-700'
                                : 'border-gray-300 text-gray-600'
                          }`}
                        >
                          {r.category}
                          <span className="ml-1 opacity-60">
                            ({r.level === 'HARD_BLOCK' ? 'ZAKAZ' : r.level === 'STRONG' ? 'SILNY' : 'MIĘKKI'})
                          </span>
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Avoid categories */}
                {mergedProtocol.avoidFoodCategories.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                      {t('mergedAvoid')}
                    </p>
                    <div className="flex gap-1.5 flex-wrap">
                      {mergedProtocol.avoidFoodCategories.map((a) => (
                        <Badge key={a.category} variant="outline" className="text-xs">
                          {a.category}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Source protocols */}
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                    {t('mergedSourceProtocols')}
                  </p>
                  <ul className="text-xs text-muted-foreground space-y-0.5">
                    {mergedProtocol.sourceProtocols.map((sp) => (
                      <li key={sp.id} className="flex items-center gap-1">
                        <Info className="h-3 w-3" />
                        <span className="font-medium text-foreground">{sp.name}</span>
                        {sp.triggerField !== 'dietitianOverride' && (
                          <span>
                            ({FIELD_LABELS[sp.triggerField] ?? sp.triggerField}={sp.triggerValue})
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
