'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Bot, CheckCircle2, Clock, Trash2, ChevronRight, ChevronLeft } from 'lucide-react';

interface AiRecipeItem {
  id: string;
  title: string;
  category: string | null;
  mealType: string;
  qualityScore: number;
  isActive: boolean;
  aiApproved: boolean;
  verificationStatus: string;
  createdAt: string;
}

interface AiStats {
  total: number;
  aiGenerated: number;
  aiApproved: number;
  aiPending: number;
  humanCreated: number;
}

interface Props {
  token: string;
}

export function AiRecipesPanel({ token }: Props) {
  const [stats, setStats] = useState<AiStats | null>(null);
  const [items, setItems] = useState<AiRecipeItem[]>([]);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved'>('pending');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [actioning, setActioning] = useState<string | null>(null);

  const limit = 20;

  async function apiFetch(path: string, opts?: RequestInit) {
    const res = await fetch(`/api/proxy${path}`, {
      ...opts,
      headers: { 'Content-Type': 'application/json', ...(opts?.headers ?? {}) },
    });
    return res.json();
  }

  async function loadStats() {
    const res = await apiFetch('/admin/recipes/ai-stats');
    if (res.ok) setStats(res.stats);
  }

  async function loadList() {
    setLoading(true);
    const res = await apiFetch(`/admin/recipes/ai-review?filter=${filter}&page=${page}&limit=${limit}`);
    if (res.ok) {
      setItems(res.items);
      setTotal(res.total);
    }
    setLoading(false);
  }

  useEffect(() => { void loadStats(); }, []);
  useEffect(() => { void loadList(); }, [filter, page]);

  async function approve(id: string) {
    if (!confirm('Zatwierdzić ten przepis? Trafi do głównej bazy i będzie dostępny w generatorze planów.')) return;
    setActioning(id);
    const res = await apiFetch(`/admin/recipes/${id}/approve-ai`, { method: 'POST' });
    setActioning(null);
    if (res.ok) { void loadStats(); void loadList(); }
    else alert('Błąd podczas zatwierdzania przepisu.');
  }

  async function reject(id: string, title: string) {
    if (!confirm(`Odrzucić przepis "${title}"? Zostanie trwale usunięty.`)) return;
    setActioning(id);
    const res = await apiFetch(`/admin/recipes/${id}`, { method: 'DELETE' });
    setActioning(null);
    if (res.ok) { void loadStats(); void loadList(); }
    else alert('Błąd podczas usuwania przepisu.');
  }

  const totalPages = Math.ceil(total / limit);

  return (
    <Card className="border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Bot className="h-4 w-4 text-muted-foreground" />
          Przepisy AI — weryfikacja
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">

        {/* Stats row */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Wszystkie w bazie', value: stats.total, color: 'bg-gray-50' },
              { label: 'Wygenerowane przez AI', value: stats.aiGenerated, color: 'bg-purple-50 text-purple-800' },
              { label: 'Oczekuje weryfikacji', value: stats.aiPending, color: 'bg-amber-50 text-amber-800' },
              { label: 'Zatwierdzone', value: stats.aiApproved, color: 'bg-green-50 text-green-800' },
            ].map((s) => (
              <div key={s.label} className={`rounded-lg p-3 ${s.color}`}>
                <p className="text-xs text-muted-foreground mb-0.5">{s.label}</p>
                <p className="text-xl font-bold">{s.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Filter tabs */}
        <div className="flex gap-1.5">
          {(['pending', 'approved', 'all'] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => { setFilter(f); setPage(1); }}
              className={`px-3 py-1 text-xs rounded-md border transition-colors ${
                filter === f
                  ? 'bg-foreground text-background border-foreground'
                  : 'bg-background text-muted-foreground border-input hover:bg-muted'
              }`}
            >
              {f === 'pending' && 'Oczekujące'}
              {f === 'approved' && 'Zatwierdzone'}
              {f === 'all' && 'Wszystkie AI'}
            </button>
          ))}
        </div>

        {/* List */}
        {loading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Ładowanie...
          </div>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            {filter === 'pending' ? 'Brak przepisów oczekujących na weryfikację.' : 'Brak przepisów.'}
          </p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Nazwa</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground hidden sm:table-cell">Typ</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground hidden md:table-cell">Jakość</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Status</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground hidden lg:table-cell">Dodano</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Akcje</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id} className="border-b border-border/50 last:border-0 hover:bg-muted/20">
                      <td className="px-3 py-2 font-medium text-xs max-w-[200px] truncate" title={item.title}>
                        {item.title}
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground hidden sm:table-cell">
                        {item.mealType}
                      </td>
                      <td className="px-3 py-2 hidden md:table-cell">
                        <span className={`text-xs font-mono px-1.5 py-0.5 rounded ${
                          item.qualityScore >= 70 ? 'bg-green-100 text-green-700' :
                          item.qualityScore >= 40 ? 'bg-amber-100 text-amber-700' :
                          'bg-red-100 text-red-700'
                        }`}>{item.qualityScore}</span>
                      </td>
                      <td className="px-3 py-2">
                        {item.aiApproved ? (
                          <Badge className="text-[10px] bg-green-100 text-green-700 gap-1">
                            <CheckCircle2 className="h-2.5 w-2.5" /> Zatwierdzone
                          </Badge>
                        ) : (
                          <Badge className="text-[10px] bg-amber-100 text-amber-700 gap-1">
                            <Clock className="h-2.5 w-2.5" /> Oczekuje
                          </Badge>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground hidden lg:table-cell">
                        {new Date(item.createdAt).toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {!item.aiApproved && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 text-[11px] px-2 gap-1 text-green-700 border-green-300 hover:bg-green-50"
                              disabled={actioning === item.id}
                              onClick={() => approve(item.id)}
                            >
                              {actioning === item.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                              Zatwierdź
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                            disabled={actioning === item.id}
                            onClick={() => reject(item.id, item.title)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                <span>Strona {page} z {totalPages} (łącznie: {total})</span>
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" className="h-7 w-7 p-0" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                    <ChevronLeft className="h-3 w-3" />
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 w-7 p-0" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                    <ChevronRight className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}

        <p className="text-[11px] text-muted-foreground">
          Zatwierdzone przepisy AI trafiają do głównej bazy i mogą być używane przez generator planów. Odrzucone przepisy są trwale usuwane.
        </p>
      </CardContent>
    </Card>
  );
}
