'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import type { Recipe } from '@/types/api';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, Pencil, LayoutGrid, LayoutList, Star, ChefHat, Clock } from 'lucide-react';
import { RecipeFormDialog } from './RecipeFormDialog';
import { RecipeDetailSheet } from '@/components/shared/RecipeDetailSheet';

// Maps for translating DB enum/string values to translation keys
const MEAL_TYPE_KEY: Record<string, string> = {
  BREAKFAST: 'mealBreakfast', SECOND_BREAKFAST: 'mealSecondBreakfast',
  LUNCH: 'mealLunch', DINNER: 'mealDinner', SUPPER: 'mealSupper',
  SNACK: 'mealSnack', DESSERT: 'mealDessert', DRINK: 'mealDrink',
  SAUCE: 'mealSauce', SIDE_DISH: 'mealSideDish',
};
const MEAL_TYPE_OPTIONS = Object.keys(MEAL_TYPE_KEY);

const CATEGORY_KEY: Record<string, string> = {
  main: 'categoryMain', soup: 'categorySoup', salad: 'categorySalad',
  dessert: 'categoryDessert', other: 'categoryOther',
};
const CATEGORY_OPTIONS = Object.keys(CATEGORY_KEY);

const DIFFICULTY_KEY: Record<string, string> = {
  EASY: 'difficultyEasy', MEDIUM: 'difficultyMedium', HARD: 'difficultyHard',
};
const DIFFICULTY_OPTIONS = Object.keys(DIFFICULTY_KEY);

const SOURCE_FILTER_OPTIONS = [
  { value: '', labelKey: 'filterAll' },
  { value: 'manual_only', labelKey: 'filterManualOnly' },
  { value: 'ai_generated', labelKey: 'filterAiGenerated' },
];

interface RecipeListProps {
  token: string;
}

export function RecipeList({ token }: RecipeListProps) {
  const t = useTranslations('dietitian.recipes');
  const [items, setItems] = useState<Recipe[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // Filters
  const [mealType, setMealType] = useState('');
  const [category, setCategory] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [mealPrepOnly, setMealPrepOnly] = useState(false);
  const [minKcal, setMinKcal] = useState('');
  const [maxKcal, setMaxKcal] = useState('');

  // Sort
  const [sortBy, setSortBy] = useState('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // View mode
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');

  const limit = 20;

  const fetchRecipes = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = {
        page,
        limit,
        search: search || undefined,
        mealType: mealType || undefined,
        category: category || undefined,
        difficulty: difficulty || undefined,
        mealPrepFriendly: mealPrepOnly || undefined,
        minKcal: minKcal ? Number(minKcal) : undefined,
        maxKcal: maxKcal ? Number(maxKcal) : undefined,
        sortBy: sortBy || undefined,
        sortOrder: sortBy ? sortOrder : undefined,
      };
      if (sourceFilter === 'ai_generated') {
        params.source = 'ai_generated';
      } else if (sourceFilter === 'manual_only') {
        params.sourceExclude = 'ai_generated';
      }
      const result = await api.recipes.list(params, token);
      setItems(result.items);
      setTotal(result.total);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [page, search, mealType, category, difficulty, sourceFilter, mealPrepOnly, minKcal, maxKcal, sortBy, sortOrder, token]);

  useEffect(() => {
    fetchRecipes();
  }, [fetchRecipes]);

  const resetFilters = () => {
    setMealType('');
    setCategory('');
    setDifficulty('');
    setSourceFilter('');
    setMealPrepOnly(false);
    setMinKcal('');
    setMaxKcal('');
    setSortBy('');
    setPage(1);
  };

  const hasActiveFilters = mealType || category || difficulty || sourceFilter || mealPrepOnly || minKcal || maxKcal;

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

  const openDetail = (id: string) => {
    setDetailId(id);
    setDetailOpen(true);
  };

  const totalPages = Math.ceil(total / limit);

  const getMacro = (item: Recipe, key: 'kcal' | 'protein_g' | 'fat_g' | 'carbs_g') => {
    const snap = item.nutritionSnapshot;
    if (!snap) return null;
    const val = snap[key];
    return val != null ? Math.round(val) : null;
  };

  return (
    <>
      {/* Search + Add */}
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
          <div data-tour="dt-recipes-view-toggle" className="flex gap-2">
            <Button
              variant={viewMode === 'table' ? 'default' : 'outline'}
              size="icon"
              onClick={() => setViewMode('table')}
              title={t('viewTable') ?? 'Tabela'}
            >
              <LayoutList className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'grid' ? 'default' : 'outline'}
              size="icon"
              onClick={() => setViewMode('grid')}
              title={t('viewGrid') ?? 'Kafelki'}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
          </div>
          <Button onClick={handleCreate} className="gap-2" data-tour="dt-recipes-add">
            <Plus className="h-4 w-4" />
            {t('addRecipe')}
          </Button>
        </div>
      </div>

      {/* Filters row */}
      <div className="flex flex-wrap gap-2 items-end" data-tour="dt-recipes-filters">
        <Select value={mealType} onValueChange={(v) => { setMealType(v === '_all' ? '' : v); setPage(1); }}>
          <SelectTrigger className="w-[150px] h-8 text-xs">
            <SelectValue placeholder={t('filterMealType') ?? 'Typ posiłku'} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">{t('filterAll') ?? 'Wszystkie'}</SelectItem>
            {MEAL_TYPE_OPTIONS.map((mt) => (
              <SelectItem key={mt} value={mt}>
                {MEAL_TYPE_KEY[mt] ? t(MEAL_TYPE_KEY[mt]) : mt}
              </SelectItem>
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
              <SelectItem key={cat} value={cat}>
                {CATEGORY_KEY[cat] ? t(CATEGORY_KEY[cat]) : cat}
              </SelectItem>
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
              <SelectItem key={d} value={d}>
                {DIFFICULTY_KEY[d] ? t(DIFFICULTY_KEY[d]) : d}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={sourceFilter} onValueChange={(v) => { setSourceFilter(v === '_all' ? '' : v); setPage(1); }}>
          <SelectTrigger className="w-[130px] h-8 text-xs">
            <SelectValue placeholder={t('filterSource') ?? 'Źródło'} />
          </SelectTrigger>
          <SelectContent>
            {SOURCE_FILTER_OPTIONS.map((opt) => (
              <SelectItem key={opt.value || '_all'} value={opt.value || '_all'}>
                {t(opt.labelKey) ?? opt.labelKey}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          variant={mealPrepOnly ? 'default' : 'outline'}
          size="sm"
          className="h-8 text-xs"
          onClick={() => { setMealPrepOnly(!mealPrepOnly); setPage(1); }}
        >
          {t('filterMealPrep') ?? 'Meal prep'}
        </Button>

        {/* Kcal range */}
        <div className="flex items-center gap-1">
          <Input
            type="number"
            placeholder={t('filterMinKcal') ?? 'Min kcal'}
            value={minKcal}
            onChange={(e) => { setMinKcal(e.target.value); setPage(1); }}
            className="w-[90px] h-8 text-xs"
          />
          <span className="text-xs text-muted-foreground">–</span>
          <Input
            type="number"
            placeholder={t('filterMaxKcal') ?? 'Max kcal'}
            value={maxKcal}
            onChange={(e) => { setMaxKcal(e.target.value); setPage(1); }}
            className="w-[90px] h-8 text-xs"
          />
        </div>

        {/* Sort */}
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

        {sortBy && (
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs px-2"
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
          >
            {sortOrder === 'asc' ? '↑' : '↓'}
          </Button>
        )}

        {hasActiveFilters && (
          <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={resetFilters}>
            {t('filterReset') ?? 'Wyczyść filtry'}
          </Button>
        )}
      </div>

      {/* Results count */}
      <div className="text-xs text-muted-foreground">
        {t('resultsCount', { count: total }) ?? `${total} przepisów`}
      </div>

      {/* TABLE VIEW */}
      {viewMode === 'table' && (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('colName')}</TableHead>
                <TableHead className="hidden md:table-cell">{t('colCategory')}</TableHead>
                <TableHead className="hidden lg:table-cell">{t('colMealType')}</TableHead>
                <TableHead className="hidden sm:table-cell">{t('colDifficulty')}</TableHead>
                <TableHead className="text-right hidden sm:table-cell">{t('colKcal')}</TableHead>
                <TableHead className="text-right hidden lg:table-cell">{t('colProtein') ?? 'B'}</TableHead>
                <TableHead className="text-right hidden lg:table-cell">{t('colFat') ?? 'T'}</TableHead>
                <TableHead className="text-right hidden lg:table-cell">{t('colCarbs') ?? 'W'}</TableHead>
                <TableHead className="text-right hidden sm:table-cell">{t('colTime')}</TableHead>
                <TableHead className="hidden md:table-cell text-center">{t('colRating') ?? 'Ocena'}</TableHead>
                <TableHead className="w-[80px]">{t('colActions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                    ...
                  </TableCell>
                </TableRow>
              ) : items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                    {t('noResults')}
                  </TableCell>
                </TableRow>
              ) : (
                items.map((item) => (
                  <TableRow key={item.id} className="cursor-pointer" onClick={() => openDetail(item.id)}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {item.name}
                        {item.source === 'ai_generated' && (
                          <Badge variant="outline" className="text-[10px] px-1 py-0">AI</Badge>
                        )}
                        {item.mealPrepFriendly && (
                          <Badge variant="secondary" className="text-[10px] px-1 py-0">MP</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground">
                      {item.category ? (CATEGORY_KEY[item.category] ? t(CATEGORY_KEY[item.category]) : item.category) : '—'}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-muted-foreground">
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
                      {item.averageRating != null && item.ratingCount ? (
                        <span className="inline-flex items-center gap-1 text-sm">
                          <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
                          <span className="font-medium">{Number(item.averageRating).toFixed(1)}</span>
                          <span className="text-xs text-muted-foreground">({item.ratingCount})</span>
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">{t('ratingNone') ?? '—'}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleEdit(item); }}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* GRID VIEW */}
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
                onClick={() => openDetail(item.id)}
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-medium text-sm leading-tight line-clamp-2">{item.name}</h3>
                  <Button variant="ghost" size="icon" className="shrink-0 h-7 w-7" onClick={(e) => { e.stopPropagation(); handleEdit(item); }}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                </div>

                {/* Badges */}
                <div className="flex flex-wrap gap-1">
                  {item.mealType && MEAL_TYPE_KEY[item.mealType] && (
                    <Badge variant="secondary" className="text-[10px]">{t(MEAL_TYPE_KEY[item.mealType])}</Badge>
                  )}
                  {item.category && CATEGORY_KEY[item.category] && (
                    <Badge variant="outline" className="text-[10px]">{t(CATEGORY_KEY[item.category])}</Badge>
                  )}
                  {item.source === 'ai_generated' && (
                    <Badge variant="outline" className="text-[10px]">AI</Badge>
                  )}
                  {item.mealPrepFriendly && (
                    <Badge variant="secondary" className="text-[10px]">Meal prep</Badge>
                  )}
                </div>

                {/* Macros */}
                <div className="grid grid-cols-4 gap-1 text-center">
                  <div>
                    <div className="text-xs text-muted-foreground">kcal</div>
                    <div className="text-sm font-semibold tabular-nums">{getMacro(item, 'kcal') ?? '—'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">B</div>
                    <div className="text-sm tabular-nums">{getMacro(item, 'protein_g') != null ? `${getMacro(item, 'protein_g')}g` : '—'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">T</div>
                    <div className="text-sm tabular-nums">{getMacro(item, 'fat_g') != null ? `${getMacro(item, 'fat_g')}g` : '—'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">W</div>
                    <div className="text-sm tabular-nums">{getMacro(item, 'carbs_g') != null ? `${getMacro(item, 'carbs_g')}g` : '—'}</div>
                  </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between text-xs text-muted-foreground mt-auto pt-2 border-t">
                  <div className="flex items-center gap-3">
                    {item.difficulty && (
                      <span className="flex items-center gap-1">
                        <ChefHat className="h-3 w-3" />
                        {DIFFICULTY_KEY[item.difficulty] ? t(DIFFICULTY_KEY[item.difficulty]) : item.difficulty}
                      </span>
                    )}
                    {item.totalTimeMinutes && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {item.totalTimeMinutes} {t('min')}
                      </span>
                    )}
                  </div>
                  {item.averageRating != null && item.ratingCount ? (
                    <span className="inline-flex items-center gap-0.5">
                      <Star className="h-3 w-3 text-amber-500 fill-amber-500" />
                      {Number(item.averageRating).toFixed(1)}
                    </span>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Pagination */}
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

      <RecipeFormDialog
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
      />
    </>
  );
}
