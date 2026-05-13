/** Union of all category translation keys in the 'blog' namespace. */
export type CategoryTKey =
  | 'catAll'
  | 'catObslugaIt'
  | 'catCyberbezpieczenstwo'
  | 'catBackup'
  | 'catMicrosoft365'
  | 'catSprzetSieci'
  | 'catAutomatyzacje'
  | 'catStronyAplikacje'
  | 'catBranze';

/**
 * Maps Polish category values (canonical bambooIT + legacy DietetykDEV)
 * to their blog translation keys. Legacy entries route old DB rows to
 * the closest semantic bambooIT category until BE-1 ships a one-time
 * Post.category migration.
 */
export const CATEGORY_T_KEY: Record<string, CategoryTKey> = {
  // canonical bambooIT (matches BLOG_CATEGORY_LIST)
  'Obsługa IT':          'catObslugaIt',
  'Cyberbezpieczeństwo': 'catCyberbezpieczenstwo',
  'Backup':              'catBackup',
  'Microsoft 365':       'catMicrosoft365',
  'Sprzęt i sieci':      'catSprzetSieci',
  'Automatyzacje':       'catAutomatyzacje',
  'Strony i aplikacje':  'catStronyAplikacje',
  'Branże':              'catBranze',
  // legacy DietetykDEV aliases (route to nearest bambooIT bucket)
  'Porady dietetyczne':  'catObslugaIt',
  'Porady':              'catObslugaIt',
  'Odchudzanie':         'catObslugaIt',
  'Zdrowie i choroby':   'catCyberbezpieczenstwo',
  'Zdrowie':             'catCyberbezpieczenstwo',
  'Przepisy':            'catObslugaIt',
  'AI i dietetyka':      'catAutomatyzacje',
  'Motywacja':           'catObslugaIt',
  'Subskrypcja':         'catObslugaIt',
  'Thermomix & Airfryer':'catSprzetSieci',
};
