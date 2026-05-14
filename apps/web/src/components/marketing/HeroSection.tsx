'use client';

import { useEffect, useRef, useState } from 'react';
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
  type Variants,
} from 'framer-motion';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { LOADER_DURATION_MS, LOADER_FADE_MS } from '@/components/layout/BambooLoader';

/**
 * Hero choreography (A2 + A3 + A4 from §5a):
 *
 * A2 — Eyebrow fade + 3-line title with char-by-char stagger entrance.
 *      yPercent 110 → 0, opacity 0 → 1, rotate 8 → 0, stagger 0.025s.
 *      heroBottom (lede + pricing card) fades up after title.
 *
 * A3 — Panda SVG entrance.
 *      Lines: pathLength 0 → 1 over 1.6s, stagger 0.04s.
 *      Fills: opacity 0 → 1, stagger 0.03s.
 *      Eyes: opacity 0 → 1, stagger 0.1s.
 *      Leaves: opacity + scale 0 → 1, back ease, random stagger.
 *
 * A4 — Scroll parallax on panda + grid + title (yPercent shifts).
 *
 * prefers-reduced-motion: all initial states flatten to final values,
 * staggers go to 0, parallax disabled.
 */

const CHAR_STAGGER = 0.025;
const TITLE_DURATION = 1;

const CHAR_VARIANTS: Variants = {
  hidden: { y: '110%', opacity: 0, rotate: 8 },
  visible: { y: '0%', opacity: 1, rotate: 0 },
};

const REDUCED_CHAR_VARIANTS: Variants = {
  hidden: { y: '0%', opacity: 1, rotate: 0 },
  visible: { y: '0%', opacity: 1, rotate: 0 },
};

function HeroGrid({ yShift }: { yShift?: ReturnType<typeof useTransform<number, string>> }) {
  // Decorative 80px grid with radial mask — same as before, parallax adds.
  return (
    <motion.div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 opacity-50"
      style={{
        backgroundImage:
          'linear-gradient(var(--line) 1px, transparent 1px), linear-gradient(90deg, var(--line) 1px, transparent 1px)',
        backgroundSize: '80px 80px',
        maskImage: 'radial-gradient(ellipse at 30% 50%, black 30%, transparent 75%)',
        WebkitMaskImage: 'radial-gradient(ellipse at 30% 50%, black 30%, transparent 75%)',
        y: yShift,
      }}
    />
  );
}

function PandaMascot() {
  // A3 — entrance choreography. Each path/polygon is a motion element so it
  // can independently animate (lines draw, fills fade, leaves scale).
  return (
    <motion.svg
      viewBox="0 0 400 400"
      aria-hidden="true"
      className="h-auto w-full overflow-visible"
      initial="hidden"
      animate="visible"
      transition={{ delayChildren: 0.4 }}
    >
      {/* Bamboo leaves left — scale-in with back ease, random stagger */}
      <g>
        {[
          'M50 180 Q40 170 30 175 Q35 185 50 180',
          'M55 200 Q35 195 25 205 Q40 215 55 200',
          'M60 220 Q40 220 30 230 Q45 240 60 220',
        ].map((d, idx) => (
          <motion.path
            key={`leaf-l-${idx}`}
            d={d}
            className="fill-bamboo"
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{
              duration: 0.6,
              delay: 1.4 + Math.random() * 0.3,
              ease: [0.34, 1.56, 0.64, 1],
            }}
            style={{ transformOrigin: 'center' }}
          />
        ))}
      </g>

      {/* Ears (filled navy) */}
      <motion.polygon
        className="fill-navy"
        points="120,120 145,100 160,135"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 1.3 }}
      />
      <motion.polygon
        className="fill-navy"
        points="280,120 255,100 240,135"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 1.33 }}
      />

      {/* Head outline + facets — pathLength draw (path elements are the most
          reliable framer-motion target for pathLength animation). */}
      <motion.path
        d="M160 135 L200 115 L240 135 L270 180 L260 240 L200 290 L140 240 L130 180 Z"
        fill="none"
        className="stroke-navy"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1.6, delay: 0.7, ease: [0.4, 0, 0.2, 1] }}
      />

      {[
        'M200 115 L200 290',
        'M160 135 L200 200',
        'M240 135 L200 200',
        'M130 180 L200 200',
        'M270 180 L200 200',
        'M140 240 L200 200',
        'M260 240 L200 200',
      ].map((d, idx) => (
        <motion.path
          key={`facet-${idx}`}
          d={d}
          fill="none"
          className="stroke-navy"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{
            duration: 1.6,
            delay: 0.7 + idx * 0.04,
            ease: [0.4, 0, 0.2, 1],
          }}
        />
      ))}

      {/* Eye patches */}
      <motion.polygon
        className="fill-navy"
        points="155,175 180,165 185,200 165,210"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 1.36 }}
      />
      <motion.polygon
        className="fill-navy"
        points="245,175 220,165 215,200 235,210"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 1.39 }}
      />

      {/* Eyes (white dots) */}
      <motion.circle
        className="fill-white"
        cx={172}
        cy={188}
        r={4}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 1.7 }}
      />
      <motion.circle
        className="fill-white"
        cx={228}
        cy={188}
        r={4}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 1.8 }}
      />

      {/* Nose */}
      <motion.polygon
        className="fill-navy"
        points="195,225 205,225 200,235"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 1.42 }}
      />

      {/* Mouth */}
      <motion.path
        d="M195 245 Q200 252 205 245"
        fill="none"
        className="stroke-navy"
        strokeWidth={2}
        strokeLinecap="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.8, delay: 1.9, ease: [0.4, 0, 0.2, 1] }}
      />

      {/* Bamboo leaves right */}
      <g>
        {[
          'M350 180 Q360 170 370 175 Q365 185 350 180',
          'M345 200 Q365 195 375 205 Q360 215 345 200',
          'M340 220 Q360 220 370 230 Q355 240 340 220',
        ].map((d, idx) => (
          <motion.path
            key={`leaf-r-${idx}`}
            d={d}
            className="fill-bamboo"
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{
              duration: 0.6,
              delay: 1.4 + Math.random() * 0.3,
              ease: [0.34, 1.56, 0.64, 1],
            }}
            style={{ transformOrigin: 'center' }}
          />
        ))}
      </g>
    </motion.svg>
  );
}

function SplitChars({
  text,
  italic = false,
  reducedMotion,
}: {
  text: string;
  italic?: boolean;
  reducedMotion: boolean;
}) {
  const variants = reducedMotion ? REDUCED_CHAR_VARIANTS : CHAR_VARIANTS;
  const className = italic ? 'block font-semibold italic text-bamboo-deep' : 'block';

  return (
    <span className={className}>
      {Array.from(text).map((char, idx) => (
        // Padding + matching negative margin on all four sides:
        //   - bottom: room for Polish descenders (j, ł, ą, ę) without clip
        //   - left/right: room for italic Fraunces side bearings on j, k, r
        //   - matching negative margins keep the laid-out width/height the
        //     same so letter spacing and line-height (leading-[0.92]) stay
        //     tight per design. The wrapper still clips the entrance mask
        //     (motion.span y: 110% → 0%) because the clipped axis is the
        //     vertical motion direction, and bottom is anchored at 0 of the
        //     padding-extended bbox.
        <span
          key={idx}
          className="inline-block overflow-hidden"
          style={{
            paddingBottom: '0.35em',
            marginBottom: '-0.35em',
            paddingLeft: '0.18em',
            paddingRight: '0.18em',
            marginLeft: '-0.18em',
            marginRight: '-0.18em',
          }}
        >
          <motion.span
            variants={variants}
            transition={{ duration: TITLE_DURATION, ease: [0.2, 0, 0.2, 1] }}
            className="inline-block"
            style={{ paddingRight: char === ' ' ? '0.15em' : undefined }}
          >
            {char === ' ' ? ' ' : char}
          </motion.span>
        </span>
      ))}
    </span>
  );
}

export function HeroSection() {
  const t = useTranslations('home.hero');
  const shouldReduceMotion = useReducedMotion();
  const ref = useRef<HTMLElement>(null);

  // Defer panda mount until BambooLoader has faded out — otherwise the
  // ~2.7s draw choreography (A3) plays out entirely behind the loader
  // overlay and the user only sees the finished panda. 200ms buffer.
  const [pandaMounted, setPandaMounted] = useState(false);
  useEffect(() => {
    if (shouldReduceMotion) {
      setPandaMounted(true);
      return;
    }
    const timer = setTimeout(
      () => setPandaMounted(true),
      LOADER_DURATION_MS + LOADER_FADE_MS - 200,
    );
    return () => clearTimeout(timer);
  }, [shouldReduceMotion]);

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start start', 'end start'],
  });

  // A4 parallax — disabled if reduced motion
  const pandaY = useTransform(scrollYProgress, [0, 1], ['0%', '30%']);
  const gridY = useTransform(scrollYProgress, [0, 1], ['0%', '-20%']);
  const titleY = useTransform(scrollYProgress, [0, 1], ['0%', '-15%']);
  const titleOpacity = useTransform(scrollYProgress, [0, 1], [1, 0.3]);

  return (
    <section
      ref={ref}
      // min-h-screen guarantees the pricing card in the bottom row sits within
      // the viewport on 1080p; trimmed vertical padding leaves room for the
      // mascot above the bottom row without overlap.
      className="relative flex min-h-screen flex-col justify-center overflow-hidden bg-paper px-5 pb-10 pt-20 md:px-12 md:pb-14 md:pt-24"
    >
      <HeroGrid yShift={shouldReduceMotion ? undefined : gridY} />

      {/* Panda mascot — hidden on mobile, dimmed on tablet, full on desktop.
          Mount is deferred until after BambooLoader finishes so the draw
          choreography (A3, ~2.7s total) doesn't play out under the loader
          overlay. */}
      <motion.div
        aria-hidden="true"
        // top-[18%]: panda anchored to the upper portion of the hero so it
        // sits clearly above the pricing card in the bottom row, with the
        // mascot's upper half tucking close to the hero's top edge.
        className="pointer-events-none absolute right-[-15%] top-[18%] z-0 hidden w-[50vw] -translate-y-1/2 opacity-20 md:block lg:right-[-2%] lg:w-[min(40vw,560px)] lg:opacity-100"
        style={shouldReduceMotion ? undefined : { y: pandaY }}
      >
        {pandaMounted && <PandaMascot />}
      </motion.div>

      <motion.div
        className="relative z-10 mx-auto w-full max-w-[1440px]"
        style={shouldReduceMotion ? undefined : { y: titleY, opacity: titleOpacity }}
      >
        {/* Eyebrow pill */}
        <motion.div
          className="mb-8 inline-flex items-center gap-2.5 rounded-full border border-line-strong bg-white/60 px-4 py-2 font-mono text-xs uppercase tracking-[0.18em] text-navy-soft"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3, ease: 'easeOut' }}
        >
          <span className="relative h-2 w-2 rounded-full bg-bamboo" aria-hidden="true">
            <span className="absolute inset-0 -m-1 animate-ping rounded-full bg-bamboo opacity-40" />
          </span>
          {t('eyebrow')}
        </motion.div>

        {/* 3-line title with char-by-char stagger */}
        <motion.h1
          className="max-w-[14ch] font-display text-5xl font-light leading-[0.92] tracking-[-0.045em] text-navy sm:text-6xl md:text-7xl lg:text-[6.5rem] xl:text-[8rem]"
          initial="hidden"
          animate="visible"
          transition={{
            staggerChildren: shouldReduceMotion ? 0 : CHAR_STAGGER,
            delayChildren: 0.5,
          }}
        >
          <SplitChars text={t('titleLine1')} reducedMotion={shouldReduceMotion ?? false} />
          <SplitChars text={t('titleLine2')} reducedMotion={shouldReduceMotion ?? false} />
          <SplitChars text={t('titleLine3')} italic reducedMotion={shouldReduceMotion ?? false} />
        </motion.h1>

        {/* Bottom row: lede + pricing card — fades up after title */}
        <motion.div
          className="mt-8 grid grid-cols-1 items-end gap-8 md:mt-10 md:grid-cols-[1fr_auto] md:gap-12"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 2.1, ease: 'easeOut' }}
        >
          <p className="max-w-[42ch] text-base leading-[1.55] text-navy-soft md:text-lg">
            {t.rich('lede', {
              strong: (chunks) => <strong className="font-bold text-navy">{chunks}</strong>,
            })}
          </p>

          <Link
            href="/pakiety"
            className="group relative block min-w-[300px] overflow-hidden rounded-2xl bg-navy-deep px-8 py-7 text-white transition-transform hover:-translate-y-0.5"
          >
            <span
              aria-hidden="true"
              className="pointer-events-none absolute -right-[20%] -top-1/2 h-[200px] w-[200px] rounded-full bg-bamboo/25 blur-2xl"
            />
            <span className="relative block font-mono text-[11px] uppercase tracking-[0.2em] text-white/60">
              {t('priceLabel')}
            </span>
            <span className="relative mt-3 block font-display text-5xl font-semibold leading-none tracking-[-0.03em]">
              {t('priceValue')}
              <span className="ml-1 text-lg font-normal opacity-70">{t('priceUnit')}</span>
            </span>
            <span className="relative mt-2 block text-sm text-white/75">{t('priceDesc')}</span>
            <span className="relative mt-5 inline-flex items-center gap-2 border-b border-bamboo pb-0.5 text-sm font-semibold text-bamboo">
              {t('priceCta')}
            </span>
          </Link>
        </motion.div>
      </motion.div>
    </section>
  );
}
