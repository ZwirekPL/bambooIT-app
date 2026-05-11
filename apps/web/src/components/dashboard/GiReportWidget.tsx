'use client';

import { useState, useEffect } from 'react';
import { Activity } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api';

interface GiReportData {
  weekAvgGi: number | null;
  weekAvgGL: number;
  totalHighGiMeals: number;
  daily: Array<{ day: number; avgGi: number | null; dailyGL: number; highGiCount: number }>;
}

const DAY_LABELS = ['Pon', 'Wt', 'Sr', 'Czw', 'Pt', 'Sob', 'Nie'];

function GiBar({ value, max }: { value: number; max: number }) {
  const pct = Math.min((value / max) * 100, 100);
  const color = value <= 55 ? 'bg-green-500' : value <= 69 ? 'bg-yellow-500' : 'bg-red-500';
  return (
    <div className="h-full w-full bg-muted rounded-sm overflow-hidden flex flex-col-reverse">
      <div className={`${color} rounded-sm transition-all`} style={{ height: `${pct}%` }} />
    </div>
  );
}

export function GiReportWidget({ patientId, token }: { patientId: string; token: string }) {
  const [data, setData] = useState<GiReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDiabetic, setIsDiabetic] = useState(false);

  useEffect(() => {
    if (!patientId || !token) return;

    // Check if patient has diabetes (from latest interview conditions)
    api.dietPlans.getLatest(patientId, token)
      .then((res) => {
        const planId = res.dietPlan?.id;
        // Check policyMetadata for diabetes condition
        const meta = (res.dietPlan as unknown as Record<string, unknown> | undefined)?.policyMetadata as Record<string, unknown> | undefined;
        const flags = (meta?.conditionFlags as string[]) ?? [];
        if (flags.includes('diabetes')) setIsDiabetic(true);
        // Also check explanation warnings for diabetes keywords
        const explanation = meta?.explanation as Record<string, unknown> | undefined;
        const warnings = (explanation?.warnings as string[]) ?? [];
        if (warnings.some((w: string) => /cukrzyc|diabet|insulin/i.test(w))) setIsDiabetic(true);

        if (!planId) return;
        return api.dietPlans.giReport(planId, token);
      })
      .then((res) => { if (res?.ok && res.giReport) setData(res.giReport); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [patientId, token]);

  if (loading || !data || data.weekAvgGi == null || !isDiabetic) return null;

  const glColor = data.weekAvgGL <= 80 ? 'text-green-600' : data.weekAvgGL <= 120 ? 'text-yellow-600' : 'text-red-600';
  const giColor = data.weekAvgGi <= 55 ? 'text-green-600' : data.weekAvgGi <= 69 ? 'text-yellow-600' : 'text-red-600';

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-1.5">
          <Activity className="h-4 w-4" />
          Indeks glikemiczny planu
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <p className={`text-lg font-bold ${giColor}`}>{data.weekAvgGi}</p>
            <p className="text-[10px] text-muted-foreground">Avg IG</p>
          </div>
          <div>
            <p className={`text-lg font-bold ${glColor}`}>{data.weekAvgGL}</p>
            <p className="text-[10px] text-muted-foreground">Avg GL/dzien</p>
          </div>
          <div>
            <p className={`text-lg font-bold ${data.totalHighGiMeals > 2 ? 'text-red-600' : 'text-green-600'}`}>
              {data.totalHighGiMeals}
            </p>
            <p className="text-[10px] text-muted-foreground">Wys. IG</p>
          </div>
        </div>

        {/* Daily GI bars */}
        <div className="flex items-end gap-1 h-16">
          {data.daily.map((d, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
              <div className="w-full h-12">
                <GiBar value={d.avgGi ?? 0} max={100} />
              </div>
              <span className="text-[9px] text-muted-foreground">{DAY_LABELS[i] ?? `D${i + 1}`}</span>
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 text-[9px] text-muted-foreground">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" /> IG &le;55</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-500" /> 56-69</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" /> &ge;70</span>
        </div>
      </CardContent>
    </Card>
  );
}
