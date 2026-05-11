'use client';

import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useSession } from 'next-auth/react';
import {
  Ruler, TrendingDown, TrendingUp, Minus, Loader2, Plus, Trash2, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/lib/api';
import type { MeasurementTrends, BodyMeasurement } from '@/types/api';
import { MeasurementGuide } from '@/components/dashboard/MeasurementGuide';

// Lazy-load recharts (~200 KB) — only needed when chart data is available
const MeasurementChart = dynamic(
  () => import('@/components/dashboard/MeasurementChart').then((m) => m.MeasurementChart),
  {
    ssr: false,
    loading: () => (
      <div className="h-[240px] flex items-center justify-center text-muted-foreground text-sm">
        <Loader2 className="h-4 w-4 animate-spin mr-2" /> Ładowanie wykresu...
      </div>
    ),
  }
);

const FIELD_LABELS: Record<string, string> = {
  waistCm: 'Talia',
  hipCm: 'Biodra',
  chestCm: 'Klatka',
  thighCm: 'Udo',
  armCm: 'Ramie',
  bodyFatPct: 'Tkanka tluszcz.',
};

const FIELD_UNITS: Record<string, string> = {
  waistCm: 'cm', hipCm: 'cm', chestCm: 'cm', thighCm: 'cm', armCm: 'cm', bodyFatPct: '%',
};


const WHR_COLORS: Record<string, string> = {
  healthy: 'text-green-700 bg-green-50 border-green-300',
  moderate: 'text-amber-700 bg-amber-50 border-amber-300',
  high: 'text-red-700 bg-red-50 border-red-300',
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function MeasurementsPage() {
  const { status } = useSession();

  const [trends, setTrends] = useState<MeasurementTrends | null>(null);
  const [items, setItems] = useState<BodyMeasurement[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});

  const PAGE_SIZE = 10;

  const loadData = useCallback(async (p: number) => {
    if (status !== 'authenticated') return;
    setLoading(true);
    try {
      // apiFetch routes through /api/proxy/* in the browser — token injected server-side
      const [trendsRes, listRes] = await Promise.all([
        api.measurements.trends(''),
        api.measurements.list('', p),
      ]);
      if (trendsRes.ok) setTrends(trendsRes);
      if (listRes.ok) {
        setItems(listRes.items);
        setTotal(listRes.total);
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [status]);

  useEffect(() => {
    loadData(page);
  }, [loadData, page]);

  async function handleSave() {
    setSaving(true);
    const payload: Partial<Omit<BodyMeasurement, 'id' | 'patientId'>> & { date: string } = {
      date: new Date().toISOString(),
    };
    for (const [key, val] of Object.entries(form)) {
      if (key === 'notes') {
        if (val.trim()) (payload as Record<string, unknown>).notes = val.trim();
      } else if (val.trim()) {
        (payload as Record<string, unknown>)[key] = parseFloat(val);
      }
    }
    try {
      await api.measurements.create(payload as Omit<BodyMeasurement, 'id' | 'patientId'>, '');
      setShowForm(false);
      setForm({});
      setPage(1);
      await loadData(1);
    } catch { /* ignore */ }
    finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      await api.measurements.remove(id, '');
      await loadData(page);
    } catch { /* ignore */ }
    finally { setDeletingId(null); }
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  // Build chart data from trends.points (last 30 points, oldest first)
  const chartPoints = trends?.points
    .slice()
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(-30)
    .map((p) => ({
      date: formatDate(p.date),
      waistCm: p.waistCm,
      hipCm: p.hipCm,
      chestCm: p.chestCm,
      thighCm: p.thighCm,
      armCm: p.armCm,
      bodyFatPct: p.bodyFatPct,
    })) ?? [];

  const hasChartData = chartPoints.length >= 2;

  if (loading && items.length === 0 && !trends) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <Ruler className="h-5 w-5" />
          Pomiary ciala
        </h1>
        <Button size="sm" onClick={() => setShowForm(!showForm)} variant={showForm ? 'outline' : 'default'}>
          <Plus className="h-4 w-4 mr-1" />
          {showForm ? 'Anuluj' : 'Nowy pomiar'}
        </Button>
      </div>

      {/* WHR badge */}
      {trends?.whrInterpretation && (
        <Card className={`border ${WHR_COLORS[trends.whrInterpretation.level]}`}>
          <CardContent className="py-3 px-4 flex items-center justify-between">
            <span className="text-sm font-medium">
              WHR (talia/biodra): {trends.whrInterpretation.whr}
            </span>
            <Badge variant="outline" className={WHR_COLORS[trends.whrInterpretation.level]}>
              {trends.whrInterpretation.label}
            </Badge>
          </CardContent>
        </Card>
      )}

      {/* New measurement form */}
      {showForm && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Nowy pomiar</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(FIELD_LABELS).map(([key, label]) => (
                <div key={key} className="space-y-1">
                  <Label className="text-xs">{label} ({FIELD_UNITS[key]})</Label>
                  <Input
                    type="number"
                    step="0.1"
                    placeholder="—"
                    value={form[key] ?? ''}
                    onChange={(e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))}
                    className="h-9"
                  />
                </div>
              ))}
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Notatka (opcjonalnie)</Label>
              <Textarea
                placeholder="Np. po treningu, rano na czczo..."
                value={form.notes ?? ''}
                onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                className="resize-none h-20 text-sm"
              />
            </div>
            <Button onClick={handleSave} disabled={saving} className="w-full">
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Zapisz pomiar
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Trend summaries */}
      {trends && trends.summaries.some((s) => s.first != null) && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Trendy</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {trends.summaries.filter((s) => s.first != null).map((s) => (
                <div
                  key={s.field}
                  className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0"
                >
                  <span className="text-sm text-muted-foreground">
                    {FIELD_LABELS[s.field] ?? s.field}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                      {s.last}{FIELD_UNITS[s.field]}
                    </span>
                    {s.change != null && s.change !== 0 && (
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${
                          s.direction === 'down'
                            ? 'text-green-700 border-green-300'
                            : s.direction === 'up'
                              ? 'text-red-700 border-red-300'
                              : ''
                        }`}
                      >
                        {s.direction === 'down'
                          ? <TrendingDown className="h-3 w-3 mr-0.5" />
                          : s.direction === 'up'
                            ? <TrendingUp className="h-3 w-3 mr-0.5" />
                            : <Minus className="h-3 w-3 mr-0.5" />}
                        {s.change > 0 ? '+' : ''}{s.change}{FIELD_UNITS[s.field]}
                        {s.changePct != null
                          ? ` (${s.changePct > 0 ? '+' : ''}${s.changePct}%)`
                          : ''}
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Line chart — recharts loaded lazily */}
      {hasChartData && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Wykres trendow</CardTitle>
          </CardHeader>
          <CardContent>
            <MeasurementChart data={chartPoints} />
          </CardContent>
        </Card>
      )}

      {/* History table */}
      {items.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Historia pomiarow</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Data</th>
                    {Object.entries(FIELD_LABELS).map(([key, label]) => (
                      <th key={key} className="text-right py-2 px-2 font-medium text-muted-foreground whitespace-nowrap">
                        {label}
                      </th>
                    ))}
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Notatka</th>
                    <th className="py-2 px-2" />
                  </tr>
                </thead>
                <tbody>
                  {items.map((m) => (
                    <tr key={m.id} className="border-b border-border/40 last:border-0 hover:bg-muted/20 transition-colors">
                      <td className="py-2 px-3 whitespace-nowrap text-muted-foreground">
                        {formatDate(m.date)}
                      </td>
                      {Object.keys(FIELD_LABELS).map((key) => {
                        const val = m[key as keyof BodyMeasurement];
                        return (
                          <td key={key} className="py-2 px-2 text-right">
                            {val != null
                              ? <span className="font-medium">{val}{FIELD_UNITS[key]}</span>
                              : <span className="text-muted-foreground">—</span>}
                          </td>
                        );
                      })}
                      <td className="py-2 px-3 text-muted-foreground max-w-[140px] truncate">
                        {m.notes ?? ''}
                      </td>
                      <td className="py-2 px-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => handleDelete(m.id)}
                          disabled={deletingId === m.id}
                        >
                          {deletingId === m.id
                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            : <Trash2 className="h-3.5 w-3.5" />}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-3 py-2 border-t border-border/40">
                <span className="text-xs text-muted-foreground">
                  {total} pomiarow, strona {page} z {totalPages}
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {items.length === 0 && !showForm && !loading && (
        <p className="text-sm text-muted-foreground text-center py-8">
          Brak pomiarow. Dodaj pierwszy pomiar!
        </p>
      )}

      <MeasurementGuide />
    </div>
  );
}
