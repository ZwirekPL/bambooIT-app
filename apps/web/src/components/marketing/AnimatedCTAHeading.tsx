'use client';

import { motion, useReducedMotion } from 'framer-motion';

/**
 * A14 — Word-by-word stagger entrance for the final CTA H2.
 * Splits `plain` + `em` into individual words and animates each one
 * from y:80 opacity:0 → y:0 opacity:1 with 0.06s stagger.
 * `em` words render italic font-semibold text-bamboo.
 * prefers-reduced-motion: skips motion, renders immediately at rest.
 */
type Props = {
  plain: string;
  em: string;
};

const ITEM_VARIANTS = {
  hidden: { y: 80, opacity: 0 },
  visible: { y: 0, opacity: 1 },
};

const REDUCED_VARIANTS = {
  hidden: { y: 0, opacity: 1 },
  visible: { y: 0, opacity: 1 },
};

export function AnimatedCTAHeading({ plain, em }: Props) {
  const shouldReduceMotion = useReducedMotion();
  const variants = shouldReduceMotion ? REDUCED_VARIANTS : ITEM_VARIANTS;
  const plainWords = plain.split(/\s+/).filter(Boolean);
  const emWords = em.split(/\s+/).filter(Boolean);

  return (
    <motion.h2
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.3 }}
      transition={{ staggerChildren: shouldReduceMotion ? 0 : 0.06 }}
      className="max-w-[14ch] font-display text-5xl font-light leading-[0.95] tracking-[-0.04em] text-white md:text-7xl lg:text-8xl xl:text-9xl"
    >
      {plainWords.map((word, idx) => (
        <span key={`p-${idx}`} className="mr-[0.25em] inline-block overflow-hidden">
          <motion.span
            variants={variants}
            transition={{ duration: 1, ease: [0, 0, 0.2, 1] }}
            className="inline-block"
          >
            {word}
          </motion.span>
        </span>
      ))}
      {emWords.map((word, idx) => (
        <span key={`e-${idx}`} className="mr-[0.25em] inline-block overflow-hidden">
          <motion.span
            variants={variants}
            transition={{ duration: 1, ease: [0, 0, 0.2, 1] }}
            className="inline-block font-semibold italic text-bamboo"
          >
            {word}
          </motion.span>
        </span>
      ))}
    </motion.h2>
  );
}
