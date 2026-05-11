'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronUp, Heart, ThumbsUp, ThumbsDown, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';

interface HealthProduct {
  name: string;
  reason: string;
  category: string;
}

interface RecommendedData {
  healthProducts: HealthProduct[];
  likedProducts: string[];
  dislikedProducts: string[];
  summary: string;
}

interface Props {
  patientId: string;
  token: string;
}

export function RecommendedProductsCard({ patientId, token }: Props) {
  const [data, setData] = useState<RecommendedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(
          `/api/proxy/patients/${patientId}/recommended-products`,
          { cache: 'no-store' },
        );
        if (!res.ok) throw new Error('Nie udało się pobrać zaleceń');
        const json = await res.json();
        setData({
          healthProducts: json.healthProducts ?? [],
          likedProducts: json.likedProducts ?? [],
          dislikedProducts: json.dislikedProducts ?? [],
          summary: json.summary ?? '',
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Błąd');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [patientId, token]);

  if (loading) {
    return (
      <Card className="border-border">
        <CardContent className="py-6 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Ładowanie zaleceń produktowych...
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return null; // Silent fail — this is optional data
  }

  const hasAnyData = data.healthProducts.length > 0 || data.likedProducts.length > 0 || data.dislikedProducts.length > 0;
  if (!hasAnyData) {
    return null;
  }

  // Group health products by reason category
  const groupedHealth = new Map<string, HealthProduct[]>();
  for (const hp of data.healthProducts) {
    // Extract short label: "Bogate w żelazo (3.3 mg/100g) — niedobór żelaza" → "Bogate w żelazo"
    const shortReason = hp.reason.split('(')[0]?.trim() || hp.reason;
    if (!groupedHealth.has(shortReason)) groupedHealth.set(shortReason, []);
    groupedHealth.get(shortReason)!.push(hp);
  }

  const visibleGroups = expanded ? [...groupedHealth.entries()] : [...groupedHealth.entries()].slice(0, 3);

  return (
    <Card className="border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Heart className="h-4 w-4 text-rose-500" />
            Zalecane produkty
            <Badge variant="outline" className="text-xs font-normal">
              {data.healthProducts.length}
            </Badge>
          </CardTitle>
          {groupedHealth.size > 3 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
            >
              {expanded ? (
                <>Zwiń <ChevronUp className="h-3 w-3" /></>
              ) : (
                <>Pokaż wszystkie ({groupedHealth.size}) <ChevronDown className="h-3 w-3" /></>
              )}
            </button>
          )}
        </div>
        {data.summary && (
          <p className="text-xs text-muted-foreground mt-1">{data.summary}</p>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Health products grouped by reason */}
        {visibleGroups.map(([reason, products]) => (
          <div key={reason} className="space-y-1">
            <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
              {reason}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {products.map((p) => (
                <Badge
                  key={p.name}
                  variant="outline"
                  className="text-xs font-normal bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300"
                  title={p.reason}
                >
                  {p.name}
                </Badge>
              ))}
            </div>
          </div>
        ))}

        {/* Liked products */}
        {data.likedProducts.length > 0 && (
          <div className="space-y-1 pt-2 border-t border-border">
            <p className="text-xs font-medium text-blue-700 dark:text-blue-400 flex items-center gap-1">
              <ThumbsUp className="h-3 w-3" />
              Ulubione składniki pacjenta
            </p>
            <div className="flex flex-wrap gap-1.5">
              {data.likedProducts.slice(0, 15).map((name) => (
                <Badge
                  key={name}
                  variant="outline"
                  className="text-xs font-normal bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800"
                >
                  {name}
                </Badge>
              ))}
              {data.likedProducts.length > 15 && (
                <span className="text-xs text-muted-foreground">
                  +{data.likedProducts.length - 15} więcej
                </span>
              )}
            </div>
          </div>
        )}

        {/* Disliked products */}
        {data.dislikedProducts.length > 0 && (
          <div className="space-y-1 pt-2 border-t border-border">
            <p className="text-xs font-medium text-red-700 dark:text-red-400 flex items-center gap-1">
              <ThumbsDown className="h-3 w-3" />
              Nielubiane
            </p>
            <div className="flex flex-wrap gap-1.5">
              {data.dislikedProducts.map((name) => (
                <Badge
                  key={name}
                  variant="outline"
                  className="text-xs font-normal bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800 text-red-800 dark:text-red-300"
                >
                  {name}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
