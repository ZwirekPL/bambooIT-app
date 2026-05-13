'use client';

import { useEffect, useRef } from 'react';
import {
  animate,
  motion,
  useInView,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from 'framer-motion';

/**
 * A8 — Counter that animates from 0 to `target` over 1.8s when the row
 * enters the viewport. Used by <ManifestoSection /> for the three stats
 * (98%, 15 min, 40+). prefers-reduced-motion skips the count and renders
 * the target value immediately.
 */
type Props = {
  /** Final integer target (parsed from a string like "98", "15", "40"). */
  value: string;
  /** Suffix rendered in bamboo-deep after the number — "%", " min", "+". */
  suffix: string;
  /** Caption below the number. */
  label: string;
};

export function AnimatedStat({ value, suffix, label }: Props) {
  const target = parseInt(value, 10);
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.5 });
  const shouldReduceMotion = useReducedMotion();

  const motionValue = useMotionValue(shouldReduceMotion ? target : 0);
  const display = useTransform(motionValue, (v) => Math.floor(v).toString());

  useEffect(() => {
    if (inView && !shouldReduceMotion) {
      const controls = animate(motionValue, target, {
        duration: 1.8,
        ease: 'easeOut',
      });
      return () => controls.stop();
    }
  }, [inView, shouldReduceMotion, motionValue, target]);

  return (
    <li className="border-t border-line-strong pt-5">
      <div
        ref={ref}
        className="flex items-baseline font-display text-5xl font-semibold leading-none tracking-[-0.04em] text-navy md:text-6xl lg:text-7xl xl:text-[6.75rem]"
      >
        <motion.span>{display}</motion.span>
        <span className="text-bamboo-deep">{suffix}</span>
      </div>
      <p className="mt-2 max-w-[28ch] text-sm leading-[1.4] text-navy-soft">
        {label}
      </p>
    </li>
  );
}
