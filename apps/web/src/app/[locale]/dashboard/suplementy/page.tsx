'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import { useSession } from 'next-auth/react';
import type { SupplementPrescription, SupplementCompliance } from '@/types/api';
import { Pill, CheckCircle2, XCircle, Flame, Clock } from 'lucide-react';

const FREQUENCY_LABELS: Record<string, string> = {
  daily: 'Codziennie',
  twice_daily: '2× dziennie',
  three_times_daily: '3× dziennie',
  weekly: 'Raz w tygodniu',
  as_needed: 'W razie potrzeby',
};

export default function SupplementsPage() {
  const { data: session } = useSession();
  const token = (session?.user as { backendToken?: string })?.backendToken ?? '';

  const [supplements, setSupplements] = useState<SupplementPrescription[]>([]);
  const [compliance, setCompliance] = useState<SupplementCompliance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    Promise.all([
      api.supplements.list(token),
      api.supplements.compliance(token),
    ]).then(([suppRes, compRes]) => {
      setSupplements(suppRes.supplements);
      setCompliance(compRes.compliance);
    }).catch(console.error).finally(() => setLoading(false));
  }, [token]);

  const active = supplements.filter((s) => s.active);
  const inactive = supplements.filter((s) => !s.active);

  function getCompliance(id: string): SupplementCompliance | undefined {
    return compliance.find((c) => c.supplementId === id);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
        Ładowanie suplementów...
      </div>
    );
  }

  if (active.length === 0) {
    return (
      <div className="space-y-4 max-w-2xl">
        <h1 className="text-xl font-semibold">Suplementy</h1>
        <Card className="border-border">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            <Pill className="h-8 w-8 mx-auto mb-3 opacity-30" />
            Brak aktywnych suplementów.<br />
            Dietetyk przepisze Ci suplementy, jeśli będzie taka potrzeba.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-xl font-semibold">Suplementy</h1>

      {/* Active supplements */}
      <div className="space-y-3">
        {active.map((supp) => {
          const comp = getCompliance(supp.id);
          return (
            <Card key={supp.id} className="border-border">
              <CardContent className="py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Pill className="h-4 w-4 text-brand-green shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-sm">{supp.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {supp.dose} {supp.unit} · {FREQUENCY_LABELS[supp.frequency] ?? supp.frequency}
                      </p>
                    </div>
                  </div>
                  <Badge className="bg-green-100 text-green-800 text-xs shrink-0">Aktywny</Badge>
                </div>

                {comp && comp.totalCheckIns > 0 && (
                  <div className="mt-3 pt-3 border-t border-border grid grid-cols-3 gap-3">
                    <ComplianceStat
                      icon={<CheckCircle2 className="h-3.5 w-3.5 text-green-600" />}
                      label="Regularność"
                      value={`${comp.compliancePct}%`}
                      highlight={comp.compliancePct >= 80}
                    />
                    <ComplianceStat
                      icon={<Flame className="h-3.5 w-3.5 text-orange-500" />}
                      label="Seria"
                      value={`${comp.streak} dni`}
                    />
                    <ComplianceStat
                      icon={<Clock className="h-3.5 w-3.5 text-muted-foreground" />}
                      label="Ostatnio"
                      value={comp.lastTaken ? new Date(comp.lastTaken).toLocaleDateString('pl-PL') : '—'}
                    />
                  </div>
                )}

                {comp && comp.compliancePct < 60 && comp.totalCheckIns >= 3 && (
                  <p className="mt-2 text-xs text-amber-700 bg-amber-50 rounded px-2 py-1">
                    Regularność poniżej 60% — staraj się przyjmować suplement każdego dnia.
                  </p>
                )}

                {supp.notes && (
                  <p className="mt-2 text-xs text-muted-foreground italic">{supp.notes}</p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Inactive supplements */}
      {inactive.length > 0 && (
        <div>
          <p className="text-sm font-medium text-muted-foreground mb-2">Zakończone</p>
          <div className="space-y-2">
            {inactive.map((supp) => (
              <Card key={supp.id} className="border-border opacity-60">
                <CardContent className="py-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <XCircle className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm line-through text-muted-foreground">{supp.label}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {supp.endDate ? new Date(supp.endDate).toLocaleDateString('pl-PL') : '—'}
                  </span>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ComplianceStat({ icon, label, value, highlight }: { icon: React.ReactNode; label: string; value: string; highlight?: boolean }) {
  return (
    <div className="text-center">
      <div className="flex items-center justify-center gap-1 mb-0.5">{icon}</div>
      <p className={`text-sm font-semibold ${highlight ? 'text-green-700' : ''}`}>{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
