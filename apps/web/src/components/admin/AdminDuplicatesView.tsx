'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { api, ApiError } from '@/lib/api';
import type { DuplicateGroup, DuplicateGroupProduct } from '@/types/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowLeft, Merge, ShieldCheck, AlertTriangle, ShieldAlert } from 'lucide-react';
import { formatCategory } from '@/lib/format-category';

interface AdminDuplicatesViewProps {
  token: string;
  categories: string[];
  t: ReturnType<typeof useTranslations>;
  onBack: () => void;
  onMerged: () => void;
}

const MERGE_FIELDS = [
  { key: 'name', label: 'mergeFieldName' },
  { key: 'nameEn', label: 'mergeFieldNameEn' },
  { key: 'brand', label: 'mergeFieldBrand' },
  { key: 'barcode', label: 'mergeFieldBarcode' },
  { key: 'category', label: 'mergeFieldCategory' },
  { key: 'description', label: 'mergeFieldDescription' },
  { key: 'nutrients', label: 'mergeFieldNutrients' },
  { key: 'imageUrl', label: 'mergeFieldImageUrl' },
  { key: 'packageWeightG', label: 'mergeFieldPackageWeight' },
  { key: 'servingWeightG', label: 'mergeFieldServingWeight' },
] as const;

export function AdminDuplicatesView({ token, categories, t, onBack, onMerged }: AdminDuplicatesViewProps) {
  const [groups, setGroups] = useState<DuplicateGroup[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState<string>('__ALL__');

  // Merge dialog state
  const [mergeGroup, setMergeGroup] = useState<DuplicateGroup | null>(null);
  const [targetId, setTargetId] = useState<string | null>(null);
  const [sourceIds, setSourceIds] = useState<Set<string>>(new Set());
  const [fieldsFromSource, setFieldsFromSource] = useState<Set<string>>(new Set());
  const [merging, setMerging] = useState(false);
  const [mergeProgress, setMergeProgress] = useState<{ current: number; total: number } | null>(null);

  const limit = 20;

  const fetchDuplicates = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.adminCleanProducts.duplicates(
        {
          page,
          limit,
          category: categoryFilter === '__ALL__' ? undefined : categoryFilter,
        },
        token
      );
      setGroups(result.groups);
      setTotal(result.total);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [page, categoryFilter, token]);

  useEffect(() => {
    fetchDuplicates();
  }, [fetchDuplicates]);

  const openMergeDialog = (group: DuplicateGroup) => {
    setMergeGroup(group);
    setTargetId(null);
    setSourceIds(new Set());
    setFieldsFromSource(new Set());
    setMergeProgress(null);
  };

  const handleProductClick = (productId: string) => {
    if (!targetId) {
      // First click — select target
      setTargetId(productId);
    } else if (productId === targetId) {
      // Click on target — deselect it and clear sources
      setTargetId(null);
      setSourceIds(new Set());
    } else {
      // Toggle source selection
      setSourceIds(prev => {
        const next = new Set(prev);
        if (next.has(productId)) {
          next.delete(productId);
        } else {
          next.add(productId);
        }
        return next;
      });
    }
  };

  const handleSelectAllSources = () => {
    if (!mergeGroup || !targetId) return;
    const allOtherIds = mergeGroup.products
      .filter(p => p.id !== targetId)
      .map(p => p.id);
    const allSelected = allOtherIds.every(id => sourceIds.has(id));
    if (allSelected) {
      setSourceIds(new Set());
    } else {
      setSourceIds(new Set(allOtherIds));
    }
  };

  const toggleField = (field: string) => {
    setFieldsFromSource(prev => {
      const next = new Set(prev);
      if (next.has(field)) next.delete(field);
      else next.add(field);
      return next;
    });
  };

  const handleMerge = async () => {
    if (!targetId || sourceIds.size === 0) return;
    setMerging(true);
    const sources = Array.from(sourceIds);
    setMergeProgress({ current: 0, total: sources.length });
    try {
      for (let i = 0; i < sources.length; i++) {
        setMergeProgress({ current: i + 1, total: sources.length });
        await api.adminCleanProducts.merge(
          {
            targetId,
            sourceId: sources[i],
            fieldsFromSource: fieldsFromSource.size > 0 ? Array.from(fieldsFromSource) : undefined,
          },
          token
        );
      }
      setMergeGroup(null);
      setMergeProgress(null);
      fetchDuplicates();
      onMerged();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : t('mergeError'));
    } finally {
      setMerging(false);
      setMergeProgress(null);
    }
  };

  const verificationIcon = (status: string) => {
    if (status === 'VERIFIED') return <ShieldCheck className="h-3.5 w-3.5 text-green-600" />;
    if (status === 'FLAGGED') return <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />;
    return <ShieldAlert className="h-3.5 w-3.5 text-muted-foreground/40" />;
  };

  const totalPages = Math.ceil(total / limit);

  const getProduct = (id: string | null): DuplicateGroupProduct | undefined =>
    mergeGroup?.products.find(p => p.id === id);

  return (
    <>
      <div className="flex items-center gap-3 mb-4">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5">
          <ArrowLeft className="h-4 w-4" />
          {t('duplicatesBack')}
        </Button>
        <div className="flex-1">
          <h3 className="text-lg font-semibold">{t('duplicatesTitle')}</h3>
          <p className="text-sm text-muted-foreground">{t('duplicatesDesc')}</p>
        </div>
        <Select value={categoryFilter} onValueChange={(v) => { setCategoryFilter(v); setPage(1); }}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder={t('allCategories')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__ALL__">{t('allCategories')}</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat} value={cat}>{formatCategory(cat)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">{t('duplicatesLoading')}</div>
      ) : groups.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">{t('duplicatesEmpty')}</div>
      ) : (
        <>
          <div className="text-xs text-muted-foreground mb-3">
            {t('duplicatesTotal', { count: total })}
          </div>
          <div className="space-y-4">
            {groups.map((group) => (
              <div key={group.normalizedName} className="rounded-lg border p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <span className="font-medium text-sm">&quot;{group.normalizedName}&quot;</span>
                    <Badge variant="secondary" className="ml-2 text-[10px]">
                      {group.products.length} produktów
                    </Badge>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => openMergeDialog(group)} className="gap-1.5">
                    <Merge className="h-3.5 w-3.5" />
                    {t('duplicatesMerge')}
                  </Button>
                </div>
                <div className="grid gap-2">
                  {group.products.map((product) => (
                    <div key={product.id} className="flex items-center gap-3 text-sm p-2 rounded bg-muted/30">
                      <div className="flex-1 min-w-0">
                        <span className="font-medium">{product.name}</span>
                        {product.brand && (
                          <span className="text-xs text-muted-foreground ml-1">({product.brand})</span>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">{formatCategory(product.category)}</span>
                      <Badge variant={product.type === 'BASE' ? 'default' : product.type === 'RETAIL' ? 'secondary' : 'outline'} className="text-[10px] px-1.5 py-0">
                        {product.type}
                      </Badge>
                      {product.nutrients && (
                        <span className="text-xs tabular-nums text-muted-foreground whitespace-nowrap">
                          {Math.round(product.nutrients.kcalPer100g)} kcal | B:{product.nutrients.proteinPer100g.toFixed(1)} | T:{product.nutrients.fatPer100g.toFixed(1)} | W:{product.nutrients.carbsPer100g.toFixed(1)}
                        </span>
                      )}
                      <span className="text-xs tabular-nums">{product.qualityScore}</span>
                      {verificationIcon(product.verificationStatus)}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-4">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                &laquo;
              </Button>
              <span className="flex items-center text-sm text-muted-foreground px-2">
                {page} / {totalPages}
              </span>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                &raquo;
              </Button>
            </div>
          )}
        </>
      )}

      {/* Merge Dialog */}
      <Dialog open={!!mergeGroup} onOpenChange={(open) => !open && setMergeGroup(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('mergeTitle')}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground mb-4">{t('mergeDesc')}</p>

          {mergeGroup && (
            <div className="space-y-4">
              {/* Product selection */}
              <div className="grid gap-2">
                {mergeGroup.products.map((product) => {
                  const isTarget = product.id === targetId;
                  const isSource = sourceIds.has(product.id);
                  return (
                    <div
                      key={product.id}
                      onClick={() => handleProductClick(product.id)}
                      className={`flex items-center gap-3 text-sm p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                        isTarget
                          ? 'border-green-500 bg-green-50 dark:bg-green-950/20'
                          : isSource
                          ? 'border-red-500 bg-red-50 dark:bg-red-950/20'
                          : 'border-transparent bg-muted/30 hover:bg-muted/50'
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-medium">{product.name}</div>
                        <div className="text-xs text-muted-foreground flex gap-2 mt-0.5">
                          {product.brand && <span>Marka: {product.brand}</span>}
                          <span>{formatCategory(product.category)}</span>
                          <span>Źródło: {product.sourcePrimary}</span>
                          <span>Jakość: {product.qualityScore}</span>
                          {product.hasMicronutrients && <span className="text-green-600">+mikro</span>}
                        </div>
                        {product.nutrients && (
                          <div className="text-xs tabular-nums text-muted-foreground mt-0.5">
                            {Math.round(product.nutrients.kcalPer100g)} kcal | B: {product.nutrients.proteinPer100g.toFixed(1)}g | T: {product.nutrients.fatPer100g.toFixed(1)}g | W: {product.nutrients.carbsPer100g.toFixed(1)}g
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {verificationIcon(product.verificationStatus)}
                        {isTarget && (
                          <Badge className="bg-green-600 text-white text-[10px]">{t('mergeTarget')}</Badge>
                        )}
                        {isSource && (
                          <Badge className="bg-red-600 text-white text-[10px]">{t('mergeSource')}</Badge>
                        )}
                        {!isTarget && !isSource && !targetId && (
                          <span className="text-[10px] text-muted-foreground">{t('mergeSelectTarget')}</span>
                        )}
                        {!isTarget && !isSource && targetId && sourceIds.size === 0 && (
                          <span className="text-[10px] text-muted-foreground">{t('mergeSelectSource')}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Select all / swap controls */}
              {targetId && (
                <div className="flex justify-center gap-2">
                  <Button variant="outline" size="sm" onClick={handleSelectAllSources} className="gap-1.5">
                    {mergeGroup.products.filter(p => p.id !== targetId).every(p => sourceIds.has(p.id))
                      ? t('mergeDeselectAll')
                      : t('mergeSelectAll')}
                  </Button>
                </div>
              )}

              {/* Field selection — show comparison only for single source */}
              {targetId && sourceIds.size > 0 && (
                <div className="rounded-lg border p-4">
                  <h4 className="text-sm font-medium mb-3">{t('mergeFieldsFromSource')}</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {MERGE_FIELDS.map(({ key, label }) => {
                      const targetProduct = getProduct(targetId);
                      const targetVal = key === 'nutrients'
                        ? (targetProduct?.nutrients ? `${Math.round(targetProduct.nutrients.kcalPer100g)} kcal` : '—')
                        : String((targetProduct as unknown as Record<string, unknown>)?.[key] ?? '—');

                      // Show source comparison only when exactly 1 source is selected
                      const singleSourceProduct = sourceIds.size === 1
                        ? getProduct(Array.from(sourceIds)[0])
                        : undefined;
                      const sourceVal = singleSourceProduct
                        ? (key === 'nutrients'
                          ? (singleSourceProduct.nutrients ? `${Math.round(singleSourceProduct.nutrients.kcalPer100g)} kcal` : '—')
                          : String((singleSourceProduct as unknown as Record<string, unknown>)?.[key] ?? '—'))
                        : undefined;

                      return (
                        <label
                          key={key}
                          className="flex items-start gap-2 p-2 rounded hover:bg-muted/30 cursor-pointer"
                        >
                          <Checkbox
                            checked={fieldsFromSource.has(key)}
                            onCheckedChange={() => toggleField(key)}
                            className="mt-0.5"
                          />
                          <div className="text-sm">
                            <div className="font-medium">{t(label)}</div>
                            <div className="text-xs text-muted-foreground">
                              <span className="text-green-600">T:</span> {targetVal}
                            </div>
                            {sourceVal !== undefined && (
                              <div className="text-xs text-muted-foreground">
                                <span className="text-red-600">S:</span> {sourceVal}
                              </div>
                            )}
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Confirmation */}
              {targetId && sourceIds.size > 0 && (
                <p className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/20 p-3 rounded-lg">
                  {sourceIds.size === 1
                    ? t('mergeConfirmDesc')
                    : t('mergeConfirmDescMulti', { count: sourceIds.size })}
                </p>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setMergeGroup(null)}>{t('cancel')}</Button>
            <Button
              onClick={handleMerge}
              disabled={!targetId || sourceIds.size === 0 || merging}
              className="gap-1.5"
            >
              <Merge className="h-4 w-4" />
              {merging
                ? (mergeProgress
                  ? `${t('merging')} ${mergeProgress.current}/${mergeProgress.total}`
                  : t('merging'))
                : sourceIds.size > 1
                  ? t('mergeConfirmMulti', { count: sourceIds.size })
                  : t('mergeConfirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
