import type { ReactNode } from 'react';

type Variant = 'navy' | 'bamboo' | 'paper';

const variantStyles: Record<Variant, string> = {
  navy: 'bg-navy-deep text-white',
  bamboo: 'bg-bamboo text-navy-deep',
  paper: 'bg-paper text-navy',
};

/**
 * Full-bleed storytelling section with one italic Fraunces sentence centered.
 * Reused 4× on the homepage between content sections to set rhythm.
 *
 * Static render here: 60vh min-height, plain centered text. The mockup's
 * pinned-scroll word-by-word reveal (A6 in §5a) lands in FE-10 — at that
 * point min-height jumps to 100vh and words animate in/out scrubbed by
 * ScrollTrigger.
 */
export function NarrativeSection({
  children,
  variant = 'navy',
}: {
  children: ReactNode;
  variant?: Variant;
}) {
  return (
    <section
      className={`relative flex min-h-[60vh] items-center justify-center overflow-hidden px-5 py-20 md:px-12 md:py-28 ${variantStyles[variant]}`}
    >
      <p className="max-w-[18ch] text-center font-display text-4xl font-light italic leading-[1] tracking-[-0.04em] md:text-5xl lg:text-6xl xl:text-7xl">
        {children}
      </p>
    </section>
  );
}
