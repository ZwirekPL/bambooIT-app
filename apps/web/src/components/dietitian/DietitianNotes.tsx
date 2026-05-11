'use client';

import { useState, useTransition, useEffect } from 'react';
import { useRouter } from '@/i18n/navigation';
import type { DietitianNote, NoteTemplate } from '@/types/api';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MessageSquarePlus, Send, FileText } from 'lucide-react';

interface DietitianNotesProps {
  patientId: string;
  initialNotes: DietitianNote[];
  token: string;
  readOnly?: boolean;
  labels: {
    title: string;
    empty: string;
    placeholder: string;
    send: string;
    sending: string;
    success: string;
    error: string;
    insertTemplate?: string;
    noTemplates?: string;
  };
}

export function DietitianNotes({
  patientId,
  initialNotes,
  token,
  readOnly,
  labels,
}: DietitianNotesProps) {
  const router = useRouter();
  const [notes, setNotes] = useState(initialNotes);
  const [content, setContent] = useState('');
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [templates, setTemplates] = useState<NoteTemplate[]>([]);

  useEffect(() => {
    if (readOnly) return;
    api.noteTemplates.list(token).then((res) => {
      setTemplates(res.templates);
    }).catch(() => {
      // Silently ignore — templates are optional UX enhancement
    });
  }, [token, readOnly]);

  function handleInsertTemplate(template: NoteTemplate) {
    setContent((prev) => {
      if (prev.trim()) {
        return prev + '\n\n' + template.content;
      }
      return template.content;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;

    setFeedback(null);

    startTransition(async () => {
      try {
        const result = await api.notes.create(patientId, { content: content.trim() }, token);
        setNotes((prev) => [result.note, ...prev]);
        setContent('');
        setFeedback({ type: 'success', message: labels.success });
        setTimeout(() => setFeedback(null), 3000);
      } catch {
        setFeedback({ type: 'error', message: labels.error });
      }
    });
  }

  return (
    <Card className="border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <MessageSquarePlus className="h-4 w-4" />
          {labels.title}
          {notes.length > 0 && (
            <span className="text-sm font-normal text-muted-foreground">
              ({notes.length})
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add note form */}
        {!readOnly && (
          <form onSubmit={handleSubmit} className="space-y-2">
            {templates.length > 0 && (
              <div className="flex justify-end">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button type="button" variant="outline" size="sm">
                      <FileText className="h-3.5 w-3.5 mr-1.5" />
                      {labels.insertTemplate ?? 'Wstaw szablon'}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="max-w-[300px]">
                    <DropdownMenuLabel className="text-xs text-muted-foreground">
                      {labels.insertTemplate ?? 'Wstaw szablon'}
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {templates.map((tpl) => (
                      <DropdownMenuItem
                        key={tpl.id}
                        onClick={() => handleInsertTemplate(tpl)}
                        className="cursor-pointer"
                      >
                        <div className="flex flex-col gap-0.5">
                          <span className="text-sm font-medium">{tpl.title}</span>
                          {tpl.category && (
                            <span className="text-xs text-muted-foreground">{tpl.category}</span>
                          )}
                        </div>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={labels.placeholder}
              rows={3}
              maxLength={5000}
              className="resize-none"
            />
            <div className="flex items-center justify-between">
              {feedback && (
                <span
                  className={`text-xs ${feedback.type === 'success' ? 'text-green-600' : 'text-red-600'}`}
                >
                  {feedback.message}
                </span>
              )}
              <div className="ml-auto">
                <Button
                  type="submit"
                  size="sm"
                  disabled={isPending || !content.trim()}
                >
                  <Send className="h-3.5 w-3.5 mr-1.5" />
                  {isPending ? labels.sending : labels.send}
                </Button>
              </div>
            </div>
          </form>
        )}

        {/* Notes list */}
        {notes.length === 0 ? (
          <p className="text-sm text-muted-foreground">{labels.empty}</p>
        ) : (
          <div className="space-y-3">
            {notes.map((note) => (
              <div
                key={note.id}
                className="rounded-lg border border-border bg-muted/30 px-4 py-3"
              >
                <p className="text-sm whitespace-pre-wrap">{note.content}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {new Date(note.createdAt).toLocaleDateString('pl-PL', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
