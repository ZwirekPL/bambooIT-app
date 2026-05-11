'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { ShoppingCart, Copy, Check, RotateCcw, ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import type { ShoppingListCategory, ShoppingListDetailItem } from '@/types/api';

interface ShoppingListProps {
  planId: string;
  token: string;
}

const STORAGE_KEY_PREFIX = 'shopping-checked-';

export function ShoppingList({ planId, token }: ShoppingListProps) {
  const t = useTranslations('dashboard.shopping');

  const [categories, setCategories] = useState<ShoppingListCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);

  const storageKey = `${STORAGE_KEY_PREFIX}${planId}`;

  // Load checked state from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        setChecked(new Set(JSON.parse(saved) as string[]));
      }
    } catch { /* ignore */ }
  }, [storageKey]);

  // Save checked state to localStorage
  const updateChecked = useCallback((next: Set<string>) => {
    setChecked(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify([...next]));
    } catch { /* ignore */ }
  }, [storageKey]);

  // Fetch shopping list
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(false);
      try {
        const res = await api.dietPlans.getShoppingList(planId, token);
        if (!cancelled) {
          setCategories(res.categories);
          // Expand all categories by default
          setExpandedCategories(new Set(res.categories.map(c => c.category)));
        }
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [planId, token]);

  const totalItems = useMemo(
    () => categories.reduce((sum, c) => sum + c.items.length, 0),
    [categories]
  );

  const toggleItem = useCallback((itemKey: string) => {
    setChecked(prev => {
      const next = new Set(prev);
      if (next.has(itemKey)) next.delete(itemKey);
      else next.add(itemKey);
      updateChecked(next);
      return next;
    });
  }, [updateChecked]);

  const toggleCategory = useCallback((category: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  }, []);

  const resetChecks = useCallback(() => {
    updateChecked(new Set());
  }, [updateChecked]);

  const handleCopy = useCallback(async () => {
    const lines: string[] = [];
    for (const cat of categories) {
      lines.push(`\n${cat.category.toUpperCase()}`);
      for (const item of cat.items) {
        const checkMark = checked.has(item.name) ? '[x]' : '[ ]';
        lines.push(`${checkMark} ${item.name} — ${item.totalGrams}g`);
      }
    }
    try {
      await navigator.clipboard.writeText(lines.join('\n').trim());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  }, [categories, checked]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm">{t('loading')}</span>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive/30">
        <CardContent className="py-8 text-center text-sm text-destructive">
          {t('error')}
        </CardContent>
      </Card>
    );
  }

  if (totalItems === 0) {
    return (
      <Card className="border-border">
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          {t('emptyList')}
        </CardContent>
      </Card>
    );
  }

  const allChecked = checked.size >= totalItems;

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Badge variant="sage-outline" className="text-xs">
            {t('totalItems', { count: totalItems })}
          </Badge>
          {checked.size > 0 && (
            <Badge variant={allChecked ? 'default' : 'outline'} className="text-xs">
              {allChecked
                ? t('allChecked')
                : t('checkedCount', { checked: checked.size, total: totalItems })}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {checked.size > 0 && (
            <Button variant="ghost" size="sm" onClick={resetChecks} className="gap-1.5 text-xs h-8">
              <RotateCcw className="h-3.5 w-3.5" />
              {t('resetChecks')}
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={handleCopy} className="gap-1.5 text-xs h-8">
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? t('copySuccess') : t('copyButton')}
          </Button>
        </div>
      </div>

      {/* Categories */}
      {categories.map(cat => {
        const isExpanded = expandedCategories.has(cat.category);
        const catCheckedCount = cat.items.filter(i => checked.has(i.name)).length;

        return (
          <Card key={cat.category} className="border-border overflow-hidden">
            <CardHeader
              className="pb-0 pt-3 px-4 cursor-pointer select-none"
              onClick={() => toggleCategory(cat.category)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {isExpanded
                    ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                  <CardTitle className="text-sm font-semibold">{cat.category}</CardTitle>
                  <span className="text-xs text-muted-foreground">
                    ({cat.items.length})
                  </span>
                </div>
                {catCheckedCount > 0 && (
                  <Badge variant="outline" className="text-xs">
                    {catCheckedCount}/{cat.items.length}
                  </Badge>
                )}
              </div>
            </CardHeader>
            {isExpanded && (
              <CardContent className="px-4 pb-3 pt-2">
                <ul className="space-y-1">
                  {cat.items.map(item => (
                    <ShoppingItem
                      key={item.name}
                      item={item}
                      isChecked={checked.has(item.name)}
                      onToggle={() => toggleItem(item.name)}
                      usedInLabel={t('usedIn')}
                    />
                  ))}
                </ul>
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
}

function ShoppingItem({
  item,
  isChecked,
  onToggle,
  usedInLabel,
}: {
  item: ShoppingListDetailItem;
  isChecked: boolean;
  onToggle: () => void;
  usedInLabel: string;
}) {
  const [showUsage, setShowUsage] = useState(false);

  return (
    <li className="group">
      <div className="flex items-start gap-3 py-1.5">
        <input
          type="checkbox"
          checked={isChecked}
          onChange={onToggle}
          className="mt-0.5 h-4 w-4 rounded border-border text-sage-600 focus:ring-sage-500 cursor-pointer accent-sage-600"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className={`text-sm ${isChecked ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
              {item.name}
            </span>
            <span className="text-xs font-medium text-sage-600">{item.totalGrams}g</span>
            {item.usedIn.length > 1 && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setShowUsage(v => !v); }}
                className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
              >
                ({item.usedIn.length}x)
              </button>
            )}
          </div>
          {showUsage && item.usedIn.length > 0 && (
            <div className="mt-1 text-xs text-muted-foreground pl-0.5">
              <span className="font-medium">{usedInLabel}</span>{' '}
              {item.usedIn.map((u, i) => (
                <span key={i}>
                  {i > 0 && ', '}
                  {u.day} {u.meal} ({u.grams}g)
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </li>
  );
}
