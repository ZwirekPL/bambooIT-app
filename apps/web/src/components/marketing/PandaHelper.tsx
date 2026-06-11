'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useTranslations } from 'next-intl';

/**
 * Bambi — floating panda helper / guide.
 *
 * Lives fixed in the bottom-right corner of the marketing pages and does
 * three things the user asked for:
 *   1. Reacts to scroll — gentle idle bob + eyes that glance in the scroll
 *      direction, so the mascot feels alive.
 *   2. Contextual tips — a speech bubble whose text follows the section in
 *      view (IntersectionObserver over #services / #pricing / #audit), e.g.
 *      explaining that the services strip scrolls sideways.
 *   3. Onboarding for non-savvy visitors — when idle at the very top it nudges
 *      "there's more below ↓"; at the very bottom it offers "back to top ↑"
 *      (clicking the panda scrolls up). Intro greeting on first paint.
 *
 * Dismissible: the X collapses Bambi to a small re-open button, persisted in
 * localStorage so return visits aren't nagged. prefers-reduced-motion drops
 * the bob/pulse but keeps the (instant) bubbles.
 */

const DISMISS_KEY = 'bambi-helper-dismissed';

// Section ids on the homepage that carry a contextual tip. Order is the
// document order so the most-relevant visible one wins.
const TIP_SECTIONS = ['services', 'pricing', 'audit'] as const;
type TipSection = (typeof TIP_SECTIONS)[number];

const TOP_THRESHOLD_PX = 140; // within this of the top counts as "at top"
const BOTTOM_THRESHOLD_PX = 240; // within this of the bottom counts as "at bottom"
const IDLE_MS = 2500; // no scroll at the top before nudging "scroll down"
const TIP_AUTOHIDE_MS = 6000; // contextual tip auto-hides after this

type Position = 'top' | 'middle' | 'bottom';

type Bubble = {
  text: string;
  /** When set, clicking the panda performs this action instead of toggling. */
  action?: 'scrollTop';
} | null;

export function PandaHelper() {
  const t = useTranslations('pandaHelper');
  const shouldReduceMotion = useReducedMotion();

  const [mounted, setMounted] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [position, setPosition] = useState<Position>('top');
  const [scrollDir, setScrollDir] = useState<'up' | 'down'>('down');
  const [activeSection, setActiveSection] = useState<TipSection | null>(null);
  const [idleAtTop, setIdleAtTop] = useState(false);
  const [introVisible, setIntroVisible] = useState(true);
  // When the user clicks Bambi we surface a tip even if the derivation would
  // otherwise hide the bubble; cleared on auto-hide.
  const [manualText, setManualText] = useState<string | null>(null);

  const lastYRef = useRef(0);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const manualTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Read persisted dismissal once on the client (avoids SSR hydration mismatch).
  useEffect(() => {
    setMounted(true);
    try {
      if (localStorage.getItem(DISMISS_KEY) === '1') setDismissed(true);
    } catch {
      /* localStorage blocked — show Bambi anyway */
    }
  }, []);

  // Scroll listener: position, direction, idle-at-top, and clearing the intro
  // on the first real scroll. rAF-throttled.
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const y = window.scrollY;
      const vh = window.innerHeight;
      const docH = document.documentElement.scrollHeight;

      const atTop = y < TOP_THRESHOLD_PX;
      const atBottom = y + vh >= docH - BOTTOM_THRESHOLD_PX;
      setPosition(atBottom ? 'bottom' : atTop ? 'top' : 'middle');

      if (Math.abs(y - lastYRef.current) > 4) {
        setScrollDir(y > lastYRef.current ? 'down' : 'up');
        lastYRef.current = y;
      }

      if (y > TOP_THRESHOLD_PX) setIntroVisible(false);

      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      if (atTop) {
        setIdleAtTop(false);
        idleTimerRef.current = setTimeout(() => setIdleAtTop(true), IDLE_MS);
      } else {
        setIdleAtTop(false);
      }
    };

    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    // Kick off the idle timer for visitors who never scroll.
    idleTimerRef.current = setTimeout(() => setIdleAtTop(true), IDLE_MS + 1500);
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (frame) cancelAnimationFrame(frame);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, []);

  // Drop the intro greeting after a few seconds regardless of scrolling.
  useEffect(() => {
    const id = setTimeout(() => setIntroVisible(false), 5000);
    return () => clearTimeout(id);
  }, []);

  // Track which tip-section is most in view.
  useEffect(() => {
    if (dismissed) return;
    const ratios = new Map<TipSection, number>();
    const targets = TIP_SECTIONS.map((id) => document.getElementById(id)).filter(
      (el): el is HTMLElement => el !== null,
    );
    if (targets.length === 0) return;

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          ratios.set(entry.target.id as TipSection, entry.isIntersecting ? entry.intersectionRatio : 0);
        }
        let best: TipSection | null = null;
        let bestRatio = 0.15; // require a meaningful slice on screen
        for (const id of TIP_SECTIONS) {
          const r = ratios.get(id) ?? 0;
          if (r > bestRatio) {
            bestRatio = r;
            best = id;
          }
        }
        setActiveSection(best);
      },
      { threshold: [0, 0.15, 0.35, 0.6, 0.85] },
    );

    targets.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [dismissed]);

  const scrollToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: shouldReduceMotion ? 'auto' : 'smooth' });
  }, [shouldReduceMotion]);

  const dismiss = useCallback(() => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* ignore */
    }
  }, []);

  const reopen = useCallback(() => {
    setDismissed(false);
    setManualText(t('help'));
    if (manualTimerRef.current) clearTimeout(manualTimerRef.current);
    manualTimerRef.current = setTimeout(() => setManualText(null), TIP_AUTOHIDE_MS);
    try {
      localStorage.removeItem(DISMISS_KEY);
    } catch {
      /* ignore */
    }
  }, [t]);

  // Auto-hide the manual tip whenever it appears.
  useEffect(() => {
    if (manualText === null) return;
    if (manualTimerRef.current) clearTimeout(manualTimerRef.current);
    manualTimerRef.current = setTimeout(() => setManualText(null), TIP_AUTOHIDE_MS);
    return () => {
      if (manualTimerRef.current) clearTimeout(manualTimerRef.current);
    };
  }, [manualText]);

  // Derive the current bubble from priority: dismissed → none, manual click,
  // intro greeting, bottom (back-to-top), section tip, idle-at-top nudge.
  let bubble: Bubble = null;
  if (!dismissed) {
    if (manualText) {
      bubble = { text: manualText };
    } else if (introVisible) {
      bubble = { text: t('intro') };
    } else if (position === 'bottom') {
      bubble = { text: t('backToTop'), action: 'scrollTop' };
    } else if (activeSection) {
      bubble = { text: t(`tips.${activeSection}`) };
    } else if (position === 'top' && idleAtTop) {
      bubble = { text: t('scrollHint') };
    }
  }

  const handlePandaClick = useCallback(() => {
    if (bubble?.action === 'scrollTop') {
      scrollToTop();
      return;
    }
    // Otherwise surface a helpful tip on demand.
    const onDemand =
      (position === 'bottom' && t('backToTop')) ||
      (activeSection && t(`tips.${activeSection}`)) ||
      t('help');
    setManualText(onDemand);
  }, [bubble, scrollToTop, position, activeSection, t]);

  if (!mounted) return null;

  // Collapsed: just a small re-open button.
  if (dismissed) {
    return (
      <button
        type="button"
        onClick={reopen}
        aria-label={t('reopenAria')}
        className="fixed bottom-5 right-5 z-40 flex h-12 w-12 items-center justify-center rounded-full border border-line bg-white shadow-[0_8px_24px_-8px_rgba(44,62,80,0.35)] transition-transform hover:scale-105 md:bottom-6 md:right-6"
      >
        <PandaFace size={30} scrollDir="down" idle={false} />
      </button>
    );
  }

  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-40 flex max-w-[min(82vw,320px)] flex-col items-end gap-2 md:bottom-6 md:right-6">
      <AnimatePresence>
        {bubble && (
          <motion.div
            key={bubble.text}
            initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.96 }}
            animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="pointer-events-auto relative rounded-2xl rounded-br-md border border-line bg-white px-4 py-3 text-sm leading-[1.45] text-navy shadow-[0_12px_32px_-12px_rgba(44,62,80,0.4)]"
          >
            <span className="mb-1 block font-mono text-[10px] uppercase tracking-[0.18em] text-bamboo-deep">
              {t('name')}
            </span>
            {bubble.text}
            {/* little tail toward the panda */}
            <span
              aria-hidden="true"
              className="absolute -bottom-[7px] right-6 h-3 w-3 rotate-45 border-b border-r border-line bg-white"
            />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="pointer-events-auto flex items-center gap-1.5">
        <button
          type="button"
          onClick={dismiss}
          aria-label={t('closeAria')}
          className="flex h-6 w-6 items-center justify-center rounded-full border border-line bg-white/90 text-navy-soft shadow-sm transition-colors hover:bg-paper hover:text-navy"
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>

        <motion.button
          type="button"
          onClick={handlePandaClick}
          aria-label={bubble?.action === 'scrollTop' ? t('backToTopAria') : t('openAria')}
          className="flex h-16 w-16 items-center justify-center rounded-full border border-line bg-white shadow-[0_10px_28px_-8px_rgba(44,62,80,0.4)] md:h-[72px] md:w-[72px]"
          animate={
            shouldReduceMotion
              ? undefined
              : { y: [0, -5, 0] }
          }
          transition={
            shouldReduceMotion
              ? undefined
              : { duration: 3.2, repeat: Infinity, ease: 'easeInOut' }
          }
          whileHover={shouldReduceMotion ? undefined : { scale: 1.06 }}
          whileTap={shouldReduceMotion ? undefined : { scale: 0.94 }}
        >
          <PandaFace size={44} scrollDir={scrollDir} idle={!shouldReduceMotion} />
        </motion.button>
      </div>
    </div>
  );
}

/**
 * Compact Bambi face — navy head + ears, white eye-patches, bamboo nose.
 * Pupils translate a touch in the scroll direction so Bambi "looks" where the
 * page is going. Blinks on an idle loop unless reduced motion is requested.
 */
function PandaFace({
  size,
  scrollDir,
  idle,
}: {
  size: number;
  scrollDir: 'up' | 'down';
  idle: boolean;
}) {
  const pupilDy = scrollDir === 'down' ? 1.5 : -1.5;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      aria-hidden="true"
    >
      {/* ears */}
      <circle cx="26" cy="24" r="13" fill="#1A2735" />
      <circle cx="74" cy="24" r="13" fill="#1A2735" />
      {/* head */}
      <circle cx="50" cy="54" r="34" fill="#fff" stroke="#1A2735" strokeWidth="3" />
      {/* eye patches */}
      <ellipse cx="38" cy="50" rx="9" ry="11" fill="#1A2735" transform="rotate(-12 38 50)" />
      <ellipse cx="62" cy="50" rx="9" ry="11" fill="#1A2735" transform="rotate(12 62 50)" />
      {/* eyes (white) + pupils */}
      <circle cx="38" cy="50" r="3.6" fill="#fff" />
      <circle cx="62" cy="50" r="3.6" fill="#fff" />
      <motion.circle
        cx="38"
        cy="50"
        r="1.8"
        fill="#1A2735"
        animate={idle ? { cy: 50 + pupilDy } : undefined}
        transition={{ duration: 0.4, ease: 'easeOut' }}
      />
      <motion.circle
        cx="62"
        cy="50"
        r="1.8"
        fill="#1A2735"
        animate={idle ? { cy: 50 + pupilDy } : undefined}
        transition={{ duration: 0.4, ease: 'easeOut' }}
      />
      {/* nose + mouth */}
      <ellipse cx="50" cy="64" rx="4" ry="3" fill="#6FA336" />
      <path d="M50 67 v3 M50 70 q-5 4 -9 1 M50 70 q5 4 9 1" stroke="#1A2735" strokeWidth="2" strokeLinecap="round" />
      {/* blink overlay — lids drop on an idle loop */}
      {idle && (
        <>
          <motion.rect
            x="33" y="44" width="10" height="0" rx="2" fill="#1A2735"
            animate={{ height: [0, 0, 7, 0, 0] }}
            transition={{ duration: 4, repeat: Infinity, times: [0, 0.88, 0.93, 0.98, 1] }}
          />
          <motion.rect
            x="57" y="44" width="10" height="0" rx="2" fill="#1A2735"
            animate={{ height: [0, 0, 7, 0, 0] }}
            transition={{ duration: 4, repeat: Infinity, times: [0, 0.88, 0.93, 0.98, 1] }}
          />
        </>
      )}
    </svg>
  );
}
