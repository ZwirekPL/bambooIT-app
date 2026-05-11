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
import { Plus, Search, ShieldCheck, ShieldAlert, AlertTriangle } from 'lucide-react';
import { CleanProductFormDialog } from './CleanProductFormDialog';
import { CleanProductDetailDialog } from '@/components/shared/CleanProductDetailDialog';
import { formatCategory } from '@/lib/format-category';

interface CleanProductListProps {
  token: string;
}

const TYPE_BADGE_MAP: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
  BASE: { label: 'typeBASE', variant: 'default' },
  RETAIL: { label: 'typeRETAIL', variant: 'secondary' },
  MANUAL: { label: 'typeMANUAL', variant: 'outline' },
};

export function CleanProductList({ token }: CleanProductListProps) {
  const t = useTranslations('dietitian.cleanProducts');
  const [items, setItems] = useState<CleanProduct[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<CleanProductType | 'ALL'>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('__ALL__');
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<CleanProduct | null>(null);

  const limit = 20;

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.cleanProducts.list(
        {
          page,
          limit,
          search: search || undefined,
          type: typeFilter === 'ALL' ? undefined : typeFilter,
          category: categoryFilter === '__ALL__' ? undefined : categoryFilter,
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
  }, [page, search, typeFilter, categoryFilter, token]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  useEffect(() => {
    api.cleanProducts.categories(token).then((res) => setCategories(res.categories)).catch(() => {});
  }, [token]);

  const handleSearch = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const handleTypeChange = (value: string) => {
    setTypeFilter(value as CleanProductType | 'ALL');
    setPage(1);
  };

  const handleCategoryChange = (value: string) => {
    setCategoryFilter(value);
    setPage(1);
  };

  const handleSaved = () => {
    setDialogOpen(false);
    fetchProducts();
  };

  const totalPages = Math.ceil(total / limit);

  const verificationIcon = (status: string) => {
    if (status === 'VERIFIED') return <ShieldCheck className="h-4 w-4 text-green-600" />;
    if (status === 'FLAGGED') return <AlertTriangle className="h-4 w-4 text-amber-500" />;
    return <ShieldAlert className="h-4 w-4 text-muted-foreground/40" />;
  };

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
          <Button onClick={() => setDialogOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            {t('addProduct')}
          </Button>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 items-start">
          <Tabs value={typeFilter} onValueChange={handleTypeChange}>
          <TabsList>
            <TabsTrigger value="ALL">{t('typeALL')}</TabsTrigger>
            <TabsTrigger value="BASE">{t('typeBASE')}</TabsTrigger>
            <TabsTrigger value="RETAIL">{t('typeRETAIL')}</TabsTrigger>
            <TabsTrigger value="MANUAL">{t('typeMANUAL')}</TabsTrigger>
          </TabsList>
        </Tabs>
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
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('colName')}</TableHead>
              <TableHead className="hidden md:table-cell">{t('colCategory')}</TableHead>
              <TableHead className="hidden lg:table-cell w-[80px]">{t('colType')}</TableHead>
              <TableHead className="text-right">{t('colKcal')}</TableHead>
              <TableHead className="text-right hidden sm:table-cell">{t('colProtein')}</TableHead>
              <TableHead className="text-right hidden sm:table-cell">{t('colFat')}</TableHead>
              <TableHead className="text-right hidden sm:table-cell">{t('colCarbs')}</TableHead>
              <TableHead className="hidden md:table-cell text-center w-[60px]">{t('colPortions')}</TableHead>
              <TableHead className="hidden lg:table-cell text-center w-[40px]" title={t('colVerified')}><ShieldCheck className="h-4 w-4 mx-auto" /></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                  ...
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                  {t('noResults')}
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => {
                const typeBadge = TYPE_BADGE_MAP[item.type];
                return (
                  <TableRow key={item.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedProduct(item)}>
                    <TableCell className="font-medium">
                      {item.name}
                      {item.brand && (
                        <span className="text-xs text-muted-foreground ml-1">({item.brand})</span>
                      )}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground">
                      {formatCategory(item.category)}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {typeBadge && (
                        <Badge variant={typeBadge.variant} className="text-[10px] px-1.5 py-0">
                          {t(typeBadge.label)}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {item.nutrients?.kcalPer100g != null ? Math.round(Number(item.nutrients.kcalPer100g)) : '—'}
                    </TableCell>
                    <TableCell className="text-right hidden sm:table-cell tabular-nums">
                      {item.nutrients?.proteinPer100g != null ? Number(item.nutrients.proteinPer100g).toFixed(1) : '—'}
                    </TableCell>
                    <TableCell className="text-right hidden sm:table-cell tabular-nums">
                      {item.nutrients?.fatPer100g != null ? Number(item.nutrients.fatPer100g).toFixed(1) : '—'}
                    </TableCell>
                    <TableCell className="text-right hidden sm:table-cell tabular-nums">
                      {item.nutrients?.carbsPer100g != null ? Number(item.nutrients.carbsPer100g).toFixed(1) : '—'}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-center tabular-nums">
                      {item.portions?.length ?? 0}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-center">
                      {verificationIcon(item.verificationStatus)}
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

      <CleanProductFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        token={token}
        onSaved={handleSaved}
      />

      <CleanProductDetailDialog
        product={selectedProduct}
        open={!!selectedProduct}
        onOpenChange={(open) => !open && setSelectedProduct(null)}
        t={t}
      />
    </>
  );
}
