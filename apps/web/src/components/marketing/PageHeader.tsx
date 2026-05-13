import type { ReactNode } from 'react';

/**
 * Sub-page header used as the top section on /pakiety, /audyt, /kontakt,
 * /o-nas, /pomoc-zdalna, /branze/*. Provides a consistent "page intro"
 * with eyebrow label + Fraunces heading + lede, clearing the sticky
 * Header with generous top padding.
 */
export function PageHeader({
  eyebrow,
  heading,
  lede,
}: {
  eyebrow?: string;
  heading: ReactNode;
  lede?: ReactNode;
}) {
  return (
    <section className="relative bg-paper px-5 pb-12 pt-32 md:px-12 md:pb-16 md:pt-40 lg:pt-48">
      <div className="mx-auto w-full max-w-[1440px]">
        {eyebrow && (
          <div className="mb-8 flex items-center gap-3.5 font-mono text-xs uppercase tracking-[0.2em] text-bamboo-deep">
            <span aria-hidden="true" className="h-px w-8 bg-bamboo-deep" />
            {eyebrow}
          </div>
        )}
        <h1 className="max-w-[18ch] font-display text-5xl font-light leading-[0.95] tracking-[-0.04em] text-navy md:text-6xl lg:text-7xl xl:text-8xl">
          {heading}
        </h1>
        {lede && (
          <p className="mt-8 max-w-[60ch] text-base leading-[1.6] text-navy-soft md:mt-10 md:text-lg">
            {lede}
          </p>
        )}
      </div>
    </section>
  );
}
