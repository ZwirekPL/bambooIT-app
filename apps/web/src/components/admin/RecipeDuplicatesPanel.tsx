'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { api, ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Search, Merge, Star, SkipForward } from 'lucide-react';

interface DuplicateRecipe {
  id: string;
  title: string;
  qualityScore: number;
  category: string | null;
  mealType: string | null;
}

interface DuplicateCluster {
  recipes: DuplicateRecipe[];
  similarity: number;
}

interface RecipeDuplicatesPanelProps {
  token: string;
}

export function RecipeDuplicatesPanel({ token }: RecipeDuplicatesPanelProps) {
  const t = useTranslations('admin.recipes');
  const [clusters, setClusters] = useState<DuplicateCluster[]>([]);
  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [mergingCluster, setMergingCluster] = useState<number | null>(null);
  const [masterIds, setMasterIds] = useState<Record<number, string>>({});

  const handleScan = async () => {
    setScanning(true);
    try {
      const result = await api.adminRecipes.findDuplicates(token);
      setClusters(result.clusters);
      setScanned(true);
      // Auto-select best quality as master for each cluster
      const autoMasters: Record<number, string> = {};
      result.clusters.forEach((cluster, i) => {
        const best = cluster.recipes.reduce((a, b) =>
          a.qualityScore >= b.qualityScore ? a : b
        );
        autoMasters[i] = best.id;
      });
      setMasterIds(autoMasters);
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Error');
    } finally {
      setScanning(false);
    }
  };

  const handleMerge = async (clusterIdx: number) => {
    const cluster = clusters[clusterIdx];
    const masterId = masterIds[clusterIdx];
    if (!masterId) return;

    const duplicateIds = cluster.recipes
      .filter((r) => r.id !== masterId)
      .map((r) => r.id);

    setMergingCluster(clusterIdx);
    try {
      const result = await api.adminRecipes.merge({ masterId, duplicateIds }, token);
      alert(t('duplicatesMergeSuccess', { count: result.merged }));
      // Remove merged cluster from list
      setClusters((prev) => prev.filter((_, i) => i !== clusterIdx));
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Error');
    } finally {
      setMergingCluster(null);
    }
  };

  const handleSkip = (clusterIdx: number) => {
    setClusters((prev) => prev.filter((_, i) => i !== clusterIdx));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">{t('duplicatesTitle')}</h3>
          <p className="text-sm text-muted-foreground">{t('duplicatesSubtitle')}</p>
        </div>
        <Button onClick={handleScan} disabled={scanning} className="gap-2">
          <Search className="h-4 w-4" />
          {scanning ? t('duplicatesScanning') : t('duplicatesScan')}
        </Button>
      </div>

      {scanned && clusters.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">{t('duplicatesNone')}</p>
      )}

      {clusters.length > 0 && (
        <p className="text-sm text-muted-foreground">
          {t('duplicatesClusters', { count: clusters.length })}
        </p>
      )}

      {clusters.map((cluster, ci) => (
        <Card key={ci} className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Merge className="h-4 w-4 text-orange-500" />
                {t('duplicatesSimilarity', { pct: cluster.similarity })}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleSkip(ci)}
                  className="gap-1"
                >
                  <SkipForward className="h-3 w-3" />
                  {t('duplicatesSkip')}
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleMerge(ci)}
                  disabled={mergingCluster === ci}
                  className="gap-1"
                >
                  <Merge className="h-3 w-3" />
                  {mergingCluster === ci ? t('duplicatesMerging') : t('duplicatesMerge')}
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-xs text-muted-foreground mb-3">
              {t('duplicatesMergeConfirm')}
            </p>
            <div className="space-y-2">
              {cluster.recipes.map((recipe) => {
                const isMaster = masterIds[ci] === recipe.id;
                return (
                  <div
                    key={recipe.id}
                    className={`flex items-center justify-between rounded-md border p-3 cursor-pointer transition-colors ${
                      isMaster ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                    }`}
                    onClick={() => setMasterIds((prev) => ({ ...prev, [ci]: recipe.id }))}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <input
                        type="radio"
                        name={`master-${ci}`}
                        checked={isMaster}
                        onChange={() => setMasterIds((prev) => ({ ...prev, [ci]: recipe.id }))}
                        className="shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium truncate">{recipe.title}</span>
                          {isMaster && (
                            <Badge variant="default" className="text-[10px] gap-0.5">
                              <Star className="h-2.5 w-2.5" />
                              {t('duplicatesMasterBadge')}
                            </Badge>
                          )}
                        </div>
                        <div className="flex gap-2 mt-0.5">
                          {recipe.category && (
                            <span className="text-xs text-muted-foreground">{recipe.category}</span>
                          )}
                          {recipe.mealType && (
                            <span className="text-xs text-muted-foreground">{recipe.mealType}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <Badge
                      variant={recipe.qualityScore >= 70 ? 'default' : recipe.qualityScore >= 40 ? 'secondary' : 'destructive'}
                    >
                      {recipe.qualityScore}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
