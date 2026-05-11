'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';

interface NutrientsPer100g {
  kcal: number;
  protein_g: number;
  fat_g: number;
  carbs_g: number;
}

export interface SelectedProduct {
  id: string;
  name: string;
  nutrientsPer100g: NutrientsPer100g;
}

interface Props {
  onSelect: (product: SelectedProduct) => void;
  placeholder?: string;
  className?: string;
}

export function IngredientAutocomplete({ onSelect, placeholder, className }: Props) {
  const { data: session } = useSession();
  const t = useTranslations('dietitian.visualEditor');

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SelectedProduct[]>([]);
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
        const res = await api.foodProducts.search(q, token);
        const mapped: SelectedProduct[] = (res.items ?? [])
          .filter((item) => item.nutrients)
          .map((item) => ({
            id: item.id,
            name: item.name,
            nutrientsPer100g: {
              kcal: Number(item.nutrients!.kcal ?? 0),
              protein_g: Number(item.nutrients!.protein_g ?? 0),
              fat_g: Number(item.nutrients!.fat_g ?? 0),
              carbs_g: Number(item.nutrients!.carbs_g ?? 0),
            },
          }));
        setResults(mapped);
        setIsOpen(mapped.length > 0);
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

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function handleSelect(product: SelectedProduct) {
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
    <div ref={wrapperRef} className={`relative ${className ?? ''}`}>
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => results.length > 0 && setIsOpen(true)}
          placeholder={placeholder ?? t('searchProduct')}
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
              <div className="font-medium truncate">{product.name}</div>
              <div className="text-xs text-muted-foreground">
                {product.nutrientsPer100g.kcal} kcal · B: {product.nutrientsPer100g.protein_g}g · T: {product.nutrientsPer100g.fat_g}g · W: {product.nutrientsPer100g.carbs_g}g
                <span className="ml-1 opacity-60">/ 100g</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
