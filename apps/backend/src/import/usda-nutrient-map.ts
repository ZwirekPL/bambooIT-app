/**
 * USDA FoodData Central nutrient ID → our field name mapping.
 *
 * Source: USDA FDC API nutrient numbers (SR Legacy / Foundation Foods)
 * Reference: https://fdc.nal.usda.gov/portal-data/external/dataDictionary
 *
 * Nutrient IDs are stable across USDA datasets.
 */

export interface UsdaNutrientMapping {
  usdaId: number;
  field: string;
  /** Conversion factor to apply (e.g., 1.0 for mg→mg, 0.001 for ug→mg) */
  factor: number;
}

export const USDA_NUTRIENT_MAP: UsdaNutrientMapping[] = [
  // Energy
  { usdaId: 1008, field: 'kcal', factor: 1 },

  // Macronutrients
  { usdaId: 1003, field: 'protein_g', factor: 1 },
  { usdaId: 1004, field: 'fat_g', factor: 1 },
  { usdaId: 1005, field: 'carbs_g', factor: 1 },
  { usdaId: 1079, field: 'fiber_g', factor: 1 },
  { usdaId: 2000, field: 'sugars_g', factor: 1 },
  { usdaId: 1258, field: 'saturatedFat_g', factor: 1 },
  { usdaId: 1292, field: 'monounsaturatedFat_g', factor: 1 },
  { usdaId: 1293, field: 'polyunsaturatedFat_g', factor: 1 },
  { usdaId: 1257, field: 'transFat_g', factor: 1 },
  { usdaId: 1009, field: 'starch_g', factor: 1 },

  // Minerals
  { usdaId: 1093, field: 'sodium_mg', factor: 1 },
  { usdaId: 1092, field: 'potassium_mg', factor: 1 },
  { usdaId: 1087, field: 'calcium_mg', factor: 1 },
  { usdaId: 1090, field: 'magnesium_mg', factor: 1 },
  { usdaId: 1091, field: 'phosphorus_mg', factor: 1 },
  { usdaId: 1089, field: 'iron_mg', factor: 1 },
  { usdaId: 1095, field: 'zinc_mg', factor: 1 },
  { usdaId: 1098, field: 'copper_mg', factor: 1 },
  { usdaId: 1101, field: 'manganese_mg', factor: 1 },
  { usdaId: 1103, field: 'selenium_ug', factor: 1 },

  // Fat-soluble vitamins
  { usdaId: 1106, field: 'vitaminA_ug', factor: 1 }, // RAE
  { usdaId: 1107, field: 'betaCarotene_ug', factor: 1 },
  { usdaId: 1114, field: 'vitaminD_ug', factor: 1 }, // D (D2 + D3)
  { usdaId: 1109, field: 'vitaminE_mg', factor: 1 }, // alpha-tocopherol
  { usdaId: 1185, field: 'vitaminK_ug', factor: 1 }, // phylloquinone

  // Water-soluble vitamins
  { usdaId: 1162, field: 'vitaminC_mg', factor: 1 },
  { usdaId: 1165, field: 'vitaminB1_mg', factor: 1 }, // thiamin
  { usdaId: 1166, field: 'vitaminB2_mg', factor: 1 }, // riboflavin
  { usdaId: 1167, field: 'vitaminB3_mg', factor: 1 }, // niacin
  { usdaId: 1170, field: 'vitaminB5_mg', factor: 1 }, // pantothenic acid
  { usdaId: 1175, field: 'vitaminB6_mg', factor: 1 },
  { usdaId: 1177, field: 'folate_ug', factor: 1 }, // total folate
  { usdaId: 1178, field: 'vitaminB12_ug', factor: 1 },
  { usdaId: 1180, field: 'choline_mg', factor: 1 },

  // Other
  { usdaId: 1253, field: 'cholesterol_mg', factor: 1 },
  { usdaId: 1051, field: 'water_g', factor: 1 },
  { usdaId: 1018, field: 'alcohol_g', factor: 1 },
  { usdaId: 1057, field: 'caffeine_mg', factor: 1 },
  { usdaId: 1007, field: 'ash_g', factor: 1 },

  // Amino acids
  { usdaId: 1210, field: 'tryptophan_g', factor: 1 },
  { usdaId: 1211, field: 'threonine_g', factor: 1 },
  { usdaId: 1212, field: 'isoleucine_g', factor: 1 },
  { usdaId: 1213, field: 'leucine_g', factor: 1 },
  { usdaId: 1214, field: 'lysine_g', factor: 1 },
  { usdaId: 1215, field: 'methionine_g', factor: 1 },
  { usdaId: 1217, field: 'phenylalanine_g', factor: 1 },
  { usdaId: 1219, field: 'valine_g', factor: 1 },
  { usdaId: 1221, field: 'histidine_g', factor: 1 },

  // Fatty acids (these are individual FAs, need to sum for omega-3/6)
  // EPA (20:5 n-3)
  { usdaId: 1278, field: 'epa_g', factor: 1 },
  // DHA (22:6 n-3)
  { usdaId: 1272, field: 'dha_g', factor: 1 },
  // ALA (18:3 n-3)
  { usdaId: 1404, field: 'ala_g', factor: 1 },
];

/**
 * USDA food category → our FoodCategory slug mapping
 */
export const USDA_CATEGORY_MAP: Record<string, string> = {
  'Dairy and Egg Products': 'nabial-i-jaja',
  'Spices and Herbs': 'przyprawy-i-ziola',
  'Baby Foods': 'zywnosc-dla-niemowlat',
  'Fats and Oils': 'tluszcze-i-oleje',
  'Poultry Products': 'drob',
  'Soups, Sauces, and Gravies': 'zupy-i-sosy',
  'Sausages and Luncheon Meats': 'wedliny',
  'Breakfast Cereals': 'platki-sniadaniowe',
  'Fruits and Fruit Juices': 'owoce-i-soki',
  'Pork Products': 'wieprzowina',
  'Vegetables and Vegetable Products': 'warzywa',
  'Nut and Seed Products': 'orzechy-i-nasiona',
  'Beef Products': 'wolowina',
  'Beverages': 'napoje',
  'Finfish and Shellfish Products': 'ryby-i-owoce-morza',
  'Legumes and Legume Products': 'straczkowe',
  'Lamb, Veal, and Game Products': 'baranina-i-dziczyzna',
  'Baked Products': 'pieczywo-i-wypieki',
  'Sweets': 'slodycze',
  'Cereal Grains and Pasta': 'zboża-i-makarony',
  'Fast Foods': 'fast-food',
  'Meals, Entrees, and Side Dishes': 'dania-gotowe',
  'Snacks': 'przekaski',
  'American Indian/Alaska Native Foods': 'inne',
  'Restaurant Foods': 'dania-restauracyjne',
};

/**
 * Build nutrient lookup map from USDA nutrient ID to our field name
 */
export function buildNutrientLookup(): Map<number, { field: string; factor: number }> {
  const map = new Map<number, { field: string; factor: number }>();
  for (const entry of USDA_NUTRIENT_MAP) {
    map.set(entry.usdaId, { field: entry.field, factor: entry.factor });
  }
  return map;
}
