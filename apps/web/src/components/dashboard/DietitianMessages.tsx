import type { DietitianNote } from '@/types/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MessageSquare } from 'lucide-react';

interface DietitianMessagesProps {
  notes: DietitianNote[];
  labels: {
    title: string;
    empty: string;
  };
}

export function DietitianMessages({ notes, labels }: DietitianMessagesProps) {
  if (notes.length === 0) return null;

  return (
    <Card className="border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <MessageSquare className="h-4 w-4" />
          {labels.title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {notes.slice(0, 10).map((note) => (
          <div
            key={note.id}
            className="rounded-lg border border-sage-200 bg-sage-50/50 px-4 py-3"
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
      </CardContent>
    </Card>
  );
}
