'use client';

import { useState, useTransition } from 'react';
import type { NoteTemplate } from '@/types/api';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Plus, Pencil, Trash2, X, FileText } from 'lucide-react';

interface Labels {
  addNew: string;
  editTemplate: string;
  deleteTemplate: string;
  titleLabel: string;
  titlePlaceholder: string;
  contentLabel: string;
  contentPlaceholder: string;
  categoryLabel: string;
  categoryPlaceholder: string;
  save: string;
  saving: string;
  cancel: string;
  empty: string;
  deleteConfirm: string;
  successCreate: string;
  successUpdate: string;
  successDelete: string;
  error: string;
}

interface NoteTemplateManagerProps {
  initialTemplates: NoteTemplate[];
  token: string;
  labels: Labels;
}

type FormMode = 'closed' | 'create' | 'edit';

export function NoteTemplateManager({ initialTemplates, token, labels }: NoteTemplateManagerProps) {
  const [templates, setTemplates] = useState(initialTemplates);
  const [mode, setMode] = useState<FormMode>('closed');
  const [editId, setEditId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('');
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  function openCreate() {
    setMode('create');
    setEditId(null);
    setTitle('');
    setContent('');
    setCategory('');
    setFeedback(null);
  }

  function openEdit(tpl: NoteTemplate) {
    setMode('edit');
    setEditId(tpl.id);
    setTitle(tpl.title);
    setContent(tpl.content);
    setCategory(tpl.category ?? '');
    setFeedback(null);
  }

  function closeForm() {
    setMode('closed');
    setEditId(null);
    setTitle('');
    setContent('');
    setCategory('');
  }

  function showFeedback(type: 'success' | 'error', message: string) {
    setFeedback({ type, message });
    if (type === 'success') {
      setTimeout(() => setFeedback(null), 3000);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;

    startTransition(async () => {
      try {
        if (mode === 'create') {
          const res = await api.noteTemplates.create(
            { title: title.trim(), content: content.trim(), category: category.trim() || undefined },
            token
          );
          setTemplates((prev) => [res.template, ...prev]);
          showFeedback('success', labels.successCreate);
          closeForm();
        } else if (mode === 'edit' && editId) {
          const res = await api.noteTemplates.update(
            editId,
            {
              title: title.trim(),
              content: content.trim(),
              category: category.trim() || null,
            },
            token
          );
          setTemplates((prev) => prev.map((t) => (t.id === editId ? res.template : t)));
          showFeedback('success', labels.successUpdate);
          closeForm();
        }
      } catch {
        showFeedback('error', labels.error);
      }
    });
  }

  function handleDelete(id: string) {
    if (!window.confirm(labels.deleteConfirm)) return;

    startTransition(async () => {
      try {
        await api.noteTemplates.remove(id, token);
        setTemplates((prev) => prev.filter((t) => t.id !== id));
        showFeedback('success', labels.successDelete);
        if (editId === id) closeForm();
      } catch {
        showFeedback('error', labels.error);
      }
    });
  }

  // Group templates by category
  const grouped = templates.reduce<Record<string, NoteTemplate[]>>((acc, tpl) => {
    const key = tpl.category ?? '';
    if (!acc[key]) acc[key] = [];
    acc[key].push(tpl);
    return acc;
  }, {});
  const groupKeys = Object.keys(grouped).sort((a, b) => {
    if (a === '') return 1;
    if (b === '') return -1;
    return a.localeCompare(b, 'pl');
  });

  return (
    <div className="space-y-6">
      {/* Feedback */}
      {feedback && (
        <div
          className={`rounded-lg px-4 py-3 text-sm ${
            feedback.type === 'success'
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {feedback.message}
        </div>
      )}

      {/* Add / Edit form */}
      {mode !== 'closed' ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center justify-between">
              <span>{mode === 'create' ? labels.addNew : labels.editTemplate}</span>
              <Button type="button" variant="ghost" size="icon" onClick={closeForm}>
                <X className="h-4 w-4" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="tpl-title">{labels.titleLabel}</Label>
                <Input
                  id="tpl-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={labels.titlePlaceholder}
                  maxLength={200}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tpl-content">{labels.contentLabel}</Label>
                <Textarea
                  id="tpl-content"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder={labels.contentPlaceholder}
                  rows={5}
                  maxLength={5000}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tpl-category">{labels.categoryLabel}</Label>
                <Input
                  id="tpl-category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder={labels.categoryPlaceholder}
                  maxLength={100}
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={closeForm}>
                  {labels.cancel}
                </Button>
                <Button type="submit" disabled={isPending || !title.trim() || !content.trim()}>
                  {isPending ? labels.saving : labels.save}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : (
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1.5" />
          {labels.addNew}
        </Button>
      )}

      {/* Templates list */}
      {templates.length === 0 && mode === 'closed' ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">{labels.empty}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {groupKeys.map((groupKey) => (
            <div key={groupKey}>
              {groupKey && (
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                  {groupKey}
                </h3>
              )}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {grouped[groupKey].map((tpl) => (
                  <Card key={tpl.id} className="relative group">
                    <CardContent className="py-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <h4 className="text-sm font-semibold truncate">{tpl.title}</h4>
                          {tpl.category && (
                            <span className="text-xs text-muted-foreground">{tpl.category}</span>
                          )}
                        </div>
                        <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => openEdit(tpl)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => handleDelete(tpl.id)}
                            disabled={isPending}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground line-clamp-3 whitespace-pre-wrap">
                        {tpl.content}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
