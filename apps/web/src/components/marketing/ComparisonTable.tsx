import { getTranslations } from 'next-intl/server';

const FEATURE_KEYS = [
  'hours',
  'remoteHelp',
  'responseTime',
  'monitoring',
  'backup',
  'onsiteVisits',
  'newWorkstations',
  'cyberAudit',
  'm365',
  'managedBackup',
  'contract',
] as const;

type TierKey = 'start' | 'firma' | 'firmaPlus';

const TIER_KEYS: TierKey[] = ['start', 'firma', 'firmaPlus'];

export async function ComparisonTable() {
  const t = await getTranslations('pakiety.comparison');

  return (
    <section className="bg-paper px-5 py-20 md:px-12 md:py-28">
      <div className="mx-auto w-full max-w-[1200px]">
        <h2 className="mb-10 font-display text-3xl font-light leading-none tracking-[-0.035em] text-navy md:text-4xl lg:text-5xl">
          {t('heading')}
        </h2>

        <div className="overflow-x-auto rounded-2xl border border-line bg-white">
          <table className="w-full min-w-[640px] border-collapse text-left">
            <thead>
              <tr className="border-b border-line bg-paper">
                <th className="px-6 py-5 font-mono text-[11px] uppercase tracking-[0.15em] text-navy-soft">
                  {t('headers.feature')}
                </th>
                {TIER_KEYS.map((tier) => (
                  <th
                    key={tier}
                    className={
                      tier === 'firma'
                        ? 'px-6 py-5 text-center font-display text-xl font-semibold text-bamboo-deep'
                        : 'px-6 py-5 text-center font-display text-xl font-semibold text-navy'
                    }
                  >
                    {t(`headers.${tier}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {FEATURE_KEYS.map((feature, idx) => (
                <tr
                  key={feature}
                  className={
                    idx < FEATURE_KEYS.length - 1
                      ? 'border-b border-line/60'
                      : ''
                  }
                >
                  <td className="px-6 py-4 text-sm font-medium text-navy">
                    {t(`rows.${feature}.label`)}
                  </td>
                  {TIER_KEYS.map((tier) => {
                    const value = t(`rows.${feature}.${tier}`);
                    const isCheck = value === '✓';
                    const isDash = value === '—';
                    return (
                      <td
                        key={tier}
                        className={
                          tier === 'firma'
                            ? 'px-6 py-4 text-center text-sm font-semibold text-bamboo-deep'
                            : 'px-6 py-4 text-center text-sm text-navy-soft'
                        }
                      >
                        {isCheck ? (
                          <CheckIcon />
                        ) : isDash ? (
                          <span aria-hidden="true" className="text-navy-soft/40">
                            —
                          </span>
                        ) : (
                          value
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function CheckIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      className="mx-auto text-bamboo"
      aria-label="included"
    >
      <path d="M5 12l5 5L20 7" />
    </svg>
  );
}
