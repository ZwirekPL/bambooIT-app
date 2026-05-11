import { BRAND } from '@config/brand';

type BreadcrumbItem = { name: string; path: string };

export function BreadcrumbSchema({ items, locale }: { items: BreadcrumbItem[]; locale: string }) {
  const base = `https://${BRAND.domain}/${locale}`;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Strona główna', item: base },
      ...items.map((item, i) => ({
        '@type': 'ListItem',
        position: i + 2,
        name: item.name,
        item: `${base}${item.path}`,
      })),
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}
