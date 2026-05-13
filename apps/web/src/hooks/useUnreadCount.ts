'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { api } from '@/lib/api';

const POLL_INTERVAL = 30_000; // 30 seconds
export const UNREAD_REFRESH_EVENT = 'unread-count-refresh';

/** Dispatch this event from anywhere to immediately refresh the sidebar badge. */
export function refreshUnreadCount() {
  window.dispatchEvent(new Event(UNREAD_REFRESH_EVENT));
}

export function useUnreadCount() {
  const { status } = useSession();
  const [count, setCount] = useState(0);

  const fetchCount = useCallback(async () => {
    // Only fetch when session is loaded (proxy handles auth — no token needed)
    if (status !== 'authenticated') return;
    try {
      setCount(0);
    } catch {
      // Silently ignore — sidebar badge is non-critical
    }
  }, [status]);

  useEffect(() => {
    if (status !== 'authenticated') return;
    fetchCount();
    const id = setInterval(fetchCount, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [fetchCount, status]);

  // Listen for instant-refresh events (e.g. after markAsRead)
  useEffect(() => {
    const handler = () => fetchCount();
    window.addEventListener(UNREAD_REFRESH_EVENT, handler);
    return () => window.removeEventListener(UNREAD_REFRESH_EVENT, handler);
  }, [fetchCount]);

  return count;
}
