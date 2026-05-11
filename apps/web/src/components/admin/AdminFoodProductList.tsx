'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { api, ApiError } from '@/lib/api';
import type { FoodProduct, FoodProductCategory } from '@/types/api';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Search, Pencil, Trash2, ShieldCheck } from 'lucide-react';
import { AdminFoodProductFormDialog } from './AdminFoodProductFormDialog';

interface AdminFoodProductListProps {
  token: string;
}

export function AdminFoodProductList({ token }: AdminFoodProductListProps) {
  const t = useTranslations('admin.foodProducts');
  const [items, setItems] = useState<FoodProduct[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [categories, setCategories] = useState<FoodProductCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<FoodProduct | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FoodProduct | null>(null);
  const [deleting, setDeleting] = useState(false);

  const limit = 20;

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.adminFoodProducts.list(
        { page, limit, search: search || undefined, categoryId: categoryId || undefined },
        token
      );
      setItems(result.items);
      setTotal(result.total);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [page, search, categoryId, token]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  useEffect(() => {
    api.adminFoodProducts.categories(token).then(res => setCategories(res.categories)).catch(() => {});
  }, [token]);

  const handleSearch = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const handleCategoryChange = (value: string) => {
    setCategoryId(value === 'all' ? '' : value);
    setPage(1);
  };

  const handleCreate = () => {
    setEditingProduct(null);
    setDialogOpen(true);
  };

  const handleEdit = (product: FoodProduct) => {
    setEditingProduct(product);
    setDialogOpen(true);
  };

  const handleSaved = () => {
    setDialogOpen(false);
    setEditingProduct(null);
    fetchProducts();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.adminFoodProducts.remove(deleteTarget.id, token);
      setDeleteTarget(null);
      fetchProducts();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : t('deleteError'));
    } finally {
      setDeleting(false);
    }
  };

  const handleVerify = async (product: FoodProduct) => {
    try {
      await api.adminFoodProducts.verify(product.id, token);
      fetchProducts();
    } catch {
      // silent
    }
  };

  const totalPages = Math.ceil(total / limit);

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
        <Select value={categoryId || 'all'} onValueChange={handleCategoryChange}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder={t('allCategories')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('allCategories')}</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={handleCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          {t('addProduct')}
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('colName')}</TableHead>
              <TableHead className="hidden md:table-cell">{t('colCategory')}</TableHead>
              <TableHead className="text-right">{t('colKcal')}</TableHead>
              <TableHead className="text-right hidden sm:table-cell">{t('colProtein')}</TableHead>
              <TableHead className="text-right hidden sm:table-cell">{t('colFat')}</TableHead>
              <TableHead className="text-right hidden sm:table-cell">{t('colCarbs')}</TableHead>
              <TableHead className="hidden md:table-cell">{t('colVerified')}</TableHead>
              <TableHead className="w-[120px]">{t('colActions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  ...
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  {t('noResults')}
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">
                    {item.category?.name ?? '—'}
                  </TableCell>
                  <TableCell className="text-right">{item.nutrients?.kcal ?? '—'}</TableCell>
                  <TableCell className="text-right hidden sm:table-cell">{item.nutrients?.protein_g ?? '—'}</TableCell>
                  <TableCell className="text-right hidden sm:table-cell">{item.nutrients?.fat_g ?? '—'}</TableCell>
                  <TableCell className="text-right hidden sm:table-cell">{item.nutrients?.carbs_g ?? '—'}</TableCell>
                  <TableCell className="hidden md:table-cell">
                    {item.verificationStatus === 'VERIFIED' ? (
                      <ShieldCheck className="h-4 w-4 text-green-600" />
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(item)} title={t('edit')}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {item.verificationStatus !== 'VERIFIED' && (
                        <Button variant="ghost" size="icon" onClick={() => handleVerify(item)} title={t('verify')}>
                          <ShieldCheck className="h-4 w-4 text-green-600" />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(item)} title={t('delete')}>
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

      <AdminFoodProductFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        product={editingProduct}
        categories={categories}
        token={token}
        onSaved={handleSaved}
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
