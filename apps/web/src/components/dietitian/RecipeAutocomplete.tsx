'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import { cleanIngredientName } from '@/lib/ingredient-display';
import type { Recipe } from '@/types/api';
import { Input } from '@/components/ui/input';
import { Search, ChefHat } from 'lucide-react';

export interface SelectedRecipe {
  id: string;
  name: string;
  totalTimeMinutes: number | null;
  servings: number | null;
  ingredients: Array<{
    name: string;
    amountG: number;
    kcal: number;
    protein: number;
    fat: number;
    carbs: number;
  }>;
  steps: string[];
  tips?: string;
  /** Per-serving macros from nutritionSnapshot */
  macrosPerServing?: { kcal: number; protein: number; fat: number; carbs: number };
}

interface Props {
  onSelect: (recipe: SelectedRecipe) => void;
  placeholder?: string;
  className?: string;
}

export function RecipeAutocomplete({ onSelect, placeholder, className }: Props) {
  const { data: session } = useSession();
  const t = useTranslations('dietitian.visualEditor');

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Recipe[]>([]);
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

      const token = '';
      if (!token) return;

      setLoading(true);
      try {
        const res = await api.recipes.search(q, token);
        const items = res.recipes ?? [];
        setResults(items);
        setIsOpen(items.length > 0);
        setHighlightIndex(-1);
      } catch {
        setResults([]);
        setIsOpen(false);
      } finally {
        setLoading(false);
      }
    },
    []
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

  function handleSelect(recipe: Recipe) {
    const servings = recipe.servings ?? 1;
    const ns = recipe.nutritionSnapshot;

    const mapped: SelectedRecipe = {
      id: recipe.id,
      name: recipe.name,
      totalTimeMinutes: recipe.totalTimeMinutes ?? null,
      servings: recipe.servings ?? null,
      ingredients: (recipe.ingredients ?? []).map((ing) => {
        const name =
          ing.cleanProduct?.name ??
          ing.foodProduct?.name ??
          cleanIngredientName(ing.displayName) ??
          '';
        const grams = Number(ing.grams ?? 100);
        const ratio = grams / 100;
        const n = ing.foodProduct?.nutrients ?? null;
        const cn = ing.cleanProduct?.nutrients ?? null;
        return {
          name,
          amountG: grams,
          kcal: n ? Math.round(Number(n.kcal ?? 0) * ratio) : cn ? Math.round(Number(cn.kcalPer100g ?? 0) * ratio) : 0,
          protein: n ? Math.round(Number(n.protein_g ?? 0) * ratio * 10) / 10 : cn ? Math.round(Number(cn.proteinPer100g ?? 0) * ratio * 10) / 10 : 0,
          fat: n ? Math.round(Number(n.fat_g ?? 0) * ratio * 10) / 10 : cn ? Math.round(Number(cn.fatPer100g ?? 0) * ratio * 10) / 10 : 0,
          carbs: n ? Math.round(Number(n.carbs_g ?? 0) * ratio * 10) / 10 : cn ? Math.round(Number(cn.carbsPer100g ?? 0) * ratio * 10) / 10 : 0,
        };
      }),
      steps: (recipe.steps ?? []).map((s) => s.instruction ?? ''),
      macrosPerServing: ns
        ? {
            kcal: Math.round(Number(ns.kcal ?? 0) / servings),
            protein: Math.round(Number(ns.protein_g ?? 0) / servings * 10) / 10,
            fat: Math.round(Number(ns.fat_g ?? 0) / servings * 10) / 10,
            carbs: Math.round(Number(ns.carbs_g ?? 0) / servings * 10) / 10,
          }
        : undefined,
    };
    onSelect(mapped);
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
    <div ref={wrapperRef} className={`relative ${className ?? ''}`}>
      <div className="relative">
        <ChefHat className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => results.length > 0 && setIsOpen(true)}
          placeholder={placeholder ?? t('searchRecipe')}
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
          {results.map((recipe, idx) => {
            const servings = recipe.servings ?? 1;
            const ns = recipe.nutritionSnapshot;
            const perServing = ns
              ? `${Math.round(Number(ns.kcal ?? 0) / servings)} kcal ${t('perServing')}`
              : '';

            return (
              <button
                key={recipe.id}
                type="button"
                onClick={() => handleSelect(recipe)}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors ${
                  idx === highlightIndex ? 'bg-accent' : ''
                }`}
              >
                <div className="font-medium truncate flex items-center gap-1.5">
                  <ChefHat className="h-3 w-3 text-primary/60 shrink-0" />
                  {recipe.name}
                </div>
                <div className="text-xs text-muted-foreground">
                  {recipe.totalTimeMinutes ? `${recipe.totalTimeMinutes} min` : ''}
                  {recipe.totalTimeMinutes && perServing ? ' · ' : ''}
                  {perServing}
                  {recipe.category ? ` · ${recipe.category}` : ''}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
