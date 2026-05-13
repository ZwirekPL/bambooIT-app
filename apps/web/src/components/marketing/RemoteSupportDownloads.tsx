import { getTranslations } from 'next-intl/server';

const ANYDESK_DOWNLOADS = [
  { key: 'windows', href: 'https://download.anydesk.com/AnyDesk.exe' },
  { key: 'mac',     href: 'https://anydesk.com/en/downloads/mac-os' },
  { key: 'linux',   href: 'https://anydesk.com/en/downloads/linux' },
] as const;

const RUSTDESK_URL = 'https://rustdesk.com/';

/**
 * Two download cards: AnyDesk (recommended, mature) + RustDesk
 * (open-source alternative). External links open in a new tab.
 */
export async function RemoteSupportDownloads() {
  const t = await getTranslations('pomocZdalna.downloads');

  return (
    <section className="bg-paper px-5 py-20 md:px-12 md:py-28">
      <div className="mx-auto w-full max-w-[1200px]">
        <h2 className="mb-12 max-w-[24ch] font-display text-3xl font-light leading-[1.05] tracking-[-0.035em] text-navy md:text-4xl lg:text-5xl">
          {t.rich('heading', {
            em: (chunks) => <em className="font-semibold italic text-bamboo-deep">{chunks}</em>,
          })}
        </h2>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-[1.4fr_1fr]">
          {/* AnyDesk — recommended */}
          <article className="relative flex flex-col overflow-hidden rounded-3xl border border-navy-deep bg-navy-deep p-10 text-white">
            <span
              aria-hidden="true"
              className="pointer-events-none absolute -right-[15%] -top-[20%] h-[300px] w-[300px] rounded-full bg-bamboo/20 blur-3xl"
            />
            <div className="relative">
              <span className="font-mono text-[11px] uppercase tracking-[0.15em] text-bamboo">
                {t('anydesk.tag')}
              </span>
              <h3 className="mt-3 font-display text-3xl font-semibold tracking-[-0.02em] md:text-4xl">
                {t('anydesk.title')}
              </h3>
              <p className="mt-3 max-w-[40ch] text-base leading-[1.6] text-white/70">
                {t('anydesk.desc')}
              </p>
            </div>

            <div className="relative mt-8 flex flex-wrap gap-3">
              {ANYDESK_DOWNLOADS.map((dl) => (
                <a
                  key={dl.key}
                  href={dl.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2.5 rounded-full bg-bamboo px-6 py-3 text-sm font-bold text-navy-deep transition-all hover:-translate-y-0.5 hover:bg-white"
                >
                  {t(`anydesk.${dl.key}Btn`)}
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    aria-hidden="true"
                  >
                    <path d="M12 3v14M5 12l7 7 7-7" />
                  </svg>
                </a>
              ))}
            </div>
          </article>

          {/* RustDesk — alternative */}
          <article className="flex flex-col rounded-3xl border border-line bg-white p-10">
            <span className="font-mono text-[11px] uppercase tracking-[0.15em] text-bamboo-deep">
              {t('rustdesk.tag')}
            </span>
            <h3 className="mt-3 font-display text-3xl font-semibold tracking-[-0.02em] text-navy">
              {t('rustdesk.title')}
            </h3>
            <p className="mt-3 max-w-[36ch] text-base leading-[1.6] text-navy-soft">
              {t('rustdesk.desc')}
            </p>
            <a
              href={RUSTDESK_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-auto inline-flex w-fit items-center gap-2.5 rounded-full bg-navy-deep px-6 py-3 text-sm font-bold text-white transition-all hover:-translate-y-0.5 hover:bg-bamboo hover:text-navy-deep"
            >
              {t('rustdesk.btn')}
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                aria-hidden="true"
              >
                <path d="M7 17L17 7M7 7h10v10" />
              </svg>
            </a>
          </article>
        </div>
      </div>
    </section>
  );
}
