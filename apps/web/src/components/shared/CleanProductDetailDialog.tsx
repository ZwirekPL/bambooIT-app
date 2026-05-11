'use client';

import { useState, useEffect, useCallback } from 'react';
import { api, ApiError } from '@/lib/api';
import type { CleanProduct, AuditLogEntry } from '@/types/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Barcode, Package, UtensilsCrossed, Scale, Pencil, Check, X, History } from 'lucide-react';
import { formatCategory } from '@/lib/format-category';
import { MicronutrientSections } from './MicronutrientSections';

interface CleanProductDetailDialogProps {
  product: CleanProduct | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onProductUpdated?: (updated: CleanProduct) => void;
  categories?: string[];
  token?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  t: (key: any, values?: any) => string;
}

const AUDIT_ACTION_LABELS: Record<string, string> = {
  CREATE_CLEAN_PRODUCT: 'Utworzono produkt',
  UPDATE_CLEAN_PRODUCT: 'Zaktualizowano produkt',
  DELETE_CLEAN_PRODUCT: 'Usunięto produkt',
  BULK_UPDATE_CLEAN_PRODUCTS: 'Akcja masowa',
};

function formatAuditAction(action: string): string {
  return AUDIT_ACTION_LABELS[action] ?? action;
}

const TYPE_LABELS: Record<string, string> = {
  BASE: 'typeBASE',
  RETAIL: 'typeRETAIL',
  MANUAL: 'typeMANUAL',
};

type EditableField = 'name' | 'category' | 'barcode' | 'packageWeightG' | 'servingWeightG' | 'kcal' | 'protein' | 'fat' | 'carbs' | 'fiber' | 'sugars' | 'salt' | 'saturatedFat';

export function CleanProductDetailDialog({ product, open, onOpenChange, onProductUpdated, categories, token, t }: CleanProductDetailDialogProps) {
  const [editingField, setEditingField] = useState<EditableField | null>(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLogs, setHistoryLogs] = useState<AuditLogEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const fetchHistory = useCallback(async (productId: string) => {
    if (!token) return;
    setHistoryLoading(true);
    try {
      const res = await api.adminCleanProducts.history(productId, token);
      setHistoryLogs(res.logs);
    } catch {
      setHistoryLogs([]);
    } finally {
      setHistoryLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (historyOpen && product) {
      fetchHistory(product.id);
    }
  }, [historyOpen, product?.id, fetchHistory]);

  useEffect(() => {
    if (!open) {
      setHistoryOpen(false);
      setHistoryLogs([]);
    }
  }, [open]);

  if (!product) return null;

  const n = product.nutrients;
  const noData = t('detailNoData');
  const canEdit = !!token && !!onProductUpdated;

  const startEdit = (field: EditableField) => {
    if (!canEdit) return;
    let val = '';
    if (field === 'name') val = product.name;
    else if (field === 'category') val = product.category;
    else if (field === 'barcode') val = product.barcode || '';
    else if (field === 'packageWeightG') val = product.packageWeightG != null ? String(product.packageWeightG) : '';
    else if (field === 'servingWeightG') val = product.servingWeightG != null ? String(product.servingWeightG) : '';
    else if (field === 'kcal') val = n?.kcalPer100g != null ? String(Math.round(n.kcalPer100g)) : '';
    else if (field === 'protein') val = n?.proteinPer100g != null ? String(Number(n.proteinPer100g)) : '';
    else if (field === 'fat') val = n?.fatPer100g != null ? String(Number(n.fatPer100g)) : '';
    else if (field === 'carbs') val = n?.carbsPer100g != null ? String(Number(n.carbsPer100g)) : '';
    else if (field === 'fiber') val = n?.fiberPer100g != null ? String(Number(n.fiberPer100g)) : '';
    else if (field === 'sugars') val = n?.sugarsPer100g != null ? String(Number(n.sugarsPer100g)) : '';
    else if (field === 'salt') val = n?.saltPer100g != null ? String(Number(n.saltPer100g)) : '';
    else if (field === 'saturatedFat') val = n?.saturatedFatPer100g != null ? String(Number(n.saturatedFatPer100g)) : '';
    setEditValue(val);
    setEditingField(field);
  };

  const cancelEdit = () => {
    setEditingField(null);
    setEditValue('');
  };

  const saveEdit = async () => {
    if (!editingField || saving || !token || !onProductUpdated) return;
    const trimmed = editValue.trim();

    if (editingField === 'name' && !trimmed) return;

    setSaving(true);
    try {
      let payload: Record<string, unknown>;
      if (editingField === 'name') {
        payload = { name: trimmed };
      } else if (editingField === 'category') {
        payload = { category: trimmed };
      } else if (editingField === 'barcode') {
        payload = { barcode: trimmed || null };
      } else if (editingField === 'packageWeightG') {
        payload = { packageWeightG: trimmed ? Number(trimmed) : null };
      } else if (editingField === 'servingWeightG') {
        payload = { servingWeightG: trimmed ? Number(trimmed) : null };
      } else {
        const nutrientMap: Record<string, string> = {
          kcal: 'kcalPer100g',
          protein: 'proteinPer100g',
          fat: 'fatPer100g',
          carbs: 'carbsPer100g',
          fiber: 'fiberPer100g',
          sugars: 'sugarsPer100g',
          salt: 'saltPer100g',
          saturatedFat: 'saturatedFatPer100g',
        };
        const key = nutrientMap[editingField];
        payload = { nutrients: { [key]: trimmed ? Number(trimmed) : 0 } };
      }

      await api.adminCleanProducts.update(product.id, payload, token);

      // Build updated product locally
      let updated: CleanProduct;
      if (editingField === 'name') {
        updated = { ...product, name: trimmed };
      } else if (editingField === 'category') {
        updated = { ...product, category: trimmed };
      } else if (editingField === 'barcode') {
        updated = { ...product, barcode: trimmed || null };
      } else if (editingField === 'packageWeightG') {
        updated = { ...product, packageWeightG: trimmed ? Number(trimmed) : null };
      } else if (editingField === 'servingWeightG') {
        updated = { ...product, servingWeightG: trimmed ? Number(trimmed) : null };
      } else {
        const nutrientMap: Record<string, string> = {
          kcal: 'kcalPer100g',
          protein: 'proteinPer100g',
          fat: 'fatPer100g',
          carbs: 'carbsPer100g',
          fiber: 'fiberPer100g',
          sugars: 'sugarsPer100g',
          salt: 'saltPer100g',
          saturatedFat: 'saturatedFatPer100g',
        };
        const key = nutrientMap[editingField];
        updated = {
          ...product,
          nutrients: { ...product.nutrients!, [key]: trimmed ? Number(trimmed) : 0 },
        };
      }

      onProductUpdated(updated);
    } catch (err) {
      alert(err instanceof ApiError ? err.message : t('inlineEditError'));
    } finally {
      setSaving(false);
      setEditingField(null);
      setEditValue('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); saveEdit(); }
    else if (e.key === 'Escape') cancelEdit();
  };

  const EditButton = ({ field }: { field: EditableField }) => {
    if (!canEdit) return null;
    return (
      <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => startEdit(field)}>
        <Pencil className="h-3 w-3 text-muted-foreground" />
      </Button>
    );
  };

  const SaveCancelButtons = () => (
    <>
      <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={saveEdit} disabled={saving}>
        <Check className="h-3.5 w-3.5 text-green-600" />
      </Button>
      <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={cancelEdit}>
        <X className="h-3.5 w-3.5 text-destructive" />
      </Button>
    </>
  );

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) cancelEdit(); onOpenChange(o); }}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          {editingField === 'name' ? (
            <div className="flex items-center gap-1">
              <Input
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={handleKeyDown}
                autoFocus
                className="h-8 text-lg font-semibold"
              />
              <SaveCancelButtons />
            </div>
          ) : (
            <DialogTitle className="text-lg flex items-center gap-1">
              {product.name}
              <EditButton field="name" />
            </DialogTitle>
          )}
          {product.brand && (
            <p className="text-sm text-muted-foreground">{product.brand}</p>
          )}
        </DialogHeader>

        <div className="space-y-5">
          {/* Basic info */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-muted-foreground">{t('detailType')}</span>
              <div className="mt-0.5">
                <Badge variant={product.type === 'BASE' ? 'default' : product.type === 'RETAIL' ? 'secondary' : 'outline'}>
                  {t(TYPE_LABELS[product.type] ?? 'typeMANUAL')}
                </Badge>
              </div>
            </div>
            <div>
              <span className="text-muted-foreground">{t('detailCategory')}</span>
              {editingField === 'category' ? (
                <div className="flex items-center gap-1 mt-0.5">
                  <Select value={editValue} onValueChange={setEditValue}>
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(categories ?? []).map((cat) => (
                        <SelectItem key={cat} value={cat}>{formatCategory(cat)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <SaveCancelButtons />
                </div>
              ) : (
                <p className="mt-0.5 font-medium flex items-center gap-1">
                  {formatCategory(product.category)}
                  <EditButton field="category" />
                </p>
              )}
            </div>
          </div>

          {/* Barcode */}
          <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
            <Barcode className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-muted-foreground">{t('detailBarcode')}</p>
              {editingField === 'barcode' ? (
                <div className="flex items-center gap-1 mt-0.5">
                  <Input
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    autoFocus
                    className="h-7 text-sm font-mono"
                    placeholder="EAN / UPC"
                  />
                  <SaveCancelButtons />
                </div>
              ) : (
                <p className="font-mono text-sm font-medium flex items-center gap-1">
                  {product.barcode || noData}
                  <EditButton field="barcode" />
                </p>
              )}
            </div>
          </div>

          {/* Package / Serving weight */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
              <Package className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">{t('detailPackageWeight')}</p>
                {editingField === 'packageWeightG' ? (
                  <div className="flex items-center gap-1 mt-0.5">
                    <Input
                      type="number"
                      min={1}
                      step={1}
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={handleKeyDown}
                      autoFocus
                      className="h-7 text-sm w-20"
                      placeholder="g"
                    />
                    <SaveCancelButtons />
                  </div>
                ) : (
                  <p className="text-sm font-medium flex items-center gap-1">
                    {product.packageWeightG != null
                      ? t('detailGrams', { value: product.packageWeightG })
                      : noData}
                    <EditButton field="packageWeightG" />
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
              <Scale className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">{t('detailServingWeight')}</p>
                {editingField === 'servingWeightG' ? (
                  <div className="flex items-center gap-1 mt-0.5">
                    <Input
                      type="number"
                      min={1}
                      step={1}
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={handleKeyDown}
                      autoFocus
                      className="h-7 text-sm w-20"
                      placeholder="g"
                    />
                    <SaveCancelButtons />
                  </div>
                ) : (
                  <p className="text-sm font-medium flex items-center gap-1">
                    {product.servingWeightG != null
                      ? t('detailGrams', { value: product.servingWeightG })
                      : noData}
                    <EditButton field="servingWeightG" />
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Nutrients */}
          {n && (
            <div>
              <p className="text-sm font-medium mb-2">{t('detailNutrients')}</p>
              <div className="grid grid-cols-4 gap-2">
                <EditableNutrientCard label="kcal" value={n.kcalPer100g != null ? Math.round(n.kcalPer100g) : null} unit="" field="kcal" editingField={editingField} editValue={editValue} setEditValue={setEditValue} handleKeyDown={handleKeyDown} startEdit={startEdit} saveEdit={saveEdit} cancelEdit={cancelEdit} saving={saving} canEdit={canEdit} />
                <EditableNutrientCard label={t('colProtein')} value={n.proteinPer100g} unit="g" field="protein" editingField={editingField} editValue={editValue} setEditValue={setEditValue} handleKeyDown={handleKeyDown} startEdit={startEdit} saveEdit={saveEdit} cancelEdit={cancelEdit} saving={saving} canEdit={canEdit} />
                <EditableNutrientCard label={t('colFat')} value={n.fatPer100g} unit="g" field="fat" editingField={editingField} editValue={editValue} setEditValue={setEditValue} handleKeyDown={handleKeyDown} startEdit={startEdit} saveEdit={saveEdit} cancelEdit={cancelEdit} saving={saving} canEdit={canEdit} />
                <EditableNutrientCard label={t('colCarbs')} value={n.carbsPer100g} unit="g" field="carbs" editingField={editingField} editValue={editValue} setEditValue={setEditValue} handleKeyDown={handleKeyDown} startEdit={startEdit} saveEdit={saveEdit} cancelEdit={cancelEdit} saving={saving} canEdit={canEdit} />
              </div>
              {(n.fiberPer100g != null || n.sugarsPer100g != null || n.saltPer100g != null || n.saturatedFatPer100g != null) && (
                <div className="grid grid-cols-4 gap-2 mt-2">
                  <EditableNutrientCard label="Błonnik" value={n.fiberPer100g ?? null} unit="g" field="fiber" editingField={editingField} editValue={editValue} setEditValue={setEditValue} handleKeyDown={handleKeyDown} startEdit={startEdit} saveEdit={saveEdit} cancelEdit={cancelEdit} saving={saving} canEdit={canEdit} />
                  <EditableNutrientCard label="Cukry" value={n.sugarsPer100g ?? null} unit="g" field="sugars" editingField={editingField} editValue={editValue} setEditValue={setEditValue} handleKeyDown={handleKeyDown} startEdit={startEdit} saveEdit={saveEdit} cancelEdit={cancelEdit} saving={saving} canEdit={canEdit} />
                  <EditableNutrientCard label="Sól" value={n.saltPer100g ?? null} unit="g" field="salt" editingField={editingField} editValue={editValue} setEditValue={setEditValue} handleKeyDown={handleKeyDown} startEdit={startEdit} saveEdit={saveEdit} cancelEdit={cancelEdit} saving={saving} canEdit={canEdit} />
                  <EditableNutrientCard label="Tł. nasyc." value={n.saturatedFatPer100g ?? null} unit="g" field="saturatedFat" editingField={editingField} editValue={editValue} setEditValue={setEditValue} handleKeyDown={handleKeyDown} startEdit={startEdit} saveEdit={saveEdit} cancelEdit={cancelEdit} saving={saving} canEdit={canEdit} />
                </div>
              )}
            </div>
          )}

          {/* Micronutrient sections (38.0) */}
          <div>
            <p className="text-sm font-medium mb-2">{t('detailMicro')}</p>
            <MicronutrientSections product={product} />
          </div>

          {/* Portions */}
          {product.portions && product.portions.length > 0 && (
            <div>
              <p className="text-sm font-medium mb-2 flex items-center gap-2">
                <UtensilsCrossed className="h-4 w-4" />
                {t('detailPortions')}
              </p>
              <div className="flex flex-wrap gap-2">
                {product.portions.map((p) => (
                  <Badge key={p.id} variant="outline" className="text-xs">
                    {p.portionName} = {p.weightG}g
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* History */}
          {canEdit && (
            <div>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-muted-foreground px-0"
                onClick={() => setHistoryOpen(!historyOpen)}
              >
                <History className="h-4 w-4" />
                {t('historyTitle')}
              </Button>
              {historyOpen && (
                <div className="mt-2 space-y-1.5 max-h-[200px] overflow-y-auto">
                  {historyLoading ? (
                    <p className="text-xs text-muted-foreground">...</p>
                  ) : historyLogs.length === 0 ? (
                    <p className="text-xs text-muted-foreground">{t('historyEmpty')}</p>
                  ) : (
                    historyLogs.map((log) => (
                      <div key={log.id} className="flex items-start gap-2 text-xs border-l-2 border-muted pl-2 py-0.5">
                        <span className="text-muted-foreground whitespace-nowrap shrink-0">
                          {new Date(log.createdAt).toLocaleString('pl-PL', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <span className="font-medium">{formatAuditAction(log.action)}</span>
                        {log.user && (
                          <span className="text-muted-foreground truncate">{log.user.email}</span>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EditableNutrientCard({
  label, value, unit, field, editingField, editValue, setEditValue, handleKeyDown, startEdit, saveEdit, cancelEdit, saving, canEdit,
}: {
  label: string;
  value: number | null | undefined;
  unit: string;
  field: EditableField;
  editingField: EditableField | null;
  editValue: string;
  setEditValue: (v: string) => void;
  handleKeyDown: (e: React.KeyboardEvent) => void;
  startEdit: (f: EditableField) => void;
  saveEdit: () => void;
  cancelEdit: () => void;
  saving: boolean;
  canEdit: boolean;
}) {
  const isEditing = editingField === field;

  if (isEditing) {
    return (
      <div className="text-center p-2 rounded-md bg-primary/5 border-2 border-primary/20">
        <p className="text-xs text-muted-foreground truncate mb-1">{label}</p>
        <Input
          type="number"
          step="0.1"
          min={0}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          autoFocus
          className="h-7 text-sm text-center"
        />
        <div className="flex justify-center gap-0.5 mt-1">
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={saveEdit} disabled={saving}>
            <Check className="h-3 w-3 text-green-600" />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={cancelEdit}>
            <X className="h-3 w-3 text-destructive" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="group text-center p-2 rounded-md bg-muted/30 border relative">
      <p className="text-xs text-muted-foreground truncate">{label}</p>
      <p className="text-sm font-semibold tabular-nums">
        {value != null ? `${Number(value).toFixed(1)}${unit}` : '—'}
      </p>
      {canEdit && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-1 right-1 h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={() => startEdit(field)}
        >
          <Pencil className="h-2.5 w-2.5 text-muted-foreground" />
        </Button>
      )}
    </div>
  );
}
