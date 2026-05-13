import { Link } from '@/i18n/navigation';
import { getTranslations } from 'next-intl/server';

export default async function NotFound() {
  const t = await getTranslations('notFound');

  return (
    <section className="flex min-h-[calc(100vh-5rem)] flex-col items-center justify-center bg-paper px-5 py-32 text-center md:px-12 md:py-40">
      <div className="mx-auto w-full max-w-2xl">
        <p className="font-display text-[8rem] font-black leading-none tracking-[-0.05em] text-bamboo-deep md:text-[12rem]">
          404
        </p>
        <h1 className="mt-4 font-display text-3xl font-light leading-tight tracking-[-0.03em] text-navy md:text-5xl">
          {t('title')}
        </h1>
        <p className="mt-6 text-base leading-[1.6] text-navy-soft md:text-lg">
          {t('description')}
        </p>
        <Link
          href="/"
          className="mt-10 inline-flex items-center gap-3 rounded-full bg-bamboo px-7 py-3.5 text-sm font-bold text-navy-deep transition-all hover:-translate-y-0.5 hover:bg-bamboo-deep"
        >
          {t('backHome')}
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            aria-hidden="true"
          >
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </Link>
      </div>
    </section>
  );
}
