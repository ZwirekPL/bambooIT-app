'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { performFullLogout } from '@/lib/logout';

const IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
const WARNING_BEFORE_MS = 60 * 1000; // show warning 1 minute before logout
const WARNING_AT_MS = IDLE_TIMEOUT_MS - WARNING_BEFORE_MS; // 4 minutes
const TICK_MS = 1000;
const STORAGE_KEY = 'idle:lastActivity';
const COOKIE_KEY = 'idle_last_activity';
const CHANNEL_NAME = 'idle-logout';

function writeActivityCookie(ts: number) {
  if (typeof document === 'undefined') return;
  // Non-httpOnly so JS can write; readable by middleware on next navigation.
  // Lax + Secure in prod. Path=/ so it's sent on every request.
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${COOKIE_KEY}=${ts}; Path=/; SameSite=Lax; Max-Age=${IDLE_TIMEOUT_MS / 1000}${secure}`;
}

function clearActivityCookie() {
  if (typeof document === 'undefined') return;
  document.cookie = `${COOKIE_KEY}=; Path=/; SameSite=Lax; Max-Age=0`;
}

const ACTIVITY_EVENTS: (keyof DocumentEventMap)[] = [
  'mousemove',
  'mousedown',
  'keydown',
  'touchstart',
  'scroll',
  'click',
];

export function IdleLogout() {
  const { status } = useSession();
  const t = useTranslations('auth');
  const [showWarning, setShowWarning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(Math.ceil(WARNING_BEFORE_MS / 1000));

  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const channelRef = useRef<BroadcastChannel | null>(null);
  const showWarningRef = useRef(false);

  useEffect(() => {
    showWarningRef.current = showWarning;
  }, [showWarning]);

  const readLastActivity = useCallback((): number => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const n = raw ? parseInt(raw, 10) : NaN;
      return Number.isFinite(n) ? n : Date.now();
    } catch {
      return Date.now();
    }
  }, []);

  const writeLastActivity = useCallback((ts: number, broadcast = true) => {
    try {
      localStorage.setItem(STORAGE_KEY, String(ts));
    } catch {
      /* ignore */
    }
    writeActivityCookie(ts);
    if (broadcast && channelRef.current) {
      try {
        channelRef.current.postMessage({ type: 'activity', ts });
      } catch {
        /* ignore */
      }
    }
  }, []);

  const doLogout = useCallback(() => {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
    setShowWarning(false);
    showWarningRef.current = false;
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    clearActivityCookie();
    if (channelRef.current) {
      try {
        channelRef.current.postMessage({ type: 'logout' });
      } catch {
        /* ignore */
      }
    }
    // Redirect to localized login with reason marker so the form shows a
    // tailored notice ("you were logged out due to inactivity").
    const locale = window.location.pathname.split('/')[1] || 'pl';
    performFullLogout(`/${locale}/zaloguj?reason=idle`);
  }, []);

  // Stamp activity (ignored while warning modal is open — user must click "Stay")
  const handleActivity = useCallback(() => {
    if (showWarningRef.current) return;
    writeLastActivity(Date.now());
  }, [writeLastActivity]);

  const handleStay = useCallback(() => {
    setShowWarning(false);
    showWarningRef.current = false;
    setSecondsLeft(Math.ceil(WARNING_BEFORE_MS / 1000));
    writeLastActivity(Date.now());
  }, [writeLastActivity]);

  useEffect(() => {
    if (status !== 'authenticated') return;

    // Setup cross-tab channel
    if (typeof BroadcastChannel !== 'undefined') {
      channelRef.current = new BroadcastChannel(CHANNEL_NAME);
      channelRef.current.onmessage = (ev) => {
        const data = ev.data;
        if (!data || typeof data !== 'object') return;
        if (data.type === 'logout') {
          doLogout();
        } else if (data.type === 'activity' && typeof data.ts === 'number') {
          // Other tab reported activity → persist locally without rebroadcasting
          writeLastActivity(data.ts, false);
          if (showWarningRef.current) {
            setShowWarning(false);
            showWarningRef.current = false;
            setSecondsLeft(Math.ceil(WARNING_BEFORE_MS / 1000));
          }
        }
      };
    }

    // Initialize last activity if missing
    const existing = (() => {
      try {
        return localStorage.getItem(STORAGE_KEY);
      } catch {
        return null;
      }
    })();
    if (!existing) writeLastActivity(Date.now(), false);

    // Activity listeners
    for (const event of ACTIVITY_EVENTS) {
      document.addEventListener(event, handleActivity, { passive: true });
    }

    // Re-check immediately when tab becomes visible (background timers may be throttled)
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        // Force a tick by re-evaluating idle state
        evaluate();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    // Storage fallback for browsers without BroadcastChannel
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return;
      if (e.newValue == null) {
        // Cleared elsewhere → another tab logged out
        doLogout();
        return;
      }
      if (showWarningRef.current) {
        setShowWarning(false);
        showWarningRef.current = false;
        setSecondsLeft(Math.ceil(WARNING_BEFORE_MS / 1000));
      }
    };
    window.addEventListener('storage', onStorage);

    // Single ticking loop — drives warning + logout based on timestamp diff,
    // immune to setTimeout drift in background tabs.
    const evaluate = () => {
      const last = readLastActivity();
      const idle = Date.now() - last;

      if (idle >= IDLE_TIMEOUT_MS) {
        doLogout();
        return;
      }

      if (idle >= WARNING_AT_MS) {
        if (!showWarningRef.current) {
          setShowWarning(true);
          showWarningRef.current = true;
        }
        const remaining = Math.max(0, Math.ceil((IDLE_TIMEOUT_MS - idle) / 1000));
        setSecondsLeft(remaining);
      } else if (showWarningRef.current) {
        setShowWarning(false);
        showWarningRef.current = false;
      }
    };

    evaluate();
    tickRef.current = setInterval(evaluate, TICK_MS);

    return () => {
      if (tickRef.current) {
        clearInterval(tickRef.current);
        tickRef.current = null;
      }
      for (const event of ACTIVITY_EVENTS) {
        document.removeEventListener(event, handleActivity);
      }
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('storage', onStorage);
      if (channelRef.current) {
        channelRef.current.close();
        channelRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  if (status !== 'authenticated' || !showWarning) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50">
      <div className="mx-4 w-full max-w-sm rounded-lg bg-white p-6 shadow-xl">
        <h2 className="mb-2 text-lg font-semibold text-gray-900">
          {t('idleWarningTitle')}
        </h2>
        <p className="mb-4 text-sm text-gray-600">
          {t('idleWarningMessage', { seconds: secondsLeft })}
        </p>
        <div className="flex gap-3">
          <button
            onClick={handleStay}
            className="flex-1 rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 min-h-[44px]"
          >
            {t('idleStayButton')}
          </button>
          <button
            onClick={doLogout}
            className="flex-1 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 min-h-[44px]"
          >
            {t('idleLogoutButton')}
          </button>
        </div>
      </div>
    </div>
  );
}
