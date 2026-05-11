'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { api, ApiError } from '@/lib/api';
import type { Recipe } from '@/types/api';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Search, Pencil, Trash2, Filter, Star, LayoutGrid, LayoutList, ChefHat, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AdminRecipeFormDialog } from './AdminRecipeFormDialog';
import { RecipeDetailSheet } from '@/components/shared/RecipeDetailSheet';
import { BulkActionBar } from './BulkActionBar';

const MEAL_TYPE_KEY: Record<string, string> = {
  BREAKFAST: 'mealBreakfast', SECOND_BREAKFAST: 'mealSecondBreakfast',
  LUNCH: 'mealLunch', DINNER: 'mealDinner', SUPPER: 'mealSupper',
  SNACK: 'mealSnack', DESSERT: 'mealDessert', DRINK: 'mealDrink',
  SAUCE: 'mealSauce', SIDE_DISH: 'mealSideDish',
};
const CATEGORY_KEY: Record<string, string> = {
  main: 'categoryMain', soup: 'categorySoup', salad: 'categorySalad',
  dessert: 'categoryDessert', other: 'categoryOther',
};
const DIFFICULTY_KEY: Record<string, string> = {
  EASY: 'difficultyEasy', MEDIUM: 'difficultyMedium', HARD: 'difficultyHard',
};

interface AdminRecipeListProps {
  token: string;
}

const MEAL_TYPE_OPTIONS = Object.keys(MEAL_TYPE_KEY);
const CATEGORY_OPTIONS = Object.keys(CATEGORY_KEY);
const DIFFICULTY_OPTIONS = Object.keys(DIFFICULTY_KEY);

export function AdminRecipeList({ token }: AdminRecipeListProps) {
  const t = useTranslations('admin.recipes');
  const [items, setItems] = useState<Recipe[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Recipe | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [sortBy, setSortBy] = useState<string>('');
  const [quickFilter, setQuickFilter] = useState<string>('');

  // Detailed filters
  const [mealType, setMealType] = useState('');
  const [category, setCategory] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [minKcal, setMinKcal] = useState('');
  const [maxKcal, setMaxKcal] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);

  const limit = 20;

  const fetchRecipes = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = {
        page, limit, search: search || undefined,
        mealType: mealType || undefined,
        category: category || undefined,
        difficulty: difficulty || undefined,
        minKcal: minKcal ? Number(minKcal) : undefined,
        maxKcal: maxKcal ? Number(maxKcal) : undefined,
      };
      if (sortBy) { params.sortBy = sortBy; params.sortOrder = 'desc'; }
      if (quickFilter === 'needs_attention') { params.qualityScoreMax = 40; params.verificationStatus = 'UNVERIFIED'; }
      if (quickFilter === 'ai_generated') { params.source = 'ai_generated'; }
      if (quickFilter === 'manual_only') { params.sourceExclude = 'ai_generated'; }
      if (quickFilter === 'meal_prep') { params.mealPrepFriendly = true; }
      const result = await api.adminRecipes.list(params, token);
      setItems(result.items);
      setTotal(result.total);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [page, search, sortBy, quickFilter, mealType, category, difficulty, minKcal, maxKcal, token]);

  useEffect(() => {
    fetchRecipes();
  }, [fetchRecipes]);

  // Clear selection when filters/page change
  useEffect(() => {
    setSelectedIds(new Set());
  }, [page, search, sortBy, quickFilter, mealType, category, difficulty, minKcal, maxKcal]);

  const handleSearch = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const handleCreate = () => {
    setEditingRecipe(null);
    setDialogOpen(true);
  };

  const handleEdit = (recipe: Recipe) => {
    setEditingRecipe(recipe);
    setDialogOpen(true);
  };

  const handleSaved = () => {
    setDialogOpen(false);
    setEditingRecipe(null);
    fetchRecipes();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.adminRecipes.remove(deleteTarget.id, token);
      setDeleteTarget(null);
      fetchRecipes();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : t('deleteError'));
    } finally {
      setDeleting(false);
    }
  };

  // Bulk selection handlers
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === items.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(items.map((i) => i.id)));
    }
  };

  const handleBulkAction = async (action: string, value?: unknown) => {
    if (selectedIds.size === 0) return;
    setBulkLoading(true);
    try {
      const result = await api.adminRecipes.bulk(
        { ids: Array.from(selectedIds), action, value },
        token
      );
      if (result.skipped > 0) {
        alert(t('bulkPartial', { updated: result.updated, skipped: result.skipped }));
      } else {
        alert(t('bulkSuccess', { updated: result.updated }));
      }
      setSelectedIds(new Set());
      fetchRecipes();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : t('bulkError'));
    } finally {
      setBulkLoading(false);
    }
  };

  const allSelected = items.length > 0 && selectedIds.size === items.length;
  const totalPages = Math.ceil(total / limit);

  const getMacro = (item: Recipe, key: 'kcal' | 'protein_g' | 'fat_g' | 'carbs_g') => {
    const snap = item.nutritionSnapshot;
    if (!snap) return null;
    const val = snap[key];
    return val != null ? Math.round(val) : null;
  };

  const hasDetailedFilters = mealType || category || difficulty || minKcal || maxKcal;
  const resetDetailedFilters = () => { setMealType(''); setCategory(''); setDifficulty(''); setMinKcal(''); setMaxKcal(''); setPage(1); };

  return (
    <>
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
        <div className="flex gap-2">
          <Button
            variant={viewMode === 'table' ? 'default' : 'outline'}
            size="icon"
            onClick={() => setViewMode('table')}
          >
            <LayoutList className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === 'grid' ? 'default' : 'outline'}
            size="icon"
            onClick={() => setViewMode('grid')}
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button onClick={handleCreate} className="gap-2">
            <Plus className="h-4 w-4" />
            {t('addRecipe')}
          </Button>
        </div>
      </div>

      {/* Quick filters */}
      <div className="flex flex-wrap gap-2">
        <Button variant={quickFilter === '' ? 'default' : 'outline'} size="sm" onClick={() => { setQuickFilter(''); setPage(1); }}>
          {t('filterAll') ?? 'Wszystkie'}
        </Button>
        <Button variant={quickFilter === 'needs_attention' ? 'default' : 'outline'} size="sm" onClick={() => { setQuickFilter('needs_attention'); setPage(1); }}>
          <Filter className="h-3 w-3 mr-1" />
          {t('filterNeedsAttention') ?? 'Wymagające uwagi'}
        </Button>
        <Button variant={quickFilter === 'ai_generated' ? 'default' : 'outline'} size="sm" onClick={() => { setQuickFilter('ai_generated'); setPage(1); }}>
          {t('filterAiGenerated') ?? 'AI'}
        </Button>
        <Button variant={quickFilter === 'manual_only' ? 'default' : 'outline'} size="sm" onClick={() => { setQuickFilter('manual_only'); setPage(1); }}>
          {t('filterManualOnly') ?? 'Manualne'}
        </Button>
        <Button variant={quickFilter === 'meal_prep' ? 'default' : 'outline'} size="sm" onClick={() => { setQuickFilter('meal_prep'); setPage(1); }}>
          {t('filterMealPrep') ?? 'Meal prep'}
        </Button>
      </div>

      {/* Detailed filters + sort */}
      <div className="flex flex-wrap gap-2 items-end">
        <Select value={mealType} onValueChange={(v) => { setMealType(v === '_all' ? '' : v); setPage(1); }}>
          <SelectTrigger className="w-[150px] h-8 text-xs">
            <SelectValue placeholder={t('filterMealType') ?? 'Typ posiłku'} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">{t('filterAll') ?? 'Wszystkie'}</SelectItem>
            {MEAL_TYPE_OPTIONS.map((mt) => (
              <SelectItem key={mt} value={mt}>{MEAL_TYPE_KEY[mt] ? t(MEAL_TYPE_KEY[mt]) : mt}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={category} onValueChange={(v) => { setCategory(v === '_all' ? '' : v); setPage(1); }}>
          <SelectTrigger className="w-[140px] h-8 text-xs">
            <SelectValue placeholder={t('filterCategory') ?? 'Kategoria'} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">{t('filterAll') ?? 'Wszystkie'}</SelectItem>
            {CATEGORY_OPTIONS.map((cat) => (
              <SelectItem key={cat} value={cat}>{CATEGORY_KEY[cat] ? t(CATEGORY_KEY[cat]) : cat}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={difficulty} onValueChange={(v) => { setDifficulty(v === '_all' ? '' : v); setPage(1); }}>
          <SelectTrigger className="w-[130px] h-8 text-xs">
            <SelectValue placeholder={t('filterDifficulty') ?? 'Trudność'} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">{t('filterAll') ?? 'Wszystkie'}</SelectItem>
            {DIFFICULTY_OPTIONS.map((d) => (
              <SelectItem key={d} value={d}>{DIFFICULTY_KEY[d] ? t(DIFFICULTY_KEY[d]) : d}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-1">
          <Input type="number" placeholder={t('filterMinKcal') ?? 'Min kcal'} value={minKcal} onChange={(e) => { setMinKcal(e.target.value); setPage(1); }} className="w-[90px] h-8 text-xs" />
          <span className="text-xs text-muted-foreground">–</span>
          <Input type="number" placeholder={t('filterMaxKcal') ?? 'Max kcal'} value={maxKcal} onChange={(e) => { setMaxKcal(e.target.value); setPage(1); }} className="w-[90px] h-8 text-xs" />
        </div>

        <Select value={sortBy} onValueChange={(v) => { setSortBy(v === '_none' ? '' : v); setPage(1); }}>
          <SelectTrigger className="w-[140px] h-8 text-xs">
            <SelectValue placeholder={t('sortBy') ?? 'Sortuj...'} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_none">{t('sortDefault') ?? 'Domyślnie'}</SelectItem>
            <SelectItem value="title">{t('sortByTitle') ?? 'Nazwa'}</SelectItem>
            <SelectItem value="qualityScore">{t('sortByQuality') ?? 'Jakość'}</SelectItem>
            <SelectItem value="createdAt">{t('sortByDate') ?? 'Data'}</SelectItem>
            <SelectItem value="totalTime">{t('sortByTime') ?? 'Czas'}</SelectItem>
            <SelectItem value="averageRating">{t('sortByRating') ?? 'Ocena'}</SelectItem>
          </SelectContent>
        </Select>

        {hasDetailedFilters && (
          <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={resetDetailedFilters}>
            {t('filterReset') ?? 'Wyczyść'}
          </Button>
        )}
      </div>

      {/* Results count */}
      <div className="text-xs text-muted-foreground">
        {total} {t('resultsLabel') ?? 'przepisów'}
      </div>

      {/* Bulk action bar */}
      <BulkActionBar
        selectedCount={selectedIds.size}
        onAction={handleBulkAction}
        onClear={() => setSelectedIds(new Set())}
        loading={bulkLoading}
      />

      {viewMode === 'table' && (
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px]">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={toggleSelectAll}
                  aria-label={allSelected ? t('bulkDeselectAll') : t('bulkSelectAll')}
                />
              </TableHead>
              <TableHead>{t('colName')}</TableHead>
              <TableHead className="hidden md:table-cell">{t('colCategory')}</TableHead>
              <TableHead className="hidden md:table-cell">{t('colMealType')}</TableHead>
              <TableHead className="hidden sm:table-cell">{t('colDifficulty')}</TableHead>
              <TableHead className="text-right hidden sm:table-cell">{t('colKcal') ?? 'kcal'}</TableHead>
              <TableHead className="text-right hidden lg:table-cell">B</TableHead>
              <TableHead className="text-right hidden lg:table-cell">T</TableHead>
              <TableHead className="text-right hidden lg:table-cell">W</TableHead>
              <TableHead className="text-right hidden sm:table-cell">{t('colTime')}</TableHead>
              <TableHead className="hidden md:table-cell text-center">{t('colQuality') ?? 'Jakość'}</TableHead>
              <TableHead className="hidden lg:table-cell text-center">{t('colRating') ?? 'Ocena'}</TableHead>
              <TableHead className="w-[100px]">{t('colActions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                  ...
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                  {t('noResults')}
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => (
                <TableRow
                  key={item.id}
                  className={`cursor-pointer ${selectedIds.has(item.id) ? 'bg-muted/50' : ''}`}
                  onClick={() => { setDetailId(item.id); setDetailOpen(true); }}
                >
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selectedIds.has(item.id)}
                      onCheckedChange={() => toggleSelect(item.id)}
                    />
                  </TableCell>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {item.name}
                      {item.source === 'ai_generated' && <Badge variant="outline" className="text-[10px] px-1 py-0">AI</Badge>}
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">
                    {item.category ? (CATEGORY_KEY[item.category] ? t(CATEGORY_KEY[item.category]) : item.category) : '—'}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">
                    {item.mealType ? (MEAL_TYPE_KEY[item.mealType] ? t(MEAL_TYPE_KEY[item.mealType]) : item.mealType) : '—'}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-muted-foreground">
                    {item.difficulty ? (DIFFICULTY_KEY[item.difficulty] ? t(DIFFICULTY_KEY[item.difficulty]) : item.difficulty) : '—'}
                  </TableCell>
                  <TableCell className="text-right hidden sm:table-cell tabular-nums font-medium">
                    {getMacro(item, 'kcal') ?? '—'}
                  </TableCell>
                  <TableCell className="text-right hidden lg:table-cell tabular-nums text-muted-foreground">
                    {getMacro(item, 'protein_g') != null ? `${getMacro(item, 'protein_g')}g` : '—'}
                  </TableCell>
                  <TableCell className="text-right hidden lg:table-cell tabular-nums text-muted-foreground">
                    {getMacro(item, 'fat_g') != null ? `${getMacro(item, 'fat_g')}g` : '—'}
                  </TableCell>
                  <TableCell className="text-right hidden lg:table-cell tabular-nums text-muted-foreground">
                    {getMacro(item, 'carbs_g') != null ? `${getMacro(item, 'carbs_g')}g` : '—'}
                  </TableCell>
                  <TableCell className="text-right hidden sm:table-cell">
                    {item.totalTimeMinutes ? `${item.totalTimeMinutes} ${t('min')}` : '—'}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-center">
                    {item.qualityScore != null ? (
                      <Badge variant={item.qualityScore >= 70 ? 'default' : item.qualityScore >= 40 ? 'secondary' : 'destructive'}>
                        {item.qualityScore}
                      </Badge>
                    ) : '—'}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-center">
                    {item.averageRating != null && item.ratingCount ? (
                      <span className="inline-flex items-center gap-1 text-sm">
                        <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
                        <span className="font-medium">{Number(item.averageRating).toFixed(1)}</span>
                        <span className="text-xs text-muted-foreground">({item.ratingCount})</span>
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">{t('ratingNone')}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleEdit(item); }} title={t('edit')}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setDeleteTarget(item); }} title={t('delete')}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      )}

      {/* Grid view */}
      {viewMode === 'grid' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {loading ? (
            <div className="col-span-full text-center py-8 text-muted-foreground">...</div>
          ) : items.length === 0 ? (
            <div className="col-span-full text-center py-8 text-muted-foreground">{t('noResults')}</div>
          ) : (
            items.map((item) => (
              <div
                key={item.id}
                className="rounded-lg border bg-card hover:shadow-md transition-shadow cursor-pointer p-4 flex flex-col gap-3"
                onClick={() => { setDetailId(item.id); setDetailOpen(true); }}
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-medium text-sm leading-tight line-clamp-2">{item.name}</h3>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); handleEdit(item); }}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); setDeleteTarget(item); }}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  {item.mealType && MEAL_TYPE_KEY[item.mealType] && <Badge variant="secondary" className="text-[10px]">{t(MEAL_TYPE_KEY[item.mealType])}</Badge>}
                  {item.source === 'ai_generated' && <Badge variant="outline" className="text-[10px]">AI</Badge>}
                  {item.qualityScore != null && (
                    <Badge variant={item.qualityScore >= 70 ? 'default' : item.qualityScore >= 40 ? 'secondary' : 'destructive'} className="text-[10px]">
                      Q:{item.qualityScore}
                    </Badge>
                  )}
                </div>
                <div className="grid grid-cols-4 gap-1 text-center">
                  <div><div className="text-xs text-muted-foreground">kcal</div><div className="text-sm font-semibold tabular-nums">{getMacro(item, 'kcal') ?? '—'}</div></div>
                  <div><div className="text-xs text-muted-foreground">B</div><div className="text-sm tabular-nums">{getMacro(item, 'protein_g') != null ? `${getMacro(item, 'protein_g')}g` : '—'}</div></div>
                  <div><div className="text-xs text-muted-foreground">T</div><div className="text-sm tabular-nums">{getMacro(item, 'fat_g') != null ? `${getMacro(item, 'fat_g')}g` : '—'}</div></div>
                  <div><div className="text-xs text-muted-foreground">W</div><div className="text-sm tabular-nums">{getMacro(item, 'carbs_g') != null ? `${getMacro(item, 'carbs_g')}g` : '—'}</div></div>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground mt-auto pt-2 border-t">
                  <div className="flex items-center gap-3">
                    {item.difficulty && <span className="flex items-center gap-1"><ChefHat className="h-3 w-3" />{DIFFICULTY_KEY[item.difficulty] ? t(DIFFICULTY_KEY[item.difficulty]) : item.difficulty}</span>}
                    {item.totalTimeMinutes && <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{item.totalTimeMinutes} min</span>}
                  </div>
                  {item.averageRating != null && item.ratingCount ? (
                    <span className="inline-flex items-center gap-0.5"><Star className="h-3 w-3 text-amber-500 fill-amber-500" />{Number(item.averageRating).toFixed(1)}</span>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </div>
      )}

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

      <AdminRecipeFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        recipe={editingRecipe}
        token={token}
        onSaved={handleSaved}
      />

      <RecipeDetailSheet
        recipeId={detailId}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        token={token}
        translationNamespace="admin.recipes"
        fetchFn={api.adminRecipes.getById}
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
    </>
  );
}
