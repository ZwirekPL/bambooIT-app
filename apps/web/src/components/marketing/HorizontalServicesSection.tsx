'use client';

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import {
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useTransform,
} from 'framer-motion';
import { useTranslations } from 'next-intl';

const CARD_IDS = ['1', '2', '3', '4', '5', '6'] as const;

// How much faster the cards move than the finger/cursor while dragging.
// 1 = 1:1 with the pointer; higher = a small drag travels further.
const DRAG_SPEED = 35;

/**
 * A9 — Horizontal pinned-scroll services section, with drag support.
 *
 * Outer container is 300vh tall; inner content is sticky top:0 h-screen and
 * pins to the viewport while the user scrolls through the outer container.
 * The horizontal track translates left (x: 0 → -trackOffset) driven by
 * scrollYProgress — so the section still works on plain vertical scroll /
 * mouse wheel exactly as before.
 *
 * ON TOP of that, the pinned area is grab-draggable: a horizontal drag
 * (mouse or finger) is converted into an equivalent `window.scrollBy`, which
 * feeds the SAME scrollYProgress → there's a single source of truth, so
 * scroll and drag never fight. `touch-action: pan-y` keeps native vertical
 * swipe-to-scroll working on touch; horizontal swipes become our drag.
 *
 * prefers-reduced-motion: outer height collapses, sticky + drag drop, cards
 * render as a normal grid (1/2/3 cols).
 */
export function HorizontalServicesSection() {
  const t = useTranslations('home.horizontalServices');
  const shouldReduceMotion = useReducedMotion();
  const outerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [trackOffset, setTrackOffset] = useState(0);
  const [activeIdx, setActiveIdx] = useState(0);

  // Drag-to-scroll state (mouse + touch). We translate horizontal pointer
  // movement into vertical scroll so the existing scroll choreography drives
  // the cards — no second source of truth.
  const drag = useRef({ active: false, lastX: 0 });
  const offsetRef = useRef(0);
  useEffect(() => {
    offsetRef.current = trackOffset;
  }, [trackOffset]);

  useEffect(() => {
    function measure() {
      if (!trackRef.current) return;
      const trackWidth = trackRef.current.scrollWidth;
      const viewportWidth = window.innerWidth;
      // Translate so the last card's right edge lands at the right of viewport
      // with a 48px breathing room.
      setTrackOffset(Math.max(0, trackWidth - viewportWidth + 48));
    }
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  const { scrollYProgress } = useScroll({
    target: outerRef,
    offset: ['start start', 'end end'],
  });

  const x = useTransform(scrollYProgress, [0, 1], [0, -trackOffset]);
  const progressBarWidth = useTransform(scrollYProgress, [0, 1], ['0%', '100%']);

  useMotionValueEvent(scrollYProgress, 'change', (p) => {
    if (shouldReduceMotion) return;
    setActiveIdx(Math.min(CARD_IDS.length - 1, Math.floor(p * CARD_IDS.length)));
  });

  function handlePointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    drag.current = { active: true, lastX: e.clientX };
    // Capture the mouse so the drag keeps tracking if the cursor leaves the
    // cards; on touch we skip capture so `pan-y` vertical scroll still works.
    if (e.pointerType === 'mouse') {
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* capture unsupported — drag still works while over the element */
      }
    }
  }

  function handlePointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (!drag.current.active) return;
    const dx = e.clientX - drag.current.lastX;
    if (dx === 0) return;
    drag.current.lastX = e.clientX;
    const offset = offsetRef.current;
    if (offset <= 0) return;
    // Scroll range over which progress goes 0→1 = outer(300vh) - sticky(100vh)
    // = 200vh. Map a horizontal drag of `dx` px to the equivalent scroll,
    // amplified by DRAG_SPEED so a short drag travels several cards.
    const scrollRange = 2 * window.innerHeight;
    const factor = (scrollRange / offset) * DRAG_SPEED;
    window.scrollBy(0, -dx * factor);
  }

  function endDrag(e: ReactPointerEvent<HTMLDivElement>) {
    drag.current.active = false;
    if (e.pointerType === 'mouse') {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    }
  }

  const cards = CARD_IDS.map((id) => ({
    number: t(`cards.${id}.number`),
    title: t(`cards.${id}.title`),
    desc: t(`cards.${id}.desc`),
    features: [
      t(`cards.${id}.features.1`),
      t(`cards.${id}.features.2`),
      t(`cards.${id}.features.3`),
    ],
  }));

  return (
    <section
      id="services"
      // No `overflow-hidden` here: it would create a CSS scroll container,
      // which makes the inner `position: sticky` element pin to this section
      // instead of the window — breaking the pinned horizontal scroll.
      // Horizontal clipping is handled by the sticky inner (line below).
      className="relative bg-navy-deep text-white"
    >
      {/* Intro — scrolls normally */}
      <div className="mx-auto w-full max-w-[1440px] px-5 py-24 md:px-12 md:py-32">
        <div className="max-w-3xl">
          <div className="mb-8 flex items-center gap-3.5 font-mono text-xs uppercase tracking-[0.2em] text-bamboo">
            <span aria-hidden="true" className="h-px w-8 bg-bamboo" />
            {t('intro.label')}
          </div>
          <h2 className="font-display text-4xl font-light leading-none tracking-[-0.035em] text-white md:text-5xl lg:text-6xl xl:text-7xl">
            {t.rich('intro.heading', {
              br: () => <br />,
              em: (chunks) => <em className="font-semibold italic text-bamboo">{chunks}</em>,
            })}
          </h2>
          <p className="mt-8 max-w-[50ch] text-base leading-[1.6] text-white/70 md:text-lg">
            {t('intro.lede')}
          </p>
        </div>
      </div>

      {/* Pinned horizontal scroll (+ drag) OR fallback grid */}
      {shouldReduceMotion ? (
        <div className="mx-auto w-full max-w-[1440px] px-5 pb-24 md:px-12 md:pb-32">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {cards.map((card) => (
              <ServiceCard key={card.title} card={card} active={true} />
            ))}
          </div>
        </div>
      ) : (
        <div ref={outerRef} className="relative h-[300vh]">
          {/* justify-center: vertically center the cards row in the sticky
              viewport. The pinned area is grab-draggable (drag → scroll). */}
          <div
            className="sticky top-0 flex h-screen cursor-grab flex-col justify-center overflow-hidden pb-16 active:cursor-grabbing"
            style={{ touchAction: 'pan-y' }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
          >
            <motion.div
              ref={trackRef}
              style={{ x }}
              className="flex shrink-0 select-none items-center gap-8 px-12 will-change-transform"
            >
              {cards.map((card, idx) => (
                <div
                  key={card.title}
                  className="shrink-0"
                  style={{ width: 'min(72vw, 560px)' }}
                >
                  <ServiceCard card={card} active={idx === activeIdx} />
                </div>
              ))}
            </motion.div>

            {/* Progress bar + drag hint + counter */}
            <div className="pointer-events-none absolute bottom-12 left-12 right-12 z-10">
              <div className="relative h-px bg-white/10">
                <motion.div
                  className="absolute inset-y-0 left-0 bg-bamboo"
                  style={{ width: progressBarWidth }}
                />
              </div>
              <div className="mt-4 flex items-center justify-between font-mono text-[11px] uppercase tracking-[0.2em] text-white/50">
                <span className="inline-flex items-center gap-2">
                  <svg width="22" height="12" viewBox="0 0 22 12" fill="none" aria-hidden="true">
                    <path d="M5 1L1 6l4 5M17 1l4 5-4 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {t('intro.dragHint')}
                </span>
                <span>
                  <span className="font-bold text-bamboo">
                    {String(activeIdx + 1).padStart(2, '0')}
                  </span>{' '}
                  / {String(CARD_IDS.length).padStart(2, '0')}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

type ServiceCardData = {
  number: string;
  title: string;
  desc: string;
  features: string[];
};

function ServiceCard({
  card,
  active,
}: {
  card: ServiceCardData;
  active: boolean;
}) {
  return (
    <article
      className={`relative flex h-[72vh] max-h-[600px] flex-col overflow-hidden rounded-3xl border bg-navy p-12 transition-all duration-500 ${
        active
          ? 'scale-100 border-bamboo opacity-100 shadow-[0_30px_80px_-20px_rgba(139,195,74,0.3)]'
          : 'scale-[0.85] border-white/10 opacity-40'
      }`}
    >
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute -right-[30%] -top-[30%] h-[60%] w-[60%] rounded-full bg-bamboo/15 blur-3xl transition-all duration-500 ${
          active ? 'scale-[1.3] opacity-30' : 'opacity-10'
        }`}
      />
      <div className="relative">
        <span className="font-mono text-[13px] tracking-[0.15em] text-bamboo">
          {card.number}
        </span>
        <h3 className="mt-5 font-display text-2xl font-normal leading-[1.05] tracking-[-0.025em] text-white md:text-3xl lg:text-4xl">
          {card.title}
        </h3>
        <p className="mt-5 max-w-[34ch] text-base leading-[1.6] text-white/65">
          {card.desc}
        </p>
      </div>
      <ul className="relative mt-auto flex flex-col gap-2.5 border-t border-white/10 pt-7">
        {card.features.map((feature) => (
          <li key={feature} className="flex items-center gap-3 text-sm text-white/85">
            <span
              aria-hidden="true"
              className="h-1.5 w-1.5 shrink-0 rounded-full bg-bamboo"
            />
            {feature}
          </li>
        ))}
      </ul>
    </article>
  );
}
