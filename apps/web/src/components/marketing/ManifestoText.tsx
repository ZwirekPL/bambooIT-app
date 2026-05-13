'use client';

import { useMemo, useRef } from 'react';
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
  type MotionValue,
} from 'framer-motion';

/**
 * A7 — Manifesto char-by-char color reveal.
 *
 * Input is raw i18n string with embedded <em>…</em> tags (e.g.
 * "Wierzymy, że IT w małej firmie powinno być <em>niewidoczne</em>…").
 * Parsed into a flat char list where each char remembers whether it
 * sits inside an em segment. As the user scrolls past the manifesto,
 * chars reveal in sequence — non-em chars line-strong → navy, em chars
 * line-strong → bamboo-deep — both italic + semibold for em.
 *
 * prefers-reduced-motion: chars render at rest immediately with final
 * colors and no scroll dependency.
 */
const COLOR_DORMANT = 'rgba(44,62,80,0.25)'; // line-strong
const COLOR_REVEALED_NAVY = '#1A2735';        // navy-deep
const COLOR_REVEALED_BAMBOO = '#6FA336';      // bamboo-deep

type Props = {
  /** Raw i18n string with <em>…</em> markers. */
  raw: string;
};

interface CharInfo {
  char: string;
  em: boolean;
  idx: number;
}

function parseChars(raw: string): CharInfo[] {
  const tokens = raw.split(/(<em>[^<]+<\/em>)/g);
  const out: CharInfo[] = [];
  for (const token of tokens) {
    const emMatch = token.match(/^<em>([^<]+)<\/em>$/);
    if (emMatch) {
      for (const ch of Array.from(emMatch[1])) {
        out.push({ char: ch, em: true, idx: out.length });
      }
    } else if (token.length > 0) {
      for (const ch of Array.from(token)) {
        out.push({ char: ch, em: false, idx: out.length });
      }
    }
  }
  return out;
}

export function ManifestoText({ raw }: Props) {
  const ref = useRef<HTMLParagraphElement>(null);
  const shouldReduceMotion = useReducedMotion();

  const chars = useMemo(() => parseChars(raw), [raw]);

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start 80%', 'end 40%'],
  });

  if (shouldReduceMotion) {
    return (
      <p
        ref={ref}
        className="font-display text-3xl font-light leading-[1.15] tracking-[-0.025em] text-navy md:text-4xl lg:text-5xl xl:text-[3.5rem]"
      >
        {chars.map(({ char, em, idx }) =>
          em ? (
            <em key={idx} className="font-semibold italic text-bamboo-deep">
              {char}
            </em>
          ) : (
            <span key={idx}>{char}</span>
          ),
        )}
      </p>
    );
  }

  return (
    <p
      ref={ref}
      className="font-display text-3xl font-light leading-[1.15] tracking-[-0.025em] md:text-4xl lg:text-5xl xl:text-[3.5rem]"
    >
      {chars.map(({ char, em, idx }) => (
        <CharSpan
          key={idx}
          char={char}
          em={em}
          idx={idx}
          total={chars.length}
          progress={scrollYProgress}
        />
      ))}
    </p>
  );
}

function CharSpan({
  char,
  em,
  idx,
  total,
  progress,
}: {
  char: string;
  em: boolean;
  idx: number;
  total: number;
  progress: MotionValue<number>;
}) {
  // Char "reveal threshold": once scroll progress exceeds idx/total,
  // char flips from dormant grey to its target color (navy / bamboo).
  const charThreshold = idx / total;

  const color = useTransform(progress, (p) => {
    if (p < charThreshold) return COLOR_DORMANT;
    return em ? COLOR_REVEALED_BAMBOO : COLOR_REVEALED_NAVY;
  });

  if (em) {
    return (
      <motion.em
        style={{ color }}
        className="font-semibold italic"
      >
        {char}
      </motion.em>
    );
  }

  return <motion.span style={{ color }}>{char}</motion.span>;
}
