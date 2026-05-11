'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api';
import { refreshUnreadCount } from '@/hooks/useUnreadCount';

interface Message {
  id: string;
  senderId: string;
  senderRole: string;
  content: string;
  readAt: string | null;
  createdAt: string;
}

interface ChatViewProps {
  conversationId: string;
  currentUserId: string;
  currentRole: string;
  otherName: string;
  token: string;
}

export function ChatView({ conversationId, currentUserId, currentRole, otherName, token }: ChatViewProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadMessages = useCallback(async () => {
    try {
      const res = await api.messages.listMessages(conversationId, token);
      if (res.ok) {
        setMessages(res.messages);
        // Mark as read and refresh sidebar badge
        api.messages.markAsRead(conversationId, token)
          .then(() => refreshUnreadCount())
          .catch(() => {});
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [conversationId, token]);

  useEffect(() => {
    loadMessages();
    // Poll every 10s
    pollRef.current = setInterval(loadMessages, 10000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [loadMessages]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length]);

  async function handleSend() {
    if (!input.trim() || sending) return;
    setSending(true);
    try {
      const res = await api.messages.send({ conversationId, content: input.trim() }, token);
      if (res.ok) {
        setMessages((prev) => [...prev, { ...res.message, readAt: null }]);
        setInput('');
      }
    } catch { /* ignore */ }
    finally { setSending(false); }
  }

  function formatTime(dateStr: string) {
    const d = new Date(dateStr);
    const today = new Date();
    const isToday = d.toDateString() === today.toDateString();
    if (isToday) return d.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit' }) + ' ' +
      d.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
  }

  return (
    <Card className="flex flex-col h-[500px]">
      <CardHeader className="pb-2 border-b">
        <CardTitle className="text-sm font-semibold">{otherName}</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden p-0 flex flex-col">
        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {loading && (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}
          {!loading && messages.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              Brak wiadomosci. Napisz pierwsza wiadomosc!
            </p>
          )}
          {messages.map((msg) => {
            const isMe = msg.senderId === currentUserId;
            return (
              <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm ${
                    isMe
                      ? 'bg-brand-green text-white rounded-br-md'
                      : 'bg-muted text-foreground rounded-bl-md'
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                  <p className={`text-[10px] mt-1 ${isMe ? 'text-white/70' : 'text-muted-foreground'}`}>
                    {formatTime(msg.createdAt)}
                    {isMe && msg.readAt && ' \u2713\u2713'}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Input */}
        <div className="border-t px-4 py-3 flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder="Napisz wiadomosc..."
            className="flex-1 rounded-full border border-border bg-background px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-green/30"
            maxLength={5000}
            disabled={sending}
          />
          <Button
            size="sm"
            className="rounded-full h-10 w-10 p-0"
            onClick={handleSend}
            disabled={!input.trim() || sending}
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
