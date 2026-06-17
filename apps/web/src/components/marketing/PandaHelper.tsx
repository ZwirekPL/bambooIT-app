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

// Section ids on the homepage that carry a contextual tip, in document order
// so the most-relevant visible one wins.
const TIP_SECTIONS = [
  'offer',
  'manifesto',
  'services',
  'pricing',
  'process',
  'industries',
  'audit',
  'faq',
] as const;
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
  const [activeSection, setActiveSection] = useState<TipSection | null>(null);
  const [idleAtTop, setIdleAtTop] = useState(false);
  const [introVisible, setIntroVisible] = useState(true);
  // When the user clicks Bambi we surface a tip even if the derivation would
  // otherwise hide the bubble; cleared on auto-hide.
  const [manualText, setManualText] = useState<string | null>(null);

  // Eyes follow the cursor (offset clamped to a couple of px) for interactivity.
  const [pupil, setPupil] = useState({ x: 0, y: 0 });
  const [hovered, setHovered] = useState(false);

  const lastYRef = useRef(0);
  const introClearedRef = useRef(false);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const manualTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pandaRef = useRef<HTMLButtonElement>(null);

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

      lastYRef.current = y;

      if (y > TOP_THRESHOLD_PX && !introClearedRef.current) {
        introClearedRef.current = true;
        setIntroVisible(false);
      }

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
        let bestRatio = 0.12; // require a meaningful slice on screen
        for (const id of TIP_SECTIONS) {
          const r = ratios.get(id) ?? 0;
          if (r > bestRatio) {
            bestRatio = r;
            best = id;
          }
        }
        // Sticky: only advance to a new section, never blank out between them,
        // so Bambi keeps talking continuously while scrolling.
        if (best) setActiveSection(best);
      },
      { threshold: [0, 0.15, 0.35, 0.6, 0.85] },
    );

    targets.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [dismissed]);

  // Pupils glance toward the cursor. rAF-throttled; disabled for reduced motion.
  useEffect(() => {
    if (shouldReduceMotion || dismissed) return;
    let frame = 0;
    let nextX = 0;
    let nextY = 0;
    const apply = () => {
      frame = 0;
      setPupil({ x: nextX, y: nextY });
    };
    const onMove = (e: MouseEvent) => {
      const el = pandaRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const dist = Math.hypot(dx, dy) || 1;
      const max = 2.4; // px of pupil travel in SVG units
      nextX = (dx / dist) * max;
      nextY = (dy / dist) * max;
      if (!frame) frame = requestAnimationFrame(apply);
    };
    window.addEventListener('mousemove', onMove, { passive: true });
    return () => {
      window.removeEventListener('mousemove', onMove);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [shouldReduceMotion, dismissed]);

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
      <motion.button
        type="button"
        onClick={reopen}
        aria-label={t('reopenAria')}
        className="fixed bottom-[222px] right-4 z-40 bg-transparent md:bottom-[230px] md:right-6"
        whileHover={shouldReduceMotion ? undefined : { scale: 1.08, rotate: -4 }}
        whileTap={shouldReduceMotion ? undefined : { scale: 0.92 }}
      >
        <PandaCharacter size={62} pupil={{ x: 0, y: 0 }} idle={false} hovered={false} />
      </motion.button>
    );
  }

  return (
    <div className="pointer-events-none fixed bottom-[222px] right-4 z-40 md:bottom-[230px] md:right-6">
      <div className="pointer-events-auto group relative">
        {/* Speech bubble — anchored ABOVE the panda and taken out of flow
            (absolute) so its height changes never shift the panda below it.
            mode="wait" lets one bubble fully exit before the next enters, so
            section-to-section text changes never overlap or flicker. */}
        <AnimatePresence mode="wait" initial={false}>
          {bubble && (
            <motion.div
              key={bubble.text}
              initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 6, scale: 0.97 }}
              animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
              exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 6, scale: 0.97 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="pointer-events-auto absolute bottom-full right-0 mb-3 w-max max-w-[min(78vw,300px)] rounded-2xl rounded-br-md border border-line bg-white px-4 py-3 text-sm leading-[1.45] text-navy shadow-[0_12px_32px_-12px_rgba(44,62,80,0.4)]"
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

        {/* dismiss — subtle, fades in on hover */}
        <button
          type="button"
          onClick={dismiss}
          aria-label={t('closeAria')}
          className="absolute -left-1 -top-1 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-line bg-white/90 text-navy-soft opacity-0 shadow-sm transition-opacity hover:text-navy focus-visible:opacity-100 group-hover:opacity-100"
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>

        {/* Bambi — floating, no background plate */}
        <motion.button
          ref={pandaRef}
          type="button"
          onClick={handlePandaClick}
          onHoverStart={() => setHovered(true)}
          onHoverEnd={() => setHovered(false)}
          aria-label={bubble?.action === 'scrollTop' ? t('backToTopAria') : t('openAria')}
          className="bg-transparent"
          animate={shouldReduceMotion ? undefined : { y: [0, -6, 0] }}
          transition={
            shouldReduceMotion
              ? undefined
              : { duration: 3.4, repeat: Infinity, ease: 'easeInOut' }
          }
          whileHover={shouldReduceMotion ? undefined : { scale: 1.07, rotate: -3 }}
          whileTap={shouldReduceMotion ? undefined : { scale: 0.9, rotate: 4 }}
        >
          <PandaCharacter
            size={92}
            pupil={pupil}
            idle={!shouldReduceMotion}
            hovered={hovered}
          />
        </motion.button>
      </div>
    </div>
  );
}

const NAVY = '#1A2735';
const BAMBOO = '#6FA336';
const BAMBOO_BRIGHT = '#9ec956';

/**
 * Bambi — a full sitting panda character that floats without a background
 * plate. Holds a bamboo sprig, breathes, blinks on an idle loop, glances its
 * pupils toward the cursor (`pupil`), and waves its right paw on `hovered`.
 * All motion is gated by `idle` (false under prefers-reduced-motion).
 */
function PandaCharacter({
  size,
  pupil,
  idle,
  hovered,
}: {
  size: number;
  pupil: { x: number; y: number };
  idle: boolean;
  hovered: boolean;
}) {
  const blink = idle
    ? {
        animate: { scaleY: [1, 1, 0.1, 1, 1] as number[] },
        transition: { duration: 4.2, repeat: Infinity, times: [0, 0.9, 0.94, 0.98, 1] },
        style: { transformBox: 'fill-box', transformOrigin: 'center' } as const,
      }
    : {};

  // Idle "chewing" loop: every ~6.5s Bambi leans toward the bamboo and takes a
  // few nibbles — head tilts, jaw works, the top leaf gets bitten — all phased
  // to the same keyframe times so they read as one motion.
  const chewTimes = [0, 0.5, 0.58, 0.66, 0.74, 0.82, 1];
  const chew = (
    animate: Record<string, number[]>,
    origin = 'center',
  ) =>
    idle
      ? {
          animate,
          transition: { duration: 6.5, repeat: Infinity, times: chewTimes, ease: 'easeInOut' as const },
          style: { transformBox: 'fill-box', transformOrigin: origin } as const,
        }
      : {};

  return (
    <svg
      width={size}
      height={Math.round(size * 1.12)}
      viewBox="0 0 120 134"
      fill="none"
      aria-hidden="true"
    >
      <defs>
        <filter id="bambi-shadow" x="-30%" y="-25%" width="160%" height="165%">
          <feDropShadow dx="0" dy="6" stdDeviation="5" floodColor={NAVY} floodOpacity="0.26" />
        </filter>
      </defs>

      <g filter="url(#bambi-shadow)">
        {/* ---- body ---- */}
        <ellipse cx="60" cy="94" rx="35" ry="31" fill={NAVY} />
        <ellipse cx="60" cy="98" rx="24" ry="23" fill="#fff" />
        {/* feet */}
        <ellipse cx="43" cy="118" rx="12" ry="8.5" fill={NAVY} />
        <ellipse cx="77" cy="118" rx="12" ry="8.5" fill={NAVY} />
        <ellipse cx="43" cy="118" rx="5" ry="3.6" fill={BAMBOO} opacity="0.55" />
        <ellipse cx="77" cy="118" rx="5" ry="3.6" fill={BAMBOO} opacity="0.55" />

        {/* ---- waving right paw ---- */}
        <motion.g
          style={{ transformBox: 'fill-box', transformOrigin: 'center bottom' }}
          animate={idle && hovered ? { rotate: [0, -24, -6, -24, 0] } : { rotate: 0 }}
          transition={{ duration: 0.7, ease: 'easeInOut' }}
        >
          <ellipse cx="93" cy="72" rx="9.5" ry="8" fill={NAVY} />
          <ellipse cx="93" cy="70" rx="4.5" ry="3.3" fill={BAMBOO} opacity="0.55" />
        </motion.g>

        {/* ---- head ---- dips down onto the bamboo on the chew loop ---- */}
        <motion.g {...chew({ y: [0, 0, 2.6, 1, 2.6, 1, 0] })}>
          {/* ears */}
          <circle cx="37" cy="20" r="12.5" fill={NAVY} />
          <circle cx="83" cy="20" r="12.5" fill={NAVY} />
          <circle cx="37" cy="20" r="5.5" fill="#37485a" />
          <circle cx="83" cy="20" r="5.5" fill="#37485a" />
          {/* head shape */}
          <circle cx="60" cy="46" r="34" fill="#fff" stroke={NAVY} strokeWidth="2.5" />
          {/* cheek blush */}
          <circle cx="39" cy="56" r="6.5" fill={BAMBOO_BRIGHT} opacity="0.32" />
          <circle cx="81" cy="56" r="6.5" fill={BAMBOO_BRIGHT} opacity="0.32" />
          {/* eye patches */}
          <ellipse cx="47" cy="44" rx="8.5" ry="11.5" fill={NAVY} transform="rotate(-20 47 44)" />
          <ellipse cx="73" cy="44" rx="8.5" ry="11.5" fill={NAVY} transform="rotate(20 73 44)" />

          {/* eyes — whites + cursor-tracking pupils, wrapped for the blink */}
          <motion.g {...blink}>
            <circle cx="47" cy="45" r="5.2" fill="#fff" />
            <circle cx="73" cy="45" r="5.2" fill="#fff" />
            <motion.circle
              cx="47" cy="45" r="2.8" fill={NAVY}
              animate={{ x: pupil.x, y: pupil.y }}
              transition={{ type: 'spring', stiffness: 260, damping: 22 }}
            />
            <motion.circle
              cx="73" cy="45" r="2.8" fill={NAVY}
              animate={{ x: pupil.x, y: pupil.y }}
              transition={{ type: 'spring', stiffness: 260, damping: 22 }}
            />
            <circle cx="48.4" cy="43.4" r="1" fill="#fff" />
            <circle cx="74.4" cy="43.4" r="1" fill="#fff" />
          </motion.g>

          {/* nose + chewing jaw */}
          <ellipse cx="60" cy="55" rx="4.6" ry="3.2" fill={NAVY} />
          <motion.path
            {...chew({ scaleY: [1, 1, 0.35, 1, 0.35, 1, 1] }, 'center top')}
            d="M60 58 v3 M60 61 q-6 5 -11 1 M60 61 q6 5 11 1"
            stroke={NAVY}
            strokeWidth="2.2"
            strokeLinecap="round"
            fill="none"
          />
        </motion.g>

        {/* ---- bamboo shoot held up to the mouth (in front of the face) ----
             nudges up to meet the dipping head so the bite lands on the tip. */}
        <motion.g {...chew({ y: [0, 0, -1.6, -0.6, -1.6, -0.6, 0] })}>
          <g transform="rotate(11 59 82)">
            <rect x="56" y="64" width="6" height="34" rx="3" fill={BAMBOO} />
            <line x1="56" y1="78" x2="62" y2="78" stroke={NAVY} strokeWidth="1.3" opacity="0.5" />
            <line x1="56" y1="90" x2="62" y2="90" stroke={NAVY} strokeWidth="1.3" opacity="0.5" />
          </g>
          {/* top tip — the soft shoot end Bambi nibbles off */}
          <motion.g {...chew({ scale: [1, 1, 0.5, 1, 0.5, 1, 1] }, 'bottom center')}>
            <ellipse cx="58.5" cy="63.5" rx="3.6" ry="2.8" fill={BAMBOO_BRIGHT} />
          </motion.g>
        </motion.g>
        {/* left paw raised, gripping the shoot */}
        <ellipse cx="55" cy="96" rx="9" ry="7.5" fill={NAVY} />
        <ellipse cx="55" cy="94" rx="4.2" ry="3" fill={BAMBOO} opacity="0.55" />
      </g>
    </svg>
  );
}
