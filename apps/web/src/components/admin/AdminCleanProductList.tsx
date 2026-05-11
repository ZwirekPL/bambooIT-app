'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { api, ApiError } from '@/lib/api';
import type { CleanProduct, CleanProductType } from '@/types/api';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Search, Trash2, ShieldCheck, ShieldAlert, AlertTriangle, FolderEdit, Download, BarChart3, X, Merge } from 'lucide-react';
import { CleanProductDetailDialog } from '@/components/shared/CleanProductDetailDialog';
import { AdminDuplicatesView } from '@/components/admin/AdminDuplicatesView';
import { formatCategory } from '@/lib/format-category';

interface AdminCleanProductListProps {
  token: string;
}

const TYPE_BADGE_MAP: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
  BASE: { label: 'typeBASE', variant: 'default' },
  RETAIL: { label: 'typeRETAIL', variant: 'secondary' },
  MANUAL: { label: 'typeMANUAL', variant: 'outline' },
};

export function AdminCleanProductList({ token }: AdminCleanProductListProps) {
  const t = useTranslations('admin.cleanProducts');
  const [items, setItems] = useState<CleanProduct[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<CleanProductType | 'ALL'>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('__ALL__');
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<CleanProduct | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<CleanProduct | null>(null);
  const [changeCategoryTarget, setChangeCategoryTarget] = useState<CleanProduct | null>(null);
  const [newCategory, setNewCategory] = useState('');
  const [changingCategory, setChangingCategory] = useState(false);
  const [verificationFilter, setVerificationFilter] = useState<string>('__ALL__');
  const [minQuality, setMinQuality] = useState<string>('');
  const [maxQuality, setMaxQuality] = useState<string>('');
  const [showStats, setShowStats] = useState(false);
  const [stats, setStats] = useState<{ total: number; byType: Record<string, number>; byVerification: Record<string, number>; withMicro: number; withoutMicro: number; avgQualityScore: number } | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkCategoryOpen, setBulkCategoryOpen] = useState(false);
  const [bulkNewCategory, setBulkNewCategory] = useState('');
  const [showDuplicates, setShowDuplicates] = useState(false);

  const limit = 20;

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.adminCleanProducts.list(
        {
          page,
          limit,
          search: search || undefined,
          type: typeFilter === 'ALL' ? undefined : typeFilter,
          category: categoryFilter === '__ALL__' ? undefined : categoryFilter,
          verificationStatus: verificationFilter === '__ALL__' ? undefined : verificationFilter,
          minQuality: minQuality ? Number(minQuality) : undefined,
          maxQuality: maxQuality ? Number(maxQuality) : undefined,
        },
        token
      );
      setItems(result.items);
      setTotal(result.total);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [page, search, typeFilter, categoryFilter, verificationFilter, minQuality, maxQuality, token]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  useEffect(() => {
    api.adminCleanProducts.categories(token).then((res) => setCategories(res.categories)).catch(() => {});
  }, [token]);

  const handleSearch = (value: string) => {
    setSearch(value);
    setPage(1);
    setSelectedIds(new Set());
  };

  const handleTypeChange = (value: string) => {
    setTypeFilter(value as CleanProductType | 'ALL');
    setPage(1);
    setSelectedIds(new Set());
  };

  const handleCategoryChange = (value: string) => {
    setCategoryFilter(value);
    setPage(1);
    setSelectedIds(new Set());
  };

  const handleVerificationChange = (value: string) => {
    setVerificationFilter(value);
    setPage(1);
    setSelectedIds(new Set());
  };

  const handleQualityChange = (min: string, max: string) => {
    setMinQuality(min);
    setMaxQuality(max);
    setPage(1);
    setSelectedIds(new Set());
  };

  const handleToggleStats = async () => {
    if (showStats) {
      setShowStats(false);
      return;
    }
    try {
      const res = await api.adminCleanProducts.stats(token);
      setStats(res.stats);
      setShowStats(true);
    } catch {
      // silent
    }
  };

  const handleExportCsv = () => {
    if (items.length === 0) return;
    const headers = ['Nazwa', 'Kategoria', 'Typ', 'kcal', 'Białko', 'Tłuszcz', 'Węgle', 'Porcje', 'Status weryfikacji', 'Quality Score'];
    const rows = items.map((item) => [
      `"${(item.name ?? '').replace(/"/g, '""')}"`,
      `"${formatCategory(item.category)}"`,
      item.type,
      item.nutrients?.kcalPer100g != null ? Math.round(item.nutrients.kcalPer100g) : '',
      item.nutrients?.proteinPer100g != null ? Number(item.nutrients.proteinPer100g).toFixed(1) : '',
      item.nutrients?.fatPer100g != null ? Number(item.nutrients.fatPer100g).toFixed(1) : '',
      item.nutrients?.carbsPer100g != null ? Number(item.nutrients.carbsPer100g).toFixed(1) : '',
      item.portions?.length ?? 0,
      item.verificationStatus,
      item.qualityScore ?? '',
    ]);
    const csv = [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `produkty-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleChangeCategory = async () => {
    if (!changeCategoryTarget || !newCategory) return;
    setChangingCategory(true);
    try {
      await api.adminCleanProducts.update(changeCategoryTarget.id, { category: newCategory }, token);
      setChangeCategoryTarget(null);
      setNewCategory('');
      fetchProducts();
      api.adminCleanProducts.categories(token).then((res) => setCategories(res.categories)).catch(() => {});
    } catch (err) {
      alert(err instanceof ApiError ? err.message : t('changeCategoryError'));
    } finally {
      setChangingCategory(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.adminCleanProducts.remove(deleteTarget.id, token);
      setDeleteTarget(null);
      fetchProducts();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : t('deleteError'));
    } finally {
      setDeleting(false);
    }
  };

  const handleVerify = async (product: CleanProduct) => {
    try {
      await api.adminCleanProducts.update(
        product.id,
        { verificationStatus: 'VERIFIED' },
        token
      );
      fetchProducts();
    } catch {
      // silent
    }
  };

  const handleFlag = async (product: CleanProduct) => {
    try {
      await api.adminCleanProducts.update(
        product.id,
        { verificationStatus: 'FLAGGED' },
        token
      );
      fetchProducts();
    } catch {
      // silent
    }
  };

  const handleProductUpdated = (updated: CleanProduct) => {
    setItems((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
    setSelectedProduct(updated);
    api.adminCleanProducts.categories(token).then((res) => setCategories(res.categories)).catch(() => {});
  };

  // ─── selection helpers ────────────────────────────────────────────────────
  const allOnPageSelected = items.length > 0 && items.every((item) => selectedIds.has(item.id));
  const someOnPageSelected = items.some((item) => selectedIds.has(item.id));

  const toggleSelectAll = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allOnPageSelected) {
        items.forEach((item) => next.delete(item.id));
      } else {
        items.forEach((item) => next.add(item.id));
      }
      return next;
    });
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  // ─── bulk handlers ──────────────────────────────────────────────────────
  const handleBulkAction = async (action: string, category?: string) => {
    if (selectedIds.size === 0) return;
    setBulkLoading(true);
    try {
      const result = await api.adminCleanProducts.bulk(
        { ids: Array.from(selectedIds), action, ...(category ? { category } : {}) },
        token
      );
      clearSelection();
      fetchProducts();
      if (action === 'changeCategory') {
        api.adminCleanProducts.categories(token).then((res) => setCategories(res.categories)).catch(() => {});
      }
      alert(t('bulkSuccess', { count: result.affected }));
    } catch (err) {
      alert(err instanceof ApiError ? err.message : t('bulkError'));
    } finally {
      setBulkLoading(false);
      setBulkDeleteOpen(false);
      setBulkCategoryOpen(false);
      setBulkNewCategory('');
    }
  };

  const totalPages = Math.ceil(total / limit);

  const verificationIcon = (status: string) => {
    if (status === 'VERIFIED') return <ShieldCheck className="h-4 w-4 text-green-600" />;
    if (status === 'FLAGGED') return <AlertTriangle className="h-4 w-4 text-amber-500" />;
    return <ShieldAlert className="h-4 w-4 text-muted-foreground/40" />;
  };

  if (showDuplicates) {
    return (
      <AdminDuplicatesView
        token={token}
        categories={categories}
        t={t}
        onBack={() => setShowDuplicates(false)}
        onMerged={fetchProducts}
      />
    );
  }

  return (
    <>
      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t('searchPlaceholder')}
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={categoryFilter} onValueChange={handleCategoryChange}>
            <SelectTrigger className="w-full sm:w-[220px]">
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

        <div className="flex flex-col sm:flex-row gap-3 items-start flex-wrap">
          <Tabs value={typeFilter} onValueChange={handleTypeChange}>
            <TabsList>
              <TabsTrigger value="ALL">{t('typeALL')}</TabsTrigger>
              <TabsTrigger value="BASE">{t('typeBASE')}</TabsTrigger>
              <TabsTrigger value="RETAIL">{t('typeRETAIL')}</TabsTrigger>
              <TabsTrigger value="MANUAL">{t('typeMANUAL')}</TabsTrigger>
            </TabsList>
          </Tabs>
          <Select value={verificationFilter} onValueChange={handleVerificationChange}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder={t('allStatuses')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__ALL__">{t('allStatuses')}</SelectItem>
              <SelectItem value="VERIFIED">{t('statusVerified')}</SelectItem>
              <SelectItem value="UNVERIFIED">{t('statusUnverified')}</SelectItem>
              <SelectItem value="FLAGGED">{t('statusFlagged')}</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground whitespace-nowrap">{t('qualityRange')}</span>
            <Input
              type="number"
              min={0}
              max={100}
              placeholder="0"
              value={minQuality}
              onChange={(e) => handleQualityChange(e.target.value, maxQuality)}
              className="w-16 h-9 text-xs"
            />
            <span className="text-xs text-muted-foreground">–</span>
            <Input
              type="number"
              min={0}
              max={100}
              placeholder="100"
              value={maxQuality}
              onChange={(e) => handleQualityChange(minQuality, e.target.value)}
              className="w-16 h-9 text-xs"
            />
          </div>
          <div className="flex gap-1.5 ml-auto">
            <Button variant="outline" size="sm" onClick={() => setShowDuplicates(true)} className="gap-1.5">
              <Merge className="h-4 w-4" />
              {t('duplicatesBtn')}
            </Button>
            <Button variant="outline" size="sm" onClick={handleToggleStats} className="gap-1.5">
              <BarChart3 className="h-4 w-4" />
              {t('stats')}
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportCsv} disabled={items.length === 0} className="gap-1.5">
              <Download className="h-4 w-4" />
              {t('exportCsv')}
            </Button>
          </div>
        </div>

        {showStats && stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
            <div className="rounded-lg border p-3 text-center">
              <div className="text-2xl font-bold">{stats.total}</div>
              <div className="text-xs text-muted-foreground">{t('statsTotal')}</div>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <div className="text-2xl font-bold">{stats.byType.BASE}</div>
              <div className="text-xs text-muted-foreground">{t('typeBASE')}</div>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <div className="text-2xl font-bold">{stats.byType.RETAIL}</div>
              <div className="text-xs text-muted-foreground">{t('typeRETAIL')}</div>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <div className="text-2xl font-bold text-green-600">{stats.byVerification.VERIFIED}</div>
              <div className="text-xs text-muted-foreground">{t('statusVerified')}</div>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <div className="text-2xl font-bold text-amber-500">{stats.byVerification.FLAGGED}</div>
              <div className="text-xs text-muted-foreground">{t('statusFlagged')}</div>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <div className="text-2xl font-bold">{stats.avgQualityScore}</div>
              <div className="text-xs text-muted-foreground">{t('statsAvgQuality')}</div>
            </div>
          </div>
        )}
      </div>

      {selectedIds.size > 0 && (
        <div className="flex items-center gap-2 rounded-lg border bg-muted/50 px-4 py-2 flex-wrap">
          <span className="text-sm font-medium">{t('bulkSelected', { count: selectedIds.size })}</span>
          <div className="flex gap-1.5 ml-2">
            <Button variant="outline" size="sm" onClick={() => handleBulkAction('verify')} disabled={bulkLoading} className="gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-green-600" />
              {t('bulkVerify')}
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleBulkAction('flag')} disabled={bulkLoading} className="gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
              {t('bulkFlag')}
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleBulkAction('unverify')} disabled={bulkLoading} className="gap-1.5">
              <ShieldAlert className="h-3.5 w-3.5" />
              {t('bulkUnverify')}
            </Button>
            <Button variant="outline" size="sm" onClick={() => { setBulkCategoryOpen(true); setBulkNewCategory(''); }} disabled={bulkLoading} className="gap-1.5">
              <FolderEdit className="h-3.5 w-3.5 text-blue-600" />
              {t('bulkChangeCategory')}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setBulkDeleteOpen(true)} disabled={bulkLoading} className="gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10">
              <Trash2 className="h-3.5 w-3.5" />
              {t('bulkDelete')}
            </Button>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7 ml-auto" onClick={clearSelection}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      <div className="rounded-md border overflow-x-auto">
        <Table className="w-full table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead className="w-10 px-2" onClick={(e) => e.stopPropagation()}>
                <Checkbox
                  checked={allOnPageSelected ? true : someOnPageSelected ? 'indeterminate' : false}
                  onCheckedChange={toggleSelectAll}
                  aria-label={t('selectAll')}
                />
              </TableHead>
              <TableHead className="w-auto px-2 text-xs">{t('colName')}</TableHead>
              <TableHead className="hidden md:table-cell w-[120px] px-2 text-xs truncate overflow-hidden">{t('colCategory')}</TableHead>
              <TableHead className="hidden lg:table-cell w-[60px] px-2 text-xs">{t('colType')}</TableHead>
              <TableHead className="text-right w-[50px] px-2 text-xs">kcal</TableHead>
              <TableHead className="text-right hidden sm:table-cell w-[40px] px-2 text-xs" title={t('colProtein')}>B</TableHead>
              <TableHead className="text-right hidden sm:table-cell w-[40px] px-2 text-xs" title={t('colFat')}>T</TableHead>
              <TableHead className="text-right hidden sm:table-cell w-[40px] px-2 text-xs" title={t('colCarbs')}>W</TableHead>
              <TableHead className="hidden md:table-cell text-center w-[40px] px-2 text-xs" title={t('colPortions')}>Porc.</TableHead>
              <TableHead className="hidden lg:table-cell text-center w-10 px-1 text-xs" title={t('colQuality')}>QS</TableHead>
              <TableHead className="hidden md:table-cell text-center w-10 px-1 text-xs">{verificationIcon('VERIFIED')}</TableHead>
              <TableHead className="w-[100px] text-right px-1 text-xs">{t('colActions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={12} className="text-center py-8 text-muted-foreground">
                  ...
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={12} className="text-center py-8 text-muted-foreground">
                  {t('noResults')}
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => {
                const typeBadge = TYPE_BADGE_MAP[item.type];
                const isSelected = selectedIds.has(item.id);
                return (
                  <TableRow key={item.id} className={`cursor-pointer hover:bg-muted/50 ${isSelected ? 'bg-muted/30' : ''}`} onClick={() => setSelectedProduct(item)}>
                    <TableCell className="w-10 px-2" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleSelect(item.id)}
                      />
                    </TableCell>
                    <TableCell className="font-medium truncate overflow-hidden text-sm px-2">
                      {item.name}
                      {item.brand && (
                        <span className="text-xs text-muted-foreground ml-1">({item.brand})</span>
                      )}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground text-xs truncate overflow-hidden px-2">
                      {formatCategory(item.category)}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell px-2">
                      {typeBadge && (
                        <Badge variant={typeBadge.variant} className="text-[10px] px-1.5 py-0">
                          {t(typeBadge.label)}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-xs tabular-nums px-2">
                      {item.nutrients?.kcalPer100g != null ? Math.round(item.nutrients.kcalPer100g) : '—'}
                    </TableCell>
                    <TableCell className="text-right hidden sm:table-cell text-xs tabular-nums px-2">
                      {item.nutrients?.proteinPer100g != null ? Number(item.nutrients.proteinPer100g).toFixed(1) : '—'}
                    </TableCell>
                    <TableCell className="text-right hidden sm:table-cell text-xs tabular-nums px-2">
                      {item.nutrients?.fatPer100g != null ? Number(item.nutrients.fatPer100g).toFixed(1) : '—'}
                    </TableCell>
                    <TableCell className="text-right hidden sm:table-cell text-xs tabular-nums px-2">
                      {item.nutrients?.carbsPer100g != null ? Number(item.nutrients.carbsPer100g).toFixed(1) : '—'}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-center text-xs tabular-nums px-2">
                      {item.portions?.length ?? 0}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-center text-xs tabular-nums px-1">
                      <span className={item.qualityScore >= 80 ? 'text-green-600' : item.qualityScore >= 50 ? 'text-amber-500' : 'text-destructive'}>
                        {item.qualityScore}
                      </span>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-center px-1">
                      {verificationIcon(item.verificationStatus)}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()} className="text-right overflow-hidden px-1">
                      <div className="flex gap-0 justify-end flex-nowrap">
                        {item.verificationStatus !== 'VERIFIED' && (
                          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => handleVerify(item)} title={t('verify')}>
                            <ShieldCheck className="h-3.5 w-3.5 text-green-600" />
                          </Button>
                        )}
                        {item.verificationStatus === 'VERIFIED' && (
                          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => handleFlag(item)} title={t('flag')}>
                            <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => { setChangeCategoryTarget(item); setNewCategory(item.category); }} title={t('changeCategory')}>
                          <FolderEdit className="h-3.5 w-3.5 text-blue-600" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => setDeleteTarget(item)} title={t('delete')}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
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

      <div className="text-xs text-muted-foreground">
        {t('totalCount', { count: total })}
      </div>

      <CleanProductDetailDialog
        product={selectedProduct}
        open={!!selectedProduct}
        onOpenChange={(open) => !open && setSelectedProduct(null)}
        onProductUpdated={handleProductUpdated}
        categories={categories}
        token={token}
        t={t}
      />

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('deleteTitle')}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {t('deleteConfirm', { name: deleteTarget?.name ?? '' })}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>{t('cancel')}</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? t('deleting') : t('delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!changeCategoryTarget} onOpenChange={(open) => { if (!open) { setChangeCategoryTarget(null); setNewCategory(''); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('changeCategoryTitle')}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground mb-2">
            {t('changeCategoryDesc', { name: changeCategoryTarget?.name ?? '' })}
          </p>
          <Select value={newCategory} onValueChange={setNewCategory}>
            <SelectTrigger>
              <SelectValue placeholder={t('changeCategoryPlaceholder')} />
            </SelectTrigger>
            <SelectContent>
              {categories.map((cat) => (
                <SelectItem key={cat} value={cat}>{formatCategory(cat)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setChangeCategoryTarget(null); setNewCategory(''); }}>{t('cancel')}</Button>
            <Button onClick={handleChangeCategory} disabled={changingCategory || !newCategory || newCategory === changeCategoryTarget?.category}>
              {changingCategory ? t('changingCategory') : t('changeCategorySave')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkDeleteOpen} onOpenChange={(open) => !open && setBulkDeleteOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('bulkDeleteTitle')}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {t('bulkDeleteConfirm', { count: selectedIds.size })}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDeleteOpen(false)}>{t('cancel')}</Button>
            <Button variant="destructive" onClick={() => handleBulkAction('delete')} disabled={bulkLoading}>
              {bulkLoading ? t('deleting') : t('bulkDelete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkCategoryOpen} onOpenChange={(open) => { if (!open) { setBulkCategoryOpen(false); setBulkNewCategory(''); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('bulkChangeCategoryTitle')}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground mb-2">
            {t('bulkChangeCategoryDesc', { count: selectedIds.size })}
          </p>
          <Select value={bulkNewCategory} onValueChange={setBulkNewCategory}>
            <SelectTrigger>
              <SelectValue placeholder={t('changeCategoryPlaceholder')} />
            </SelectTrigger>
            <SelectContent>
              {categories.map((cat) => (
                <SelectItem key={cat} value={cat}>{formatCategory(cat)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setBulkCategoryOpen(false); setBulkNewCategory(''); }}>{t('cancel')}</Button>
            <Button onClick={() => handleBulkAction('changeCategory', bulkNewCategory)} disabled={bulkLoading || !bulkNewCategory}>
              {bulkLoading ? t('changingCategory') : t('changeCategorySave')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
