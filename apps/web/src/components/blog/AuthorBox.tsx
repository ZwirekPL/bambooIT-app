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
  const bio =
    locale === 'en' ? BRAND.author.bioEn : BRAND.author.bio;

  return (
    <div className="mt-12 flex gap-4 rounded-2xl border border-sage-200 bg-sage-50/50 p-5">
      <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-full bg-sage-200">
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
            <User className="h-8 w-8 text-sage-400" />
          </div>
        )}
      </div>
      <div className="flex flex-col justify-center">
        <p className="text-sm font-semibold text-foreground">{name}</p>
        <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
          {bio}
        </p>
        <Link
          href={BRAND.author.aboutUrl}
          className="mt-2 text-sm font-medium text-sage-600 hover:text-sage-700 transition-colors"
        >
          {aboutLabel} →
        </Link>
      </div>
    </div>
  );
}
