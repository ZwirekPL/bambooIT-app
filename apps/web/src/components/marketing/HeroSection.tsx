import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';

function HeroGrid() {
  // Decorative 80px grid with radial mask — purely cosmetic, no JS.
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 opacity-50"
      style={{
        backgroundImage:
          'linear-gradient(var(--line) 1px, transparent 1px), linear-gradient(90deg, var(--line) 1px, transparent 1px)',
        backgroundSize: '80px 80px',
        maskImage: 'radial-gradient(ellipse at 30% 50%, black 30%, transparent 75%)',
        WebkitMaskImage: 'radial-gradient(ellipse at 30% 50%, black 30%, transparent 75%)',
      }}
    />
  );
}

function PandaMascot() {
  // Static geometric panda from mockup — bamboo leaves (green) + faceted head (navy lines).
  // GSAP entrance animations from mockup are deferred to a later enhancement pass.
  return (
    <svg viewBox="0 0 400 400" aria-hidden="true" className="h-auto w-full overflow-visible">
      <g className="fill-bamboo">
        <path d="M50 180 Q40 170 30 175 Q35 185 50 180" />
        <path d="M55 200 Q35 195 25 205 Q40 215 55 200" />
        <path d="M60 220 Q40 220 30 230 Q45 240 60 220" />
      </g>
      <polygon className="fill-navy" points="120,120 145,100 160,135" />
      <polygon className="fill-navy" points="280,120 255,100 240,135" />
      <g
        className="fill-none stroke-navy"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polygon points="160,135 200,115 240,135 270,180 260,240 200,290 140,240 130,180" />
        <line x1="200" y1="115" x2="200" y2="290" />
        <line x1="160" y1="135" x2="200" y2="200" />
        <line x1="240" y1="135" x2="200" y2="200" />
        <line x1="130" y1="180" x2="200" y2="200" />
        <line x1="270" y1="180" x2="200" y2="200" />
        <line x1="140" y1="240" x2="200" y2="200" />
        <line x1="260" y1="240" x2="200" y2="200" />
      </g>
      <polygon className="fill-navy" points="155,175 180,165 185,200 165,210" />
      <polygon className="fill-navy" points="245,175 220,165 215,200 235,210" />
      <circle className="fill-white" cx={172} cy={188} r={4} />
      <circle className="fill-white" cx={228} cy={188} r={4} />
      <polygon className="fill-navy" points="195,225 205,225 200,235" />
      <path
        className="fill-none stroke-navy"
        strokeWidth={2}
        strokeLinecap="round"
        d="M195 245 Q200 252 205 245"
      />
      <g className="fill-bamboo">
        <path d="M350 180 Q360 170 370 175 Q365 185 350 180" />
        <path d="M345 200 Q365 195 375 205 Q360 215 345 200" />
        <path d="M340 220 Q360 220 370 230 Q355 240 340 220" />
      </g>
    </svg>
  );
}

export async function HeroSection() {
  const t = await getTranslations('home.hero');

  return (
    <section className="relative flex min-h-[88vh] flex-col justify-center overflow-hidden bg-paper px-5 pb-16 pt-20 md:px-12 md:pb-20 md:pt-24">
      <HeroGrid />

      {/* Panda mascot — hidden on mobile, dimmed on tablet, full on desktop */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute right-[-15%] top-1/2 z-0 hidden w-[60vw] -translate-y-1/2 opacity-20 md:block lg:right-[-2%] lg:w-[min(46vw,640px)] lg:opacity-100"
      >
        <PandaMascot />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-[1440px]">
        {/* Eyebrow pill with pulsing bamboo dot */}
        <div className="mb-8 inline-flex items-center gap-2.5 rounded-full border border-line-strong bg-white/60 px-4 py-2 font-mono text-xs uppercase tracking-[0.18em] text-navy-soft">
          <span className="relative h-2 w-2 rounded-full bg-bamboo" aria-hidden="true">
            <span className="absolute inset-0 -m-1 animate-ping rounded-full bg-bamboo opacity-40" />
          </span>
          {t('eyebrow')}
        </div>

        {/* 3-line title — italic + bamboo-deep on line 3 */}
        <h1 className="max-w-[14ch] font-display text-5xl font-light leading-[0.92] tracking-[-0.045em] text-navy sm:text-6xl md:text-7xl lg:text-8xl xl:text-[9rem]">
          <span className="block">{t('titleLine1')}</span>
          <span className="block">{t('titleLine2')}</span>
          <span className="block font-semibold italic text-bamboo-deep">{t('titleLine3')}</span>
        </h1>

        {/* Bottom row: lede + pricing card */}
        <div className="mt-12 grid grid-cols-1 items-end gap-8 md:mt-16 md:grid-cols-[1fr_auto] md:gap-12">
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
        </div>
      </div>
    </section>
  );
}
