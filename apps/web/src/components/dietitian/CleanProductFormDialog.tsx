'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { api, ApiError } from '@/lib/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface CleanProductFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  token: string;
  onSaved: () => void;
}

export function CleanProductFormDialog({
  open,
  onOpenChange,
  token,
  onSaved,
}: CleanProductFormDialogProps) {
  const t = useTranslations('dietitian.cleanProducts');

  const [name, setName] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [kcal, setKcal] = useState('');
  const [protein, setProtein] = useState('');
  const [fat, setFat] = useState('');
  const [carbs, setCarbs] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (open) {
      setName('');
      setNameEn('');
      setCategory('');
      setDescription('');
      setKcal('');
      setProtein('');
      setFat('');
      setCarbs('');
      setError('');
      setSuccess('');
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      await api.cleanProducts.dietitianCreate(
        {
          name,
          nameEn: nameEn || undefined,
          category: category || 'Inne',
          description: description || undefined,
          nutrients: {
            kcalPer100g: Number(kcal) || 0,
            proteinPer100g: Number(protein) || 0,
            fatPer100g: Number(fat) || 0,
            carbsPer100g: Number(carbs) || 0,
          },
        },
        token
      );
      setSuccess(t('createSuccess'));
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
          <DialogTitle>{t('addProduct')}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cp-name">{t('formName')} *</Label>
            <Input id="cp-name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cp-nameEn">{t('formNameEn')}</Label>
            <Input id="cp-nameEn" value={nameEn} onChange={(e) => setNameEn(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cp-category">{t('formCategory')} *</Label>
            <Input id="cp-category" value={category} onChange={(e) => setCategory(e.target.value)} required placeholder={t('formCategoryPlaceholder')} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cp-desc">{t('formDescription')}</Label>
            <Textarea id="cp-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>

          <fieldset className="space-y-3 border rounded-md p-3">
            <legend className="text-sm font-medium px-1">{t('formNutrients')}</legend>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="cp-kcal" className="text-xs">{t('formKcal')} *</Label>
                <Input id="cp-kcal" type="number" step="0.1" min="0" value={kcal} onChange={(e) => setKcal(e.target.value)} required />
              </div>
              <div className="space-y-1">
                <Label htmlFor="cp-protein" className="text-xs">{t('formProtein')} *</Label>
                <Input id="cp-protein" type="number" step="0.1" min="0" value={protein} onChange={(e) => setProtein(e.target.value)} required />
              </div>
              <div className="space-y-1">
                <Label htmlFor="cp-fat" className="text-xs">{t('formFat')} *</Label>
                <Input id="cp-fat" type="number" step="0.1" min="0" value={fat} onChange={(e) => setFat(e.target.value)} required />
              </div>
              <div className="space-y-1">
                <Label htmlFor="cp-carbs" className="text-xs">{t('formCarbs')} *</Label>
                <Input id="cp-carbs" type="number" step="0.1" min="0" value={carbs} onChange={(e) => setCarbs(e.target.value)} required />
              </div>
            </div>
          </fieldset>

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
