'use client';

import { useState } from 'react';
import type { DietPlanRevision, DietPlanRevisionDetail } from '@/types/api';
import { api } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp, History } from 'lucide-react';

// ─── reason badge ─────────────────────────────────────────────────────────────

const REASON_STYLE: Record<string, { label: string; className: string }> = {
  AI_GENERATED: { label: 'Wygenerowany przez AI',  className: 'bg-violet-100 text-violet-800' },
  AUTO_ADJUST:  { label: 'Auto-korekta',           className: 'bg-amber-100  text-amber-800'  },
  DIETITIAN_EDIT: { label: 'Edycja dietetyka',     className: 'bg-blue-100   text-blue-800'   },
  PUBLISHED:    { label: 'Opublikowany',            className: 'bg-green-100  text-green-800'  },
};

function ReasonBadge({ reason }: { reason: string }) {
  const s = REASON_STYLE[reason] ?? { label: reason, className: 'bg-muted text-muted-foreground' };
  return (
    <Badge className={`text-xs font-medium pointer-events-none ${s.className}`}>
      {s.label}
    </Badge>
  );
}

// ─── single row ───────────────────────────────────────────────────────────────

function RevisionRow({ revision, token }: { revision: DietPlanRevision; token: string }) {
  const [expanded, setExpanded] = useState(false);
  const [detail, setDetail] = useState<DietPlanRevisionDetail | null>(null);
  const [loading, setLoading] = useState(false);

  async function loadDetail() {
    if (detail) { setExpanded(v => !v); return; }
    setLoading(true);
    try {
      const res = await api.dietPlans.getRevision(revision.id, token);
      setDetail(res.revision);
      setExpanded(true);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }

  return (
    <div className="border rounded-md overflow-hidden">
      <button
        onClick={loadDetail}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-sm hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-3 flex-wrap">
          <span className="font-mono text-xs text-muted-foreground w-6 shrink-0">
            #{revision.revisionNumber}
          </span>
          <ReasonBadge reason={revision.reason} />
          <span className="text-muted-foreground">
            {new Date(revision.createdAt).toLocaleString('pl-PL')}
          </span>
        </div>
        {loading ? (
          <span className="text-xs text-muted-foreground">Ładowanie...</span>
        ) : expanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
      </button>

      {expanded && detail && (
        <div className="border-t bg-muted/30 px-4 py-3">
          <pre className="text-xs overflow-auto max-h-64 whitespace-pre-wrap break-all">
            {JSON.stringify(detail.contentJson, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

// ─── main component ───────────────────────────────────────────────────────────

interface RevisionHistoryProps {
  revisions: DietPlanRevision[];
  token: string;
}

export function RevisionHistory({ revisions, token }: RevisionHistoryProps) {
  const [collapsed, setCollapsed] = useState(true);

  if (revisions.length === 0) return null;

  return (
    <section className="space-y-3">
      <button
        onClick={() => setCollapsed(v => !v)}
        className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        <History className="h-4 w-4" />
        Historia wersji ({revisions.length})
        {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
      </button>

      {!collapsed && (
        <div className="space-y-2">
          {revisions.map((r) => (
            <RevisionRow key={r.id} revision={r} token={token} />
          ))}
        </div>
      )}
    </section>
  );
}
