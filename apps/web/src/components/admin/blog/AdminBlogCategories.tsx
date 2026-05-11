'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Pencil, Trash2, Plus, Check, X } from 'lucide-react';
import type { BlogCategoryConfig } from '@/types/api';

const DEFAULT_SLUGS = new Set([
  'porady-dietetyczne',
  'odchudzanie',
  'zdrowie-i-choroby',
  'przepisy',
  'ai-i-dietetyka',
  'motywacja',
  'subskrypcja',
  'thermomix-airfryer',
]);

interface AdminBlogCategoriesProps {
  categories: BlogCategoryConfig[];
  token: string;
}

interface EditState {
  id: string;
  name: string;
  slug: string;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ł/g, 'l')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

export function AdminBlogCategories({ categories: initialCategories, token }: AdminBlogCategoriesProps) {
  const [categories, setCategories] = useState<BlogCategoryConfig[]>(initialCategories);
  const [editing, setEditing] = useState<EditState | null>(null);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newSlug, setNewSlug] = useState('');
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState('');

  async function handleSaveEdit() {
    if (!editing) return;
    setLoading(editing.id);
    setError('');
    try {
      const result = await api.admin.blogCategories.update(
        editing.id,
        { name: editing.name, slug: editing.slug },
        token
      );
      setCategories((prev) => prev.map((c) => (c.id === editing.id ? result.category : c)));
      setEditing(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Błąd zapisu');
    } finally {
      setLoading(null);
    }
  }

  async function handleToggleActive(cat: BlogCategoryConfig) {
    setLoading(cat.id);
    setError('');
    try {
      const result = await api.admin.blogCategories.update(cat.id, { isActive: !cat.isActive }, token);
      setCategories((prev) => prev.map((c) => (c.id === cat.id ? result.category : c)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Błąd zmiany statusu');
    } finally {
      setLoading(null);
    }
  }

  async function handleDelete(cat: BlogCategoryConfig) {
    if (!confirm(`Usunąć kategorię "${cat.name}"?`)) return;
    setLoading(cat.id);
    setError('');
    try {
      await api.admin.blogCategories.delete(cat.id, token);
      setCategories((prev) => prev.filter((c) => c.id !== cat.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Błąd usuwania');
    } finally {
      setLoading(null);
    }
  }

  async function handleCreate() {
    setLoading('new');
    setError('');
    try {
      const result = await api.admin.blogCategories.create({ name: newName, slug: newSlug }, token);
      setCategories((prev) => [...prev, result.category]);
      setAdding(false);
      setNewName('');
      setNewSlug('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Błąd tworzenia');
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Kategorie bloga</h2>
          <p className="text-sm text-muted-foreground">{categories.length} kategorii</p>
        </div>
        {!adding && (
          <Button size="sm" onClick={() => setAdding(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nowa kategoria
          </Button>
        )}
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Add form */}
      {adding && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <p className="text-sm font-medium">Nowa kategoria</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Nazwa</Label>
                <Input
                  value={newName}
                  onChange={(e) => {
                    setNewName(e.target.value);
                    setNewSlug(slugify(e.target.value));
                  }}
                  placeholder="np. Wegetarianizm"
                />
              </div>
              <div className="space-y-1">
                <Label>Slug</Label>
                <Input
                  value={newSlug}
                  onChange={(e) => setNewSlug(e.target.value)}
                  placeholder="np. wegetarianizm"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                disabled={!newName || !newSlug || loading === 'new'}
                onClick={handleCreate}
              >
                <Check className="h-4 w-4 mr-1" /> Dodaj
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => { setAdding(false); setNewName(''); setNewSlug(''); }}
              >
                <X className="h-4 w-4 mr-1" /> Anuluj
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Category list */}
      <div className="space-y-2">
        {categories.map((cat) => (
          <Card key={cat.id}>
            <CardContent className="p-4">
              {editing?.id === cat.id ? (
                <div className="grid grid-cols-2 gap-3 items-end">
                  <div className="space-y-1">
                    <Label>Nazwa</Label>
                    <Input
                      value={editing.name}
                      onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Slug</Label>
                    <Input
                      value={editing.slug}
                      onChange={(e) => setEditing({ ...editing, slug: e.target.value })}
                    />
                  </div>
                  <div className="col-span-2 flex gap-2">
                    <Button size="sm" disabled={loading === cat.id} onClick={handleSaveEdit}>
                      <Check className="h-4 w-4 mr-1" /> Zapisz
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                      <X className="h-4 w-4 mr-1" /> Anuluj
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">{cat.name}</p>
                    <p className="text-xs text-muted-foreground font-mono">{cat.slug}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant={cat.isActive ? 'sage' : 'outline'}>
                      {cat.isActive ? 'Aktywna' : 'Nieaktywna'}
                    </Badge>
                    {DEFAULT_SLUGS.has(cat.slug) && (
                      <Badge variant="outline" className="text-xs">domyślna</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={loading === cat.id}
                      onClick={() => handleToggleActive(cat)}
                      className="text-xs"
                    >
                      {cat.isActive ? 'Deaktywuj' : 'Aktywuj'}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={loading === cat.id}
                      onClick={() => setEditing({ id: cat.id, name: cat.name, slug: cat.slug })}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={loading === cat.id}
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleDelete(cat)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
