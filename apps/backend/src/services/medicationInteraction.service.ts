/**
 * Medication ↔ Food Interaction Service (79.5)
 *
 * Maps patient medications (from Interview.medicalFlags) to dietary constraints
 * and warnings that feed into the solver and DietToolkit.
 */

// ─── Interaction Rules Database ──────────────────────────────────────────────

export interface NutrientConstraint {
  nutrient: string;
  type: 'AVOID' | 'LIMIT' | 'BOOST' | 'STABLE';
  slot?: string;       // e.g. "breakfast" — avoid in this slot
  note: string;
}

export interface MedicationRule {
  medication: string;           // match pattern (case-insensitive)
  aliases: string[];            // alternative names
  category: string;             // e.g. "antidiabetic", "anticoagulant"
  nutrientConstraints: NutrientConstraint[];
  warnings: string[];
  solverPenalties: Array<{
    condition: string;
    penalty: number;
    description: string;
  }>;
}

/**
 * 20 most common medication interaction rules (79.5.4-79.5.13)
 */
export const MEDICATION_RULES: MedicationRule[] = [
  // 79.5.4 Metformin
  {
    medication: 'metformina',
    aliases: ['metformin', 'glucophage', 'siofor'],
    category: 'antidiabetic',
    nutrientConstraints: [
      { nutrient: 'vitaminB12', type: 'BOOST', note: 'Metformina zmniejsza wchłanianie B12 — suplementuj lub zwiększ w diecie' },
    ],
    warnings: ['Unikaj alkoholu (ryzyko kwasicy mleczanowej)', 'Monitoruj poziom B12 co 6-12 miesięcy'],
    solverPenalties: [
      { condition: 'low_b12', penalty: -300, description: 'Bonus za przepisy bogate w B12 przy metforminie' },
    ],
  },
  // 79.5.5 Warfarin / Acenocoumarol
  {
    medication: 'warfaryna',
    aliases: ['warfarin', 'coumadin', 'acenokumarol', 'acenocoumarol', 'sintrom'],
    category: 'anticoagulant',
    nutrientConstraints: [
      { nutrient: 'vitaminK', type: 'STABLE', note: 'Utrzymuj STAŁY poziom witaminy K dzień do dnia — nie zwiększaj ani nie zmniejszaj nagle' },
    ],
    warnings: ['Unikaj nagłych zmian w spożyciu zielonych warzyw liściastych', 'Unikaj żurawiny i grejpfruta w dużych ilościach'],
    solverPenalties: [
      { condition: 'vitK_spike', penalty: -500, description: 'Penalty za skoki wit. K >50% dzień-do-dnia' },
    ],
  },
  // 79.5.6 Levothyroxine
  {
    medication: 'lewotyroksyna',
    aliases: ['levothyroxine', 'euthyrox', 'letrox', 'l-thyroxine'],
    category: 'thyroid',
    nutrientConstraints: [
      { nutrient: 'calcium', type: 'AVOID', slot: 'breakfast', note: 'Nie łącz z wapniem w śniadaniu (2h od leku)' },
      { nutrient: 'iron', type: 'AVOID', slot: 'breakfast', note: 'Nie łącz z żelazem w śniadaniu' },
      { nutrient: 'soy', type: 'AVOID', slot: 'breakfast', note: 'Unikaj soi w śniadaniu' },
    ],
    warnings: ['Przyjmuj lek 30-60 min przed śniadaniem na pusty żołądek'],
    solverPenalties: [
      { condition: 'breakfast_calcium_high', penalty: -400, description: 'Penalty za wapń >150mg w śniadaniu' },
      { condition: 'breakfast_iron_high', penalty: -400, description: 'Penalty za żelazo >5mg w śniadaniu' },
    ],
  },
  // 79.5.7 Statins
  {
    medication: 'atorwastatyna',
    aliases: ['atorvastatin', 'lipitor', 'rosuwastatyna', 'rosuvastatin', 'crestor', 'simwastatyna', 'simvastatin', 'statins', 'statyny'],
    category: 'statin',
    nutrientConstraints: [
      { nutrient: 'grapefruit', type: 'AVOID', note: 'Unikaj grejpfruta i pomelo (hamuje metabolizm leku)' },
      { nutrient: 'omega3', type: 'BOOST', note: 'Omega-3 wspiera działanie statyn' },
    ],
    warnings: ['Unikaj grejpfruta i soku grejpfrutowego', 'Ogranicz alkohol'],
    solverPenalties: [
      { condition: 'contains_grapefruit', penalty: -600, description: 'Hard penalty za grejpfrut przy statynach' },
    ],
  },
  // 79.5.8 PPI (Proton Pump Inhibitors)
  {
    medication: 'omeprazol',
    aliases: ['omeprazole', 'pantoprazol', 'pantoprazole', 'esomeprazol', 'nexium', 'controloc', 'ppi'],
    category: 'ppi',
    nutrientConstraints: [
      { nutrient: 'magnesium', type: 'BOOST', note: 'PPI zmniejsza wchłanianie magnezu przy długim stosowaniu' },
      { nutrient: 'vitaminB12', type: 'BOOST', note: 'PPI zmniejsza wchłanianie B12' },
      { nutrient: 'calcium', type: 'BOOST', note: 'PPI zmniejsza wchłanianie wapnia' },
    ],
    warnings: ['Przy stosowaniu >3 miesięcy monitoruj magnez i B12'],
    solverPenalties: [],
  },
  // 79.5.9 SSRI / Antidepressants
  {
    medication: 'fluoksetyna',
    aliases: ['fluoxetine', 'prozac', 'sertralina', 'sertraline', 'zoloft', 'paroksetyna', 'paroxetine', 'citalopram', 'escitalopram', 'antidepressants', 'antydepresanty'],
    category: 'ssri',
    nutrientConstraints: [
      { nutrient: 'tyramine', type: 'LIMIT', note: 'Ostrożnie z tyraminą (dotyczy głównie MAOI, przy SSRI ryzyko niskie)' },
    ],
    warnings: ['Unikaj alkoholu', 'Grejpfrut może nasilać działanie niektórych SSRI'],
    solverPenalties: [],
  },
  // 79.5.10 Corticosteroids / Glucocorticoids
  {
    medication: 'prednizon',
    aliases: ['prednisone', 'prednisolone', 'methylprednisolone', 'deksametazon', 'dexamethasone', 'hydrokortyzon', 'glucocorticoids', 'glikokortykosteroidy'],
    category: 'corticosteroid',
    nutrientConstraints: [
      { nutrient: 'calcium', type: 'BOOST', note: 'Kortykosteroidy zwiększają ryzyko osteoporozy — więcej wapnia' },
      { nutrient: 'vitaminD', type: 'BOOST', note: 'Suplementuj wit. D przy długim stosowaniu' },
      { nutrient: 'sodium', type: 'LIMIT', note: 'Ogranicz sód (retencja wody)' },
    ],
    warnings: ['Ogranicz sól', 'Monitoruj glikemię (steroidy podnoszą cukier)'],
    solverPenalties: [
      { condition: 'high_sodium', penalty: -300, description: 'Wzmocniony penalty za sód przy kortykosteroidach' },
    ],
  },
  // 79.5.11 ACE Inhibitors
  {
    medication: 'ramipril',
    aliases: ['ramipril', 'lisinopril', 'enalapryl', 'enalapril', 'perindopril', 'ace_inhibitors'],
    category: 'ace_inhibitor',
    nutrientConstraints: [
      { nutrient: 'potassium', type: 'LIMIT', note: 'Ogranicz potas przy niewydolności nerek (ACE podnosi potas)' },
    ],
    warnings: ['Nie stosuj zamienników soli potasowej bez konsultacji'],
    solverPenalties: [],
  },
  // 79.5.12 Insulin
  {
    medication: 'insulina',
    aliases: ['insulin', 'novorapid', 'humalog', 'lantus', 'levemir', 'tresiba'],
    category: 'insulin',
    nutrientConstraints: [
      { nutrient: 'carbs', type: 'STABLE', note: 'Stabilne węglowodany w każdym posiłku — unikaj skoków glikemii' },
    ],
    warnings: ['Regularny rozkład węglowodanów w ciągu dnia', 'Niski IG kolacji'],
    solverPenalties: [
      { condition: 'high_gi_dinner', penalty: -300, description: 'Penalty za wysoki IG kolacji przy insulinie' },
    ],
  },
  // 79.5.13 Lithium
  {
    medication: 'lit',
    aliases: ['lithium', 'lithium carbonate'],
    category: 'mood_stabilizer',
    nutrientConstraints: [
      { nutrient: 'sodium', type: 'STABLE', note: 'Utrzymuj stały poziom sodu — wahania wpływają na stężenie litu' },
    ],
    warnings: ['Pij dużo wody (nawodnienie)', 'Nie stosuj drastycznych diet odchudzających'],
    solverPenalties: [],
  },
  // 79.5.14 Beta-blockers
  {
    medication: 'beta-blokery',
    aliases: ['beta_blockers', 'metoprolol', 'bisoprolol', 'atenolol', 'propranolol', 'nebivolol', 'carvedilol', 'karwedilol'],
    category: 'beta_blocker',
    nutrientConstraints: [
      { nutrient: 'potassium', type: 'BOOST', note: 'Beta-blokery mogą obniżać potas — jedz banany, ziemniaki, pomidory' },
      { nutrient: 'coQ10', type: 'BOOST', note: 'Beta-blokery mogą obniżać CoQ10 — rozważ suplementację' },
    ],
    warnings: ['Unikaj nagłego odstawienia leku', 'Ogranicz alkohol i kofeinę'],
    solverPenalties: [],
  },
  // 79.5.15 NSAIDs
  {
    medication: 'ibuprofen',
    aliases: ['nsaids', 'nlpz', 'naproxen', 'naproksen', 'diklofenak', 'diclofenac', 'ketoprofen', 'piroksykam', 'meloksykam'],
    category: 'nsaid',
    nutrientConstraints: [
      { nutrient: 'iron', type: 'BOOST', note: 'NLPZ mogą powodować mikrokrwawienia z przewodu pokarmowego — monitoruj żelazo' },
      { nutrient: 'vitaminC', type: 'BOOST', note: 'Wit. C chroni śluzówkę żołądka' },
    ],
    warnings: ['Przyjmuj z posiłkiem (ochrona żołądka)', 'Unikaj alkoholu przy stosowaniu NLPZ'],
    solverPenalties: [],
  },
  // 79.5.16 Diuretics
  {
    medication: 'diuretyki',
    aliases: ['diuretics', 'furosemid', 'furosemide', 'hydrochlorotiazyd', 'hydrochlorothiazide', 'indapamid', 'indapamide', 'spironolakton', 'spironolactone', 'torasemid'],
    category: 'diuretic',
    nutrientConstraints: [
      { nutrient: 'potassium', type: 'BOOST', note: 'Diuretyki pętlowe i tiazydowe wypłukują potas — zwiększ w diecie' },
      { nutrient: 'magnesium', type: 'BOOST', note: 'Diuretyki mogą obniżać magnez' },
      { nutrient: 'sodium', type: 'LIMIT', note: 'Ogranicz sód — diuretyki działają na retencję sodu' },
    ],
    warnings: ['Pij odpowiednio dużo wody', 'Monitoruj elektrolity (potas, magnez, sód)'],
    solverPenalties: [],
  },
];

// ─── Matching ────────────────────────────────────────────────────────────────

/**
 * Match patient medications against rules.
 * @param medications - list of medication names from Interview.medicalFlags
 */
export function matchMedicationInteractions(
  medications: string[],
): MedicationRule[] {
  const matched: MedicationRule[] = [];
  const normalizedMeds = medications.map((m) => m.toLowerCase().trim());

  for (const rule of MEDICATION_RULES) {
    const allNames = [rule.medication, ...rule.aliases].map((n) => n.toLowerCase());
    const isMatch = normalizedMeds.some((med) =>
      allNames.some((name) => med.includes(name) || name.includes(med)),
    );
    if (isMatch) {
      matched.push(rule);
    }
  }

  return matched;
}

/**
 * Get all active warnings and constraints for a patient's medications.
 */
export function getInteractionSummary(medications: string[]): {
  matchedRules: MedicationRule[];
  allWarnings: string[];
  allConstraints: NutrientConstraint[];
  solverPenalties: Array<{ condition: string; penalty: number; description: string }>;
} {
  const matchedRules = matchMedicationInteractions(medications);
  const allWarnings = matchedRules.flatMap((r) => r.warnings);
  const allConstraints = matchedRules.flatMap((r) => r.nutrientConstraints);
  const solverPenalties = matchedRules.flatMap((r) => r.solverPenalties);

  return { matchedRules, allWarnings, allConstraints, solverPenalties };
}
