import { getTranslations } from 'next-intl/server';

type Person = {
  id: 'remigiusz' | 'wirgiliusz';
  initial: string;
  skillKeys: readonly string[];
};

const PEOPLE: Person[] = [
  {
    id: 'remigiusz',
    initial: 'R',
    skillKeys: ['remote', 'network', 'm365', 'security', 'backup', 'hardware'],
  },
  {
    id: 'wirgiliusz',
    initial: 'W',
    skillKeys: ['nextjs', 'typescript', 'postgres', 'automation', 'stripe', 'anthropic'],
  },
];

export async function AboutTeam() {
  const t = await getTranslations('oNas.team');

  return (
    <section className="border-y border-line bg-white px-5 py-24 md:px-12 md:py-32 lg:py-40">
      <div className="mx-auto w-full max-w-[1440px]">
        {/* Centered intro */}
        <div className="mb-16 text-center md:mb-24">
          <span className="font-mono text-xs uppercase tracking-[0.18em] text-bamboo-deep">
            {t('label')}
          </span>
          <h2 className="mx-auto mt-6 max-w-3xl font-display text-3xl font-black leading-[0.95] tracking-[-0.03em] text-navy-deep md:text-5xl lg:text-6xl xl:text-7xl">
            {t.rich('heading', {
              em: (chunks) => <em className="italic text-bamboo-deep">{chunks}</em>,
            })}
          </h2>
        </div>

        {/* Person cards */}
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 md:gap-12">
          {PEOPLE.map((person) => (
            <article
              key={person.id}
              className="rounded-3xl bg-paper p-10 transition-all duration-500 hover:-translate-y-1 hover:shadow-2xl md:p-12"
            >
              {/* Avatar — gradient circle with initial. Replace with real photo later. */}
              <div className="mb-8 flex h-32 w-32 items-center justify-center rounded-full border-4 border-white bg-gradient-to-br from-bamboo-soft to-bamboo-deep font-display text-5xl font-black text-navy-deep shadow-lg md:h-40 md:w-40 md:text-6xl">
                {person.initial}
              </div>

              <span className="font-mono text-xs uppercase tracking-[0.12em] text-bamboo-deep">
                {t(`people.${person.id}.role`)}
              </span>
              <h3 className="mt-3 font-display text-3xl font-bold leading-none tracking-[-0.02em] text-navy-deep md:text-4xl lg:text-5xl">
                {t(`people.${person.id}.name`)}
              </h3>
              <p className="mt-6 text-base leading-[1.65] text-navy-soft md:text-lg">
                {t.rich(`people.${person.id}.bio`, {
                  strong: (chunks) => (
                    <strong className="font-semibold text-navy-deep">{chunks}</strong>
                  ),
                })}
              </p>

              <div className="mt-8 border-t border-line pt-6">
                <div className="mb-4 font-mono text-[11px] uppercase tracking-[0.12em] text-navy-soft">
                  {t('skillsLabel')}
                </div>
                <ul className="flex flex-wrap gap-2">
                  {person.skillKeys.map((skill) => (
                    <li
                      key={skill}
                      className="rounded-full border border-line bg-white px-3.5 py-1.5 text-sm text-navy"
                    >
                      {t(`people.${person.id}.skills.${skill}`)}
                    </li>
                  ))}
                </ul>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
