'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { BarChart3, TrendingUp, TrendingDown, Award, AlertTriangle, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';

interface PesScore {
  planId: string;
  patientId: string;
  pes: number;
  components: {
    complianceRate: number;
    goalProgress: number;
    patientSatisfaction: number;
    retention: number;
    microCoverage: number;
  };
  period: { from: string; to: string };
}

interface RecipeEff {
  recipeId: string;
  title: string;
  avgRating: number;
  timesUsed: number;
  pesContribution: number;
}

export default function AnalyticsPage() {
  const { data: session } = useSession();
  const token = '';

  const [analytics, setAnalytics] = useState<{ avgPes: number; patientCount: number; planCount: number; pesScores: PesScore[] } | null>(null);
  const [bestRecipes, setBestRecipes] = useState<RecipeEff[]>([]);
  const [worstRecipes, setWorstRecipes] = useState<RecipeEff[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`/api/proxy/dietitian/analytics/effectiveness`).then((r) => r.json()).catch(() => null),
      fetch(`/api/proxy/dietitian/analytics/recipe-effectiveness?sort=best&limit=10`).then((r) => r.json()).catch(() => null),
      fetch(`/api/proxy/dietitian/analytics/recipe-effectiveness?sort=worst&limit=10`).then((r) => r.json()).catch(() => null),
    ]).then(([eff, best, worst]) => {
      if (eff?.ok) setAnalytics(eff);
      if (best?.ok) setBestRecipes(best.recipes ?? []);
      if (worst?.ok) setWorstRecipes(worst.recipes ?? []);
    }).finally(() => setLoading(false));
  }, [token]);

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  const pesColor = (pes: number) => pes >= 70 ? 'text-green-700' : pes >= 50 ? 'text-amber-700' : 'text-red-700';

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Analityka efektywnosci
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Wskaznik PES (Plan Effectiveness Score) mierzy skutecznosc Twoich planow na podstawie
          przestrzegania diety przez pacjenta, postepow wagowych, ocen przepisow, regularnosci
          check-inow i jakosci zywieniowej planu. Im wyzszy wynik, tym lepsze efekty terapii.
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="py-4 text-center">
            <p className="text-xs text-muted-foreground">Sredni PES</p>
            <p className={`text-3xl font-bold ${pesColor(analytics?.avgPes ?? 0)}`}>{analytics?.avgPes ?? 0}</p>
            <p className="text-[10px] text-muted-foreground">/100</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 text-center">
            <p className="text-xs text-muted-foreground">Pacjenci</p>
            <p className="text-3xl font-bold">{analytics?.patientCount ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 text-center">
            <p className="text-xs text-muted-foreground">Aktywne plany</p>
            <p className="text-3xl font-bold">{analytics?.planCount ?? 0}</p>
          </CardContent>
        </Card>
      </div>

      {/* PES per patient */}
      {analytics && analytics.pesScores.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">PES per plan</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {analytics.pesScores.map((ps) => (
                <div key={ps.planId} className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0">
                  <span className="text-xs text-muted-foreground">{ps.period.from} — {ps.period.to}</span>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={`text-xs ${pesColor(ps.pes)}`}>PES {ps.pes}</Badge>
                    <span className="text-[10px] text-muted-foreground">
                      C:{ps.components.complianceRate} G:{ps.components.goalProgress} S:{ps.components.patientSatisfaction}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Best recipes */}
      {bestRecipes.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Award className="h-4 w-4 text-green-600" />
              Top przepisy
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5">
              {bestRecipes.map((r, i) => (
                <div key={r.recipeId} className="flex items-center justify-between text-sm py-1 border-b border-border/30 last:border-0">
                  <span className="truncate flex-1">{i + 1}. {r.title}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-muted-foreground">{r.timesUsed}x</span>
                    <Badge variant="outline" className="text-[10px] text-green-700 border-green-300">{r.avgRating.toFixed(1)} ★</Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Worst recipes */}
      {worstRecipes.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              Najslabsze przepisy
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5">
              {worstRecipes.map((r, i) => (
                <div key={r.recipeId} className="flex items-center justify-between text-sm py-1 border-b border-border/30 last:border-0">
                  <span className="truncate flex-1">{i + 1}. {r.title}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-muted-foreground">{r.timesUsed}x</span>
                    <Badge variant="outline" className="text-[10px] text-red-700 border-red-300">{r.avgRating.toFixed(1)} ★</Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
