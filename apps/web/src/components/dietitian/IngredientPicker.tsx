'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { api, ApiError } from '@/lib/api';
import type { CleanProduct, CleanProductType, CleanProductPortion } from '@/types/api';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Trash2, Search, GripVertical, ChevronUp, ChevronDown, Info } from 'lucide-react';
import { formatCategory } from '@/lib/format-category';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface IngredientRow {
  id: string; // temp client ID
  cleanProductId: string;
  foodProductId?: string; // legacy FK — old recipes may use this instead of cleanProductId
  productName: string;
  portions: CleanProductPortion[];
  nutrientsPer100g: { kcal: number; protein: number; fat: number; carbs: number };
  quantity: number;
  unit: string; // "g" or portion name
  grams: number;
  isOptional: boolean;
  groupName: string;
  notes: string;
  sortOrder: number;
}

type CleanProductApi = typeof api.cleanProducts | typeof api.adminCleanProducts;

interface Props {
  ingredients: IngredientRow[];
  onChange: (ingredients: IngredientRow[]) => void;
  token: string;
  translationNamespace?: string;
  cleanProductNamespace?: 'cleanProducts' | 'adminCleanProducts';
}

let nextId = 1;
function tempId() {
  return `tmp-${nextId++}-${Date.now()}`;
}

// ─── Product Search Autocomplete ─────────────────────────────────────────────

function ProductSearch({
  onSelect,
  token,
  placeholder,
  typeFilter,
  categoryFilter,
  cleanProductApi,
}: {
  onSelect: (product: CleanProduct) => void;
  token: string;
  placeholder: string;
  typeFilter?: CleanProductType;
  categoryFilter?: string;
  cleanProductApi: CleanProductApi;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CleanProduct[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const search = useCallback(
    async (q: string) => {
      if (q.length < 2) {
        setResults([]);
        setIsOpen(false);
        return;
      }
      setLoading(true);
      try {
        const res = await cleanProductApi.search(q, token, typeFilter, categoryFilter);
        setResults(res.items ?? []);
        setIsOpen((res.items ?? []).length > 0);
        setHighlightIndex(-1);
      } catch {
        setResults([]);
        setIsOpen(false);
      } finally {
        setLoading(false);
      }
    },
    [token, typeFilter, categoryFilter, cleanProductApi]
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(query), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, search]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function handleSelect(product: CleanProduct) {
    onSelect(product);
    setQuery('');
    setResults([]);
    setIsOpen(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!isOpen || results.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIndex((prev) => (prev + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIndex((prev) => (prev <= 0 ? results.length - 1 : prev - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightIndex >= 0 && highlightIndex < results.length) {
        handleSelect(results[highlightIndex]);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  }

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => results.length > 0 && setIsOpen(true)}
          placeholder={placeholder}
          className="pl-8 text-sm h-9"
        />
        {loading && (
          <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
            <div className="h-3.5 w-3.5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          </div>
        )}
      </div>

      {isOpen && results.length > 0 && (
        <div className="absolute z-50 mt-1 w-full max-h-60 overflow-y-auto rounded-lg border border-border bg-popover shadow-lg">
          {results.map((product, idx) => (
            <button
              key={product.id}
              type="button"
              onClick={() => handleSelect(product)}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors ${
                idx === highlightIndex ? 'bg-accent' : ''
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="font-medium truncate flex-1">{product.name}</span>
                {product.brand && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 shrink-0 truncate max-w-[140px]">
                    {product.brand}
                  </span>
                )}
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
                  {product.type}
                </span>
              </div>
              {product.nutrients && (
                <div className="text-xs text-muted-foreground">
                  {product.nutrients.kcalPer100g} kcal · B: {product.nutrients.proteinPer100g}g · T: {product.nutrients.fatPer100g}g · W: {product.nutrients.carbsPer100g}g
                  <span className="ml-1 opacity-60">/ 100g</span>
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Single Ingredient Row ───────────────────────────────────────────────────

function IngredientRowComponent({
  row,
  onUpdate,
  onRemove,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
  t,
}: {
  row: IngredientRow;
  onUpdate: (updates: Partial<IngredientRow>) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isFirst: boolean;
  isLast: boolean;
  t: ReturnType<typeof useTranslations>;
}) {
  const unitOptions = [
    { value: 'g', label: 'g' },
    ...row.portions.map((p) => ({
      value: p.portionName,
      label: `${p.portionName} (${p.weightG}g)`,
    })),
  ];

  function handleUnitChange(unit: string) {
    if (unit === 'g') {
      onUpdate({ unit: 'g', grams: row.quantity });
    } else {
      const portion = row.portions.find((p) => p.portionName === unit);
      if (portion) {
        onUpdate({ unit, grams: Math.round(row.quantity * portion.weightG * 100) / 100 });
      }
    }
  }

  function handleQuantityChange(qty: number) {
    const newQty = qty || 0;
    if (row.unit === 'g') {
      onUpdate({ quantity: newQty, grams: newQty });
    } else {
      const portion = row.portions.find((p) => p.portionName === row.unit);
      if (portion) {
        onUpdate({ quantity: newQty, grams: Math.round(newQty * portion.weightG * 100) / 100 });
      } else {
        onUpdate({ quantity: newQty });
      }
    }
  }

  const hasError = !row.grams || row.grams <= 0;

  return (
    <div className={`border rounded-lg p-3 space-y-2 bg-card ${hasError ? 'border-destructive' : ''}`}>
      <div className="flex items-center gap-2">
        <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="font-medium text-sm flex-1 truncate">{row.productName}</span>
        <div className="flex items-center gap-1">
          <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={onMoveUp} disabled={isFirst}>
            <ChevronUp className="h-3.5 w-3.5" />
          </Button>
          <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={onMoveDown} disabled={isLast}>
            <ChevronDown className="h-3.5 w-3.5" />
          </Button>
          <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={onRemove}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end">
        <div className="space-y-1">
          <Label className="text-xs">{t('formIngredientQuantity')}</Label>
          <Input
            type="number"
            min={0.1}
            step="any"
            value={row.quantity || ''}
            onChange={(e) => handleQuantityChange(Number(e.target.value))}
            className={`h-8 text-sm ${hasError ? 'border-destructive' : ''}`}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{t('formIngredientUnit')}</Label>
          <Select value={row.unit} onValueChange={handleUnitChange}>
            <SelectTrigger className="h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {unitOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="text-sm text-muted-foreground pb-1">
          = {row.grams}g
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">{t('formIngredientGroup')}</Label>
          <Input
            value={row.groupName}
            onChange={(e) => onUpdate({ groupName: e.target.value })}
            placeholder="—"
            className="h-8 text-sm"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{t('formIngredientNotes')}</Label>
          <Input
            value={row.notes}
            onChange={(e) => onUpdate({ notes: e.target.value })}
            placeholder="—"
            className="h-8 text-sm"
          />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={row.isOptional}
          onChange={(e) => onUpdate({ isOptional: e.target.checked })}
          className="rounded border-border"
        />
        {t('formIngredientOptional')}
      </label>
    </div>
  );
}

// ─── Main IngredientPicker ───────────────────────────────────────────────────

export function IngredientPicker({
  ingredients,
  onChange,
  token,
  translationNamespace = 'dietitian.recipes',
  cleanProductNamespace = 'cleanProducts',
}: Props) {
  const t = useTranslations(translationNamespace);
  const [typeFilter, setTypeFilter] = useState<CleanProductType | undefined>(undefined);
  const [categoryFilter, setCategoryFilter] = useState<string | undefined>(undefined);
  const [categories, setCategories] = useState<string[]>([]);

  const cleanProductApi = api[cleanProductNamespace] as CleanProductApi;

  useEffect(() => {
    cleanProductApi.categories(token)
      .then((res) => setCategories(res.categories ?? []))
      .catch(() => {});
  }, [token, cleanProductApi]);

  function addProduct(product: CleanProduct) {
    const n = product.nutrients;
    const newRow: IngredientRow = {
      id: tempId(),
      cleanProductId: product.id,
      productName: product.name,
      portions: product.portions ?? [],
      nutrientsPer100g: {
        kcal: n?.kcalPer100g ?? 0,
        protein: n?.proteinPer100g ?? 0,
        fat: n?.fatPer100g ?? 0,
        carbs: n?.carbsPer100g ?? 0,
      },
      quantity: 100,
      unit: 'g',
      grams: 100,
      isOptional: false,
      groupName: '',
      notes: '',
      sortOrder: ingredients.length,
    };
    onChange([...ingredients, newRow]);
  }

  function updateRow(idx: number, updates: Partial<IngredientRow>) {
    onChange(ingredients.map((r, i) => (i === idx ? { ...r, ...updates } : r)));
  }

  function removeRow(idx: number) {
    onChange(ingredients.filter((_, i) => i !== idx));
  }

  function moveRow(idx: number, dir: -1 | 1) {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= ingredients.length) return;
    const arr = [...ingredients];
    [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
    onChange(arr.map((r, i) => ({ ...r, sortOrder: i })));
  }

  const tabValue = typeFilter ?? 'ALL';

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Tabs
            value={tabValue}
            onValueChange={(v) => setTypeFilter(v === 'ALL' ? undefined : (v as CleanProductType))}
          >
            <TabsList className="h-8">
              <TabsTrigger value="ALL" className="text-xs px-3 py-1">{t('formIngredientAllTypes')}</TabsTrigger>
              <TabsTrigger value="BASE" className="text-xs px-3 py-1">{t('formIngredientBaseType')}</TabsTrigger>
              <TabsTrigger value="RETAIL" className="text-xs px-3 py-1">{t('formIngredientRetailType')}</TabsTrigger>
            </TabsList>
          </Tabs>
          {categories.length > 0 && (
            <Select
              value={categoryFilter ?? '__ALL__'}
              onValueChange={(v) => setCategoryFilter(v === '__ALL__' ? undefined : v)}
            >
              <SelectTrigger className="h-8 text-xs w-auto min-w-[140px]">
                <SelectValue placeholder={t('formIngredientAllCategories')} />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                <SelectItem value="__ALL__" className="text-xs">{t('formIngredientAllCategories')}</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat} value={cat} className="text-xs">{formatCategory(cat)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <ProductSearch
          onSelect={addProduct}
          token={token}
          placeholder={t('formIngredientSearch')}
          typeFilter={typeFilter}
          categoryFilter={categoryFilter}
          cleanProductApi={cleanProductApi}
        />
        <p className="text-xs text-muted-foreground">{t('formIngredientRawWeight')}</p>
      </div>

      {ingredients.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-6">{t('formIngredientEmpty')}</p>
      )}

      {ingredients.length > 0 && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 rounded-md px-3 py-2">
          <Info className="h-3.5 w-3.5 shrink-0" />
          <span>{t('formIngredientAddMoreHint')}</span>
        </div>
      )}

      <div className="space-y-2">
        {ingredients.map((row, idx) => (
          <IngredientRowComponent
            key={row.id}
            row={row}
            onUpdate={(updates) => updateRow(idx, updates)}
            onRemove={() => removeRow(idx)}
            onMoveUp={() => moveRow(idx, -1)}
            onMoveDown={() => moveRow(idx, 1)}
            isFirst={idx === 0}
            isLast={idx === ingredients.length - 1}
            t={t}
          />
        ))}
      </div>
    </div>
  );
}
