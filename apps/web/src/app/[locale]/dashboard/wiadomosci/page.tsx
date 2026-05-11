'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { MessageCircle, Loader2 } from 'lucide-react';
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

export default function MessagesPage() {
  const { data: session } = useSession();
  const userId = (session?.user as { id?: string } | undefined)?.id ?? '';
  const role = (session?.user as { role?: string } | undefined)?.role ?? 'PATIENT';

  const [conversation, setConversation] = useState<ConversationItem | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.messages.listConversations('')
      .then((res) => {
        if (res.ok && res.conversations.length > 0) {
          setConversation(res.conversations[0]);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <h1 className="text-xl font-semibold flex items-center gap-2">
        <MessageCircle className="h-5 w-5" />
        Wiadomości
      </h1>

      {conversation ? (
        <ChatView
          conversationId={conversation.id}
          currentUserId={userId}
          currentRole={role}
          otherName={conversation.otherName || 'Dietetyk'}
          token=""
        />
      ) : (
        <div className="rounded-lg border border-border bg-muted/30 px-6 py-12 text-center">
          <MessageCircle className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-40" />
          <p className="text-sm text-muted-foreground">
            Nie masz jeszcze żadnej rozmowy z dietetykiem.
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Dietetyk może zainicjować rozmowę z Twojego profilu.
          </p>
        </div>
      )}
    </div>
  );
}