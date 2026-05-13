import Image from 'next/image';
import { Link } from '@/i18n/navigation';
import { BRAND } from '@config/brand';
import { User } from 'lucide-react';

interface AuthorBoxProps {
  name: string;
  locale: string;
  aboutLabel: string;
}

export function AuthorBox({ name, locale, aboutLabel }: AuthorBoxProps) {
  const bio = locale === 'en' ? BRAND.author.bioEn : BRAND.author.bio;

  return (
    <div className="mt-12 flex gap-5 rounded-2xl border border-line bg-paper p-6">
      <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-full bg-gradient-to-br from-bamboo-soft to-bamboo-deep">
        {BRAND.author.image ? (
          <Image
            src={BRAND.author.image}
            alt={name}
            fill
            className="object-cover"
            sizes="64px"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <User className="h-7 w-7 text-navy-deep" />
          </div>
        )}
      </div>
      <div className="flex flex-col justify-center">
        <p className="font-display text-base font-semibold text-navy">{name}</p>
        <p className="mt-1 text-sm leading-relaxed text-navy-soft">{bio}</p>
        <Link
          href={BRAND.author.aboutUrl}
          className="mt-3 inline-flex items-center gap-1 font-mono text-xs font-medium uppercase tracking-[0.1em] text-bamboo-deep transition-colors hover:text-navy"
        >
          {aboutLabel} →
        </Link>
      </div>
    </div>
  );
}
