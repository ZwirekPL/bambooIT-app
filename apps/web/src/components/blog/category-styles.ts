interface CategoryStyle {
  bg: string;
  text: string;
}

const DEFAULT_STYLE: CategoryStyle = { bg: 'bg-gray-100', text: 'text-gray-700' };

/**
 * Category pill colour tokens. Categories themselves live in
 * `apps/web/src/config/blogCategories.ts` — keep both lists in sync.
 * Colours are distinct hues across Tailwind palette so categories are
 * scannable on the blog list page. Each pill stays soft (bg-X-100 +
 * text-X-700) so it never competes with Neo-Swiss bamboo accents.
 */
const STYLES: Record<string, CategoryStyle> = {
  // canonical bambooIT categories (matches BLOG_CATEGORY_LIST in blogCategories.ts)
  'Obsługa IT':          { bg: 'bg-slate-100',   text: 'text-slate-700'   },
  'Cyberbezpieczeństwo': { bg: 'bg-red-100',     text: 'text-red-700'     },
  'Backup':              { bg: 'bg-blue-100',    text: 'text-blue-700'    },
  'Microsoft 365':       { bg: 'bg-indigo-100',  text: 'text-indigo-700'  },
  'Sprzęt i sieci':      { bg: 'bg-amber-100',   text: 'text-amber-700'   },
  'Automatyzacje':       { bg: 'bg-purple-100',  text: 'text-purple-700'  },
  'Strony i aplikacje':  { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  'Branże':              { bg: 'bg-stone-100',   text: 'text-stone-700'   },
};

export function getCategoryStyle(category: string): CategoryStyle {
  return STYLES[category] ?? DEFAULT_STYLE;
}
