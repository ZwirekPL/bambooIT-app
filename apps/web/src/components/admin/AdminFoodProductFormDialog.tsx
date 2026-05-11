'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { api, ApiError } from '@/lib/api';
import type { FoodProduct, FoodProductCategory } from '@/types/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface AdminFoodProductFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: FoodProduct | null;
  categories: FoodProductCategory[];
  token: string;
  onSaved: () => void;
}

export function AdminFoodProductFormDialog({
  open,
  onOpenChange,
  product,
  categories,
  token,
  onSaved,
}: AdminFoodProductFormDialogProps) {
  const t = useTranslations('admin.foodProducts');
  const isEdit = !!product;

  const [name, setName] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [description, setDescription] = useState('');
  const [notesDietitian, setNotesDietitian] = useState('');
  const [kcal, setKcal] = useState('');
  const [protein, setProtein] = useState('');
  const [fat, setFat] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fiber, setFiber] = useState('');
  const [sugars, setSugars] = useState('');
  const [salt, setSalt] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (open) {
      if (product) {
        setName(product.name);
        setNameEn(product.nameEn ?? '');
        setCategoryId(product.categoryId ?? '');
        setDescription(product.description ?? '');
        setNotesDietitian('');
        setKcal(String(product.nutrients?.kcal ?? 0));
        setProtein(String(product.nutrients?.protein_g ?? 0));
        setFat(String(product.nutrients?.fat_g ?? 0));
        setCarbs(String(product.nutrients?.carbs_g ?? 0));
        setFiber(String(product.nutrients?.fiber_g ?? ''));
        setSugars(String(product.nutrients?.sugars_g ?? ''));
        setSalt(String(product.nutrients?.salt_g ?? ''));
      } else {
        setName('');
        setNameEn('');
        setCategoryId('');
        setDescription('');
        setNotesDietitian('');
        setKcal('');
        setProtein('');
        setFat('');
        setCarbs('');
        setFiber('');
        setSugars('');
        setSalt('');
      }
      setError('');
      setSuccess('');
    }
  }, [open, product]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    const nutrients = {
      kcal: Number(kcal) || 0,
      protein_g: Number(protein) || 0,
      fat_g: Number(fat) || 0,
      carbs_g: Number(carbs) || 0,
      fiber_g: fiber ? Number(fiber) : undefined,
      sugars_g: sugars ? Number(sugars) : undefined,
      salt_g: salt ? Number(salt) : undefined,
    };

    const data = {
      name,
      nameEn: nameEn || undefined,
      categoryId: categoryId || undefined,
      description: description || undefined,
      notesDietitian: notesDietitian || undefined,
      nutrients,
    };

    try {
      if (isEdit) {
        await api.adminFoodProducts.update(product.id, data, token);
        setSuccess(t('updateSuccess'));
      } else {
        await api.adminFoodProducts.create(data, token);
        setSuccess(t('createSuccess'));
      }
      setTimeout(() => onSaved(), 500);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('error'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? t('editProduct') : t('addProduct')}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="afp-name">{t('formName')} *</Label>
            <Input id="afp-name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="afp-nameEn">{t('formNameEn')}</Label>
            <Input id="afp-nameEn" value={nameEn} onChange={(e) => setNameEn(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>{t('formCategory')}</Label>
            <Select value={categoryId || 'none'} onValueChange={(v) => setCategoryId(v === 'none' ? '' : v)}>
              <SelectTrigger>
                <SelectValue placeholder={t('formSelectCategory')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">—</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="afp-desc">{t('formDescription')}</Label>
            <Textarea id="afp-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>

          <fieldset className="space-y-3 border rounded-md p-3">
            <legend className="text-sm font-medium px-1">{t('formNutrients')}</legend>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="afp-kcal" className="text-xs">{t('formKcal')} *</Label>
                <Input id="afp-kcal" type="number" step="0.1" min="0" value={kcal} onChange={(e) => setKcal(e.target.value)} required />
              </div>
              <div className="space-y-1">
                <Label htmlFor="afp-protein" className="text-xs">{t('formProtein')} *</Label>
                <Input id="afp-protein" type="number" step="0.1" min="0" value={protein} onChange={(e) => setProtein(e.target.value)} required />
              </div>
              <div className="space-y-1">
                <Label htmlFor="afp-fat" className="text-xs">{t('formFat')} *</Label>
                <Input id="afp-fat" type="number" step="0.1" min="0" value={fat} onChange={(e) => setFat(e.target.value)} required />
              </div>
              <div className="space-y-1">
                <Label htmlFor="afp-carbs" className="text-xs">{t('formCarbs')} *</Label>
                <Input id="afp-carbs" type="number" step="0.1" min="0" value={carbs} onChange={(e) => setCarbs(e.target.value)} required />
              </div>
              <div className="space-y-1">
                <Label htmlFor="afp-fiber" className="text-xs">{t('formFiber')}</Label>
                <Input id="afp-fiber" type="number" step="0.1" min="0" value={fiber} onChange={(e) => setFiber(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="afp-sugars" className="text-xs">{t('formSugars')}</Label>
                <Input id="afp-sugars" type="number" step="0.1" min="0" value={sugars} onChange={(e) => setSugars(e.target.value)} />
              </div>
              <div className="space-y-1 col-span-2 sm:col-span-1">
                <Label htmlFor="afp-salt" className="text-xs">{t('formSalt')}</Label>
                <Input id="afp-salt" type="number" step="0.01" min="0" value={salt} onChange={(e) => setSalt(e.target.value)} />
              </div>
            </div>
          </fieldset>

          <div className="space-y-2">
            <Label htmlFor="afp-notes">{t('formNotes')}</Label>
            <Textarea id="afp-notes" value={notesDietitian} onChange={(e) => setNotesDietitian(e.target.value)} rows={2} />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          {success && <p className="text-sm text-green-600">{success}</p>}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('cancel')}
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? t('saving') : t('save')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
