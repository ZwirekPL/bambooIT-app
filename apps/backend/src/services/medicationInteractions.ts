/**
 * 38.3.4 — Medication-nutrient interactions.
 *
 * Maps common medications to nutrients they deplete or interact with.
 * Source: clinical pharmacology guidelines.
 */

export interface MedicationInteraction {
  medication: string;
  keywords: string[];  // matching keywords from patient's medication list
  nutrientKey: string;
  effect: 'DEPLETES' | 'INTERFERES' | 'REQUIRES_TIMING';
  description: string;
}

export const MEDICATION_INTERACTIONS: MedicationInteraction[] = [
  // Metformin → B12 depletion
  {
    medication: 'Metformina',
    keywords: ['metformin', 'metformina', 'glucophage', 'siofor'],
    nutrientKey: 'vitaminB12Ug',
    effect: 'DEPLETES',
    description: 'Metformina zmniejsza wchłanianie wit. B12 — kontroluj poziom co 6-12 mies.',
  },
  // PPI → Mg, Ca, B12 depletion
  {
    medication: 'IPP (inhibitory pompy protonowej)',
    keywords: ['omeprazol', 'pantoprazol', 'esomeprazol', 'lansoprazol', 'ipp', 'ppi'],
    nutrientKey: 'magnesiumMg',
    effect: 'DEPLETES',
    description: 'IPP zmniejszają wchłanianie magnezu przy długotrwałym stosowaniu.',
  },
  {
    medication: 'IPP (inhibitory pompy protonowej)',
    keywords: ['omeprazol', 'pantoprazol', 'esomeprazol', 'lansoprazol', 'ipp', 'ppi'],
    nutrientKey: 'calciumMg',
    effect: 'DEPLETES',
    description: 'IPP zmniejszają wchłanianie wapnia — ryzyko osteoporozy.',
  },
  {
    medication: 'IPP (inhibitory pompy protonowej)',
    keywords: ['omeprazol', 'pantoprazol', 'esomeprazol', 'lansoprazol', 'ipp', 'ppi'],
    nutrientKey: 'vitaminB12Ug',
    effect: 'DEPLETES',
    description: 'IPP zmniejszają wchłanianie wit. B12.',
  },
  // Warfarin → Vitamin K interaction
  {
    medication: 'Warfaryna / Acenokumarol',
    keywords: ['warfaryna', 'warfarin', 'acenokumarol', 'acenocoumarol', 'sintrom'],
    nutrientKey: 'vitaminKUg',
    effect: 'INTERFERES',
    description: 'Utrzymuj stały poziom wit. K w diecie (nie zwiększaj ani nie zmniejszaj).',
  },
  // Levothyroxine → Ca, Fe timing
  {
    medication: 'Lewotyroksyna',
    keywords: ['lewotyroksyna', 'levothyroxine', 'euthyrox', 'letrox', 'l-tyroksyna'],
    nutrientKey: 'calciumMg',
    effect: 'REQUIRES_TIMING',
    description: 'Wapń przyjmuj min. 4h po lewotyroksynie.',
  },
  {
    medication: 'Lewotyroksyna',
    keywords: ['lewotyroksyna', 'levothyroxine', 'euthyrox', 'letrox', 'l-tyroksyna'],
    nutrientKey: 'ironMg',
    effect: 'REQUIRES_TIMING',
    description: 'Żelazo przyjmuj min. 4h po lewotyroksynie.',
  },
  // Statins → CoQ10 depletion (not in our 18 but noted)
  // Diuretics → K, Mg depletion
  {
    medication: 'Diuretyki tiazydowe',
    keywords: ['hydrochlorotiazyd', 'indapamid', 'diuretyk'],
    nutrientKey: 'potassiumMg',
    effect: 'DEPLETES',
    description: 'Diuretyki tiazydowe zwiększają wydalanie potasu.',
  },
  {
    medication: 'Diuretyki tiazydowe',
    keywords: ['hydrochlorotiazyd', 'indapamid', 'diuretyk'],
    nutrientKey: 'magnesiumMg',
    effect: 'DEPLETES',
    description: 'Diuretyki tiazydowe zwiększają wydalanie magnezu.',
  },
];

/**
 * Find medication interactions for a patient's medication list.
 */
export function findMedicationInteractions(medications: string[]): MedicationInteraction[] {
  if (!medications?.length) return [];

  const medsLower = medications.map((m) => m.toLowerCase());
  const found: MedicationInteraction[] = [];

  for (const interaction of MEDICATION_INTERACTIONS) {
    const matches = interaction.keywords.some((kw) =>
      medsLower.some((med) => med.includes(kw))
    );
    if (matches) found.push(interaction);
  }

  return found;
}
