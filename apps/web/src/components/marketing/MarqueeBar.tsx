import { getTranslations } from 'next-intl/server';

// Navy strip with italic Fraunces marquee items separated by bamboo dots.
// Static render here — infinite horizontal scroll animation (A5 in §5a)
// lands in the FE-10 animations pass.
export async function MarqueeBar() {
  const t = await getTranslations('home.marquee');

  const items = [
    t('remoteHelp'),
    t('monitoring'),
    t('backup'),
    t('rodo'),
    t('m365'),
    t('cybersec'),
  ];

  return (
    <div className="overflow-hidden border-y border-navy-deep bg-navy py-4 text-white">
      <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-3 px-4 md:px-6">
        {items.map((item, idx) => (
          <span
            key={item}
            className="inline-flex items-center gap-3 font-display text-2xl font-light italic tracking-[-0.02em] md:text-3xl lg:text-4xl"
          >
            <span>{item}</span>
            {idx < items.length - 1 && (
              <span
                aria-hidden="true"
                className="inline-block h-2 w-2 rounded-full bg-bamboo"
              />
            )}
          </span>
        ))}
      </div>
    </div>
  );
}
