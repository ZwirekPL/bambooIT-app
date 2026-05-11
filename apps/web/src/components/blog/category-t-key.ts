/** Union of all category translation keys in the 'blog' namespace. */
export type CategoryTKey =
  | 'catAll'
  | 'catPoradyDietetyczne'
  | 'catOdchudzanie'
  | 'catZdrowieChoroby'
  | 'catPrzepisy'
  | 'catAI'
  | 'catMotywacja'
  | 'catSubskrypcja'
  | 'catThermomix';

/** Maps Polish category values (canonical + legacy) to their blog translation keys. */
export const CATEGORY_T_KEY: Record<string, CategoryTKey> = {
  // canonical
  'Porady dietetyczne':  'catPoradyDietetyczne',
  'Odchudzanie':         'catOdchudzanie',
  'Zdrowie i choroby':   'catZdrowieChoroby',
  'Przepisy':            'catPrzepisy',
  'AI i dietetyka':      'catAI',
  'Motywacja':           'catMotywacja',
  'Subskrypcja':         'catSubskrypcja',
  'Thermomix & Airfryer':'catThermomix',
  // legacy aliases (old DB values)
  'Porady':              'catPoradyDietetyczne',
  'Zdrowie':             'catZdrowieChoroby',
};
