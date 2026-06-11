'use client';

import { useRef, type ReactNode } from 'react';
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
  type MotionValue,
} from 'framer-motion';

type Variant = 'navy' | 'bamboo' | 'paper';

const variantStyles: Record<Variant, string> = {
  navy: 'bg-navy-deep text-white',
  bamboo: 'bg-bamboo text-navy-deep',
  paper: 'bg-paper text-navy',
};

/**
 * A6 — Pinned-scroll word reveal.
 *
 * Outer section is 170vh tall to give scroll room. Inner content is
 * position: sticky top:0 height:100vh, so it stays pinned while the
 * scroll progress 0→1 plays out across the second viewport-worth of
 * scroll. Each word animates in / holds / animates out as mockup did.
 * The hold window is deliberately wide (40% of scroll) so the phrase
 * stays fully legible long enough to actually read it:
 *   - progress 0..0.3: words fade in + slide up from y:40 (staggered
 *     by word index via wp * 0.4 offset)
 *   - progress 0.3..0.7: hold at opacity:1 y:0
 *   - progress 0.7..1: fade out + slide up to y:-40
 *
 * prefers-reduced-motion: words render static at rest, section height
 * collapses to 60vh so the user doesn't have to scroll-trap through
 * 2x viewport for no animation gain.
 */
type Props = {
  children: ReactNode;
  variant?: Variant;
};

export function NarrativeSection({ children, variant = 'navy' }: Props) {
  const ref = useRef<HTMLElement>(null);
  const shouldReduceMotion = useReducedMotion();

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start start', 'end end'],
  });

  // Coerce children to string. The 4 known call sites pass t('key') which
  // is always string; this guard just keeps the API loose at the type
  // boundary without crashing on ReactNode mid-tree.
  const text = typeof children === 'string' ? children : '';
  const words = text.split(/\s+/).filter(Boolean);

  if (shouldReduceMotion) {
    return (
      <section
        ref={ref}
        className={`relative flex min-h-[60vh] items-center justify-center overflow-hidden px-5 py-20 md:px-12 md:py-28 ${variantStyles[variant]}`}
      >
        <p className="max-w-[18ch] text-center font-display text-4xl font-light italic leading-[1] tracking-[-0.04em] md:text-5xl lg:text-6xl xl:text-7xl">
          {text}
        </p>
      </section>
    );
  }

  return (
    <section
      ref={ref}
      className={`relative h-[170vh] ${variantStyles[variant]}`}
    >
      <div className="sticky top-0 flex h-screen items-center justify-center overflow-hidden px-5 md:px-12">
        <p className="max-w-[18ch] text-center font-display text-4xl font-light italic leading-[1] tracking-[-0.04em] md:text-5xl lg:text-6xl xl:text-7xl">
          {words.map((word, idx) => (
            <Word
              key={idx}
              text={word}
              progress={scrollYProgress}
              index={idx}
              totalWords={words.length}
            />
          ))}
        </p>
      </div>
    </section>
  );
}

function Word({
  text,
  progress,
  index,
  totalWords,
}: {
  text: string;
  progress: MotionValue<number>;
  index: number;
  totalWords: number;
}) {
  // Per-word offset wp: later words start visible slightly later.
  // Identical algorithm to mockup's onUpdate handler.
  const opacity = useTransform(progress, (p) => {
    const wp = index / totalWords;
    if (p < 0.3) {
      const local = Math.max(0, p / 0.3 - wp * 0.4);
      return Math.min(1, local * 2);
    }
    if (p < 0.7) return 1;
    const local = (p - 0.7) / 0.3;
    return Math.max(0, 1 - local * 2);
  });

  const y = useTransform(progress, (p) => {
    const wp = index / totalWords;
    if (p < 0.3) {
      const local = Math.max(0, p / 0.3 - wp * 0.4);
      const op = Math.min(1, local * 2);
      return (1 - op) * 40;
    }
    if (p < 0.7) return 0;
    const local = (p - 0.7) / 0.3;
    const op = Math.max(0, 1 - local * 2);
    return (1 - op) * -40;
  });

  return (
    <motion.span
      style={{ opacity, y }}
      className="mr-[0.25em] inline-block"
    >
      {text}
    </motion.span>
  );
}
