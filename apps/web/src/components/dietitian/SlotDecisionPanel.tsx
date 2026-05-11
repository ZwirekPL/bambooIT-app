'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { api } from '@/lib/api';
import type { SlotDecision, DecisionConfidence } from '@/types/api';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronRight, Eye, EyeOff, Info } from 'lucide-react';

// ─── helpers ──────────────────────────────────────────────────────────────────

const CONFIDENCE_STYLES: Record<DecisionConfidence, { label: string; className: string }> = {
  HIGH:   { label: 'Pewny',     className: 'bg-green-100 text-green-800' },
  MEDIUM: { label: 'Umiarkowany', className: 'bg-amber-100 text-amber-800' },
  LOW:    { label: 'Niepewny',  className: 'bg-red-100 text-red-800' },
};

function ScoreBar({ label, value }: { label: string; value: number }) {
  const color = value >= 75 ? 'bg-green-500' : value >= 50 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-20 text-muted-foreground truncate">{label}</span>
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(value, 100)}%` }} />
      </div>
      <span className="w-8 text-right font-mono">{Math.round(value)}</span>
    </div>
  );
}

// ─── sub-components ───────────────────────────────────────────────────────────

function SlotDecisionCard({ decision }: { decision: SlotDecision }) {
  const [expanded, setExpanded] = useState(false);
  const conf = CONFIDENCE_STYLES[decision.confidence];

  if (!decision.chosen) {
    return (
      <div className="border rounded-lg p-3 bg-muted/30">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="font-medium">{decision.dayName}</span>
          <span>·</span>
          <span>{decision.mealType}</span>
          <Badge variant="outline" className="text-xs bg-red-50 text-red-700">
            {decision.scalingFailed ? 'Skalowanie nieudane' : 'Brak kandydatów'}
          </Badge>
        </div>
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Header — always visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 p-3 text-left hover:bg-muted/50 transition-colors"
      >
        {expanded ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
        <span className="text-sm font-medium">{decision.dayName}</span>
        <span className="text-xs text-muted-foreground">{decision.mealType}</span>
        <span className="text-xs text-muted-foreground mx-1">·</span>
        <span className="text-sm truncate flex-1">{decision.chosen.title}</span>
        <span className="text-xs font-mono text-muted-foreground">{decision.chosen.adjustedScore}</span>
        <Badge className={`text-[10px] ${conf.className}`}>{conf.label}</Badge>
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t p-3 space-y-3 bg-muted/20">
          {/* Score breakdown */}
          <div>
            <p className="text-xs font-medium mb-1.5">Score breakdown</p>
            <div className="space-y-1">
              <ScoreBar label="Nutrition" value={decision.chosen.scores.nutritionFit} />
              <ScoreBar label="Micro fit" value={decision.chosen.scores.microFit} />
              <ScoreBar label="Quality" value={decision.chosen.scores.quality} />
              <ScoreBar label="Rating" value={decision.chosen.scores.patientRating} />
              <ScoreBar label="Practical" value={decision.chosen.scores.practicalFit} />
              <ScoreBar label="Satiety" value={decision.chosen.scores.satietyProxy} />
              <ScoreBar label="Cuisine" value={decision.chosen.scores.cuisine} />
              <ScoreBar label="Diversity" value={decision.chosen.scores.diversity} />
              <ScoreBar label="Interaction" value={decision.chosen.scores.interaction} />
              <ScoreBar label="Compliance" value={decision.chosen.scores.compliance} />
              <ScoreBar label="Season" value={decision.chosen.scores.season} />
              <ScoreBar label="Cost" value={decision.chosen.scores.cost} />
            </div>
          </div>

          {/* Applied rules */}
          {decision.rulesApplied.length > 0 && (
            <div>
              <p className="text-xs font-medium mb-1">Zastosowane reguły</p>
              <div className="flex flex-wrap gap-1">
                {decision.rulesApplied.map((rule) => (
                  <Badge key={rule} variant="outline" className="text-[10px]">
                    {rule}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Runners-up */}
          {decision.runnersUp.length > 0 && (
            <div>
              <p className="text-xs font-medium mb-1">Alternatywy</p>
              <div className="space-y-1">
                {decision.runnersUp.map((ru) => (
                  <div key={ru.recipeId} className="flex items-center gap-2 text-xs">
                    <span className="truncate flex-1 text-muted-foreground">{ru.title}</span>
                    <span className="font-mono shrink-0">{ru.adjustedScore}</span>
                    <span className="text-muted-foreground truncate max-w-[200px]" title={ru.rejectionReason}>
                      {ru.rejectionReason}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <p className="text-[10px] text-muted-foreground">
            {decision.candidatesCount} kandydatów po filtrze
          </p>
        </div>
      )}
    </div>
  );
}

// ─── main panel ───────────────────────────────────────────────────────────────

interface SlotDecisionPanelProps {
  planId: string;
}

export function SlotDecisionPanel({ planId }: SlotDecisionPanelProps) {
  const { data: session } = useSession();
  const [visible, setVisible] = useState(false);
  const [decisions, setDecisions] = useState<SlotDecision[] | null>(null);
  const [inputHash, setInputHash] = useState<string | null>(null);
  const [generationMethod, setGenerationMethod] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleToggle = async () => {
    if (visible) {
      setVisible(false);
      return;
    }

    if (!decisions) {
      setLoading(true);
      try {
        const result = await api.dietPlans.getSlotDecisions(planId, '');
        setDecisions(result.slotDecisions);
        setInputHash(result.inputHash);
        setGenerationMethod(result.generationMethod);
      } catch {
        setDecisions([]);
      } finally {
        setLoading(false);
      }
    }

    setVisible(true);
  };

  // Only show for DB-generated plans
  return (
    <div className="space-y-3">
      <button
        onClick={handleToggle}
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        {visible ? 'Ukryj uzasadnienia' : 'Pokaż uzasadnienia wyboru'}
      </button>

      {visible && (
        <div className="space-y-2">
          {/* Meta info */}
          {(generationMethod || inputHash) && (
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <Info className="h-3.5 w-3.5" />
              {generationMethod && <span>Metoda: <strong>{generationMethod}</strong></span>}
              {inputHash && <span>Hash: <code className="bg-muted px-1 rounded">{inputHash}</code></span>}
            </div>
          )}

          {loading && <p className="text-sm text-muted-foreground">Ładowanie...</p>}

          {decisions && decisions.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Brak danych o decyzjach — plan wygenerowany przez AI lub przed wdrożeniem Fazy 72.
            </p>
          )}

          {decisions && decisions.length > 0 && (
            <div className="space-y-1.5">
              {decisions.map((d) => (
                <SlotDecisionCard
                  key={`${d.dayIndex}-${d.slotIndex}`}
                  decision={d}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
