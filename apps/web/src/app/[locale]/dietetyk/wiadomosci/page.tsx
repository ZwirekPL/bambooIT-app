'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import { MessageCircle, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import { ChatView } from '@/components/dashboard/ChatView';

interface ConversationItem {
  id: string;
  patientId: string;
  dietitianId: string;
  lastMessageAt: string | null;
  unreadCount: number;
  otherName: string;
  lastMessage: { preview: string; senderRole: string; createdAt: string } | null;
}

export default function DietitianMessagesPage() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const startWith = searchParams.get('startWith'); // patientId passed from patient profile
  const userId = (session?.user as { id?: string } | undefined)?.id ?? '';

  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [selected, setSelected] = useState<ConversationItem | null>(null);
  const [loading, setLoading] = useState(true);
  const startWithHandled = useRef(false);

  // Load all conversations
  useEffect(() => {
    api.messages.listConversations('')
      .then((res) => { if (res.ok) setConversations(res.conversations); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Handle ?startWith=patientUserId: auto-open or create conversation
  useEffect(() => {
    if (!startWith || loading || startWithHandled.current) return;
    startWithHandled.current = true;

    const existing = conversations.find((c) => c.patientId === startWith);
    if (existing) {
      setSelected(existing);
      return;
    }

    // Patient not in list yet — find-or-create, then reload list
    api.messages.findOrCreateConversation({ patientId: startWith }, '')
      .then((res) => {
        if (res.ok) {
          api.messages.listConversations('').then((listRes) => {
            if (listRes.ok) {
              setConversations(listRes.conversations);
              const newConv = listRes.conversations.find((c) => c.id === res.conversationId);
              if (newConv) setSelected(newConv);
            }
          });
        }
      })
      .catch(() => {});
  }, [startWith, loading, conversations]);

  function formatDate(dateStr: string | null) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const today = new Date();
    if (d.toDateString() === today.toDateString()) {
      return d.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit' });
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-5xl">
      <h1 className="text-xl font-semibold flex items-center gap-2">
        <MessageCircle className="h-5 w-5" />
        Wiadomości
      </h1>

      {conversations.length === 0 ? (
        <div className="rounded-lg border border-border bg-muted/30 px-6 py-12 text-center">
          <MessageCircle className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-40" />
          <p className="text-sm text-muted-foreground">
            Brak konwersacji z pacjentami.
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Otwórz profil pacjenta i kliknij &quot;Napisz wiadomość&quot;.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
          {/* Conversation list */}
          <div className="space-y-2">
            {conversations.map((conv) => (
              <Card
                key={conv.id}
                className={`cursor-pointer transition-colors hover:bg-muted/50 ${
                  selected?.id === conv.id ? 'ring-2 ring-brand-green' : ''
                }`}
                onClick={() => setSelected(conv)}
              >
                <CardContent className="p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium truncate">{conv.otherName}</span>
                    {conv.unreadCount > 0 && (
                      <Badge className="bg-brand-green text-white text-[10px] h-5 min-w-[20px] flex items-center justify-center">
                        {conv.unreadCount}
                      </Badge>
                    )}
                  </div>
                  {conv.lastMessage && (
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs text-muted-foreground truncate flex-1">
                        {conv.lastMessage.senderRole === 'DIETITIAN' ? 'Ty: ' : ''}
                        {conv.lastMessage.preview}
                      </p>
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {formatDate(conv.lastMessage.createdAt)}
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Chat pane */}
          <div className="md:col-span-2">
            {selected ? (
              <ChatView
                conversationId={selected.id}
                currentUserId={userId}
                currentRole="DIETITIAN"
                otherName={selected.otherName}
                token=""
              />
            ) : (
              <Card className="h-[500px] flex items-center justify-center border-dashed">
                <p className="text-sm text-muted-foreground">Wybierz rozmowę z listy</p>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
