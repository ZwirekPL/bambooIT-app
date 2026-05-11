interface CategoryStyle {
  bg: string;
  text: string;
}

const DEFAULT_STYLE: CategoryStyle = { bg: 'bg-gray-100', text: 'text-gray-700' };

const STYLES: Record<string, CategoryStyle> = {
  // canonical
  'Porady dietetyczne':  { bg: 'bg-orange-100', text: 'text-orange-700' },
  'Odchudzanie':         { bg: 'bg-lime-100',   text: 'text-lime-700' },
  'Zdrowie i choroby':   { bg: 'bg-teal-100',   text: 'text-teal-700' },
  'Przepisy':            { bg: 'bg-green-100',  text: 'text-green-700' },
  'AI i dietetyka':      { bg: 'bg-blue-100',   text: 'text-blue-700' },
  'Motywacja':           { bg: 'bg-purple-100', text: 'text-purple-700' },
  'Subskrypcja':         { bg: 'bg-yellow-100', text: 'text-yellow-700' },
  'Thermomix & Airfryer':{ bg: 'bg-red-100',    text: 'text-red-700' },
  // legacy aliases
  'Porady':  { bg: 'bg-orange-100', text: 'text-orange-700' },
  'Zdrowie': { bg: 'bg-teal-100',   text: 'text-teal-700' },
};

export function getCategoryStyle(category: string): CategoryStyle {
  return STYLES[category] ?? DEFAULT_STYLE;
}
