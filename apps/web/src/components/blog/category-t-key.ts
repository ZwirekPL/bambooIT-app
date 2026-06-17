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
 * Maps Polish category values to their blog translation keys.
 */
export const CATEGORY_T_KEY: Record<string, CategoryTKey> = {
  'Obsługa IT':          'catObslugaIt',
  'Cyberbezpieczeństwo': 'catCyberbezpieczenstwo',
  'Backup':              'catBackup',
  'Microsoft 365':       'catMicrosoft365',
  'Sprzęt i sieci':      'catSprzetSieci',
  'Automatyzacje':       'catAutomatyzacje',
  'Strony i aplikacje':  'catStronyAplikacje',
  'Branże':              'catBranze',
};
