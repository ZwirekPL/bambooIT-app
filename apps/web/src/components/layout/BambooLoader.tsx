'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

/**
 * A1 — Full-screen brand loader from mockups/bambooit-netguru-v3.html.
 * Mounts once per session (lives in [locale]/layout.tsx → doesn't remount
 * on client-side navigation). Shows for 1.8s, then fades + slides up.
 *
 * Honors prefers-reduced-motion: when set, the loader hides immediately
 * on first render so users with motion sensitivity see content directly.
 *
 * Uses Framer Motion (not GSAP) — simple enter/exit choreography, no
 * scroll trigger, idiomatic React fit.
 */
export const LOADER_DURATION_MS = 1800;
export const LOADER_FADE_MS = 800;
const EASE_CUBIC = [0.7, 0, 0.2, 1] as const;

export function BambooLoader() {
  const [visible, setVisible] = useState(true);
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    if (shouldReduceMotion) {
      setVisible(false);
      return;
    }
    const timer = setTimeout(() => setVisible(false), LOADER_DURATION_MS);
    return () => clearTimeout(timer);
  }, [shouldReduceMotion]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 z-[1000] flex flex-col items-center justify-center gap-6 bg-navy-deep"
          exit={{ opacity: 0, y: '-100%' }}
          transition={{ duration: 0.8, ease: EASE_CUBIC }}
        >
          {/* Wordmark — same construction as <BrandMark /> in Header.tsx
              but bigger and white on navy-deep */}
          <div className="font-display text-5xl font-black leading-none tracking-[-0.04em] text-white md:text-7xl lg:text-8xl">
            ba<span className="italic text-bamboo">m</span>boo<span className="italic text-bamboo">it</span>
          </div>

          {/* Progress bar — fills bamboo over 1.2s */}
          <div className="relative h-0.5 w-[min(280px,60vw)] overflow-hidden bg-white/10">
            <motion.span
              aria-hidden="true"
              className="absolute inset-y-0 left-0 right-0 bg-bamboo"
              initial={{ x: '-100%' }}
              animate={{ x: '0%' }}
              transition={{ duration: 1.2, ease: EASE_CUBIC }}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
