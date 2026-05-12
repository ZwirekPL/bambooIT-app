// One-shot K5a schema editor — drops 30 diet food/recipe/clean-product models + ~17 sibling enums.
// Reads packages/database/prisma/schema.prisma, removes listed blocks, writes new file.
// Idempotent: missing blocks logged but don't fail.

const fs = require('fs');
const path = require('path');

const SCHEMA = path.join(__dirname, '..', 'packages', 'database', 'prisma', 'schema.prisma');

const MODELS_TO_DROP = [
  'FoodCategory', 'FoodProduct', 'FoodBrand',
  'FoodProductNutrients', 'FoodProductAllergen', 'FoodProductDietFlag',
  'FoodProductAlias', 'FoodProductSourceMeta', 'HouseholdMeasure',
  'Recipe', 'RecipeIngredient', 'RecipeInstructionStep', 'RecipeNutritionSnapshot',
  'RecipeAllergen', 'RecipeDietFlag', 'RecipeRating',
  'CleanProduct', 'CleanProductNutrients', 'CleanProductPortion',
  'CleanProductAllergen', 'CleanProductDietFlag', 'CleanProductAminoAcids',
  'CleanProductBioactives',
  'IngredientRepairLog', 'IngredientSubstitutionRule',
  'FavoriteMeal', 'ShoppingListCheck',
  'ImportJob', 'DataQualityIssue', 'ManualReviewQueue',
];

const ENUMS_TO_DROP = [
  'FoodState', 'FodmapLevel', 'PriceCategory', 'ProcessingLevel',
  'AllergenPresence', 'DietFlagSource',
  'ImportJobStatus', 'DataQualitySeverity', 'ReviewItemType', 'ReviewItemStatus',
  'RecipeDifficulty', 'RecipeMealType', 'DishCompleteness', 'ServingType',
  'VerificationStatus', 'FoodRestrictionLevel',
  'CleanProductType', 'CleanProductSource', 'CleanVerificationStatus',
];

const src = fs.readFileSync(SCHEMA, 'utf-8');
const lines = src.split('\n');

function findBlock(kind, name) {
  // Match "model X {" or "enum X {" — must be at line start (after optional whitespace).
  // Capture from header to matching closing "}".
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(new RegExp('^' + kind + '\\s+' + name + '\\s*\\{'));
    if (!m) continue;
    // Find closing brace
    let depth = 0;
    for (let j = i; j < lines.length; j++) {
      const opens = (lines[j].match(/\{/g) || []).length;
      const closes = (lines[j].match(/\}/g) || []).length;
      depth += opens - closes;
      if (depth === 0) return { start: i, end: j };
    }
    return null;
  }
  return null;
}

// Mark lines for removal (descending so we can splice safely later, but here we just nullify)
const toRemove = new Set();
let removedModels = [];
let removedEnums = [];
let missing = [];

for (const name of MODELS_TO_DROP) {
  const block = findBlock('model', name);
  if (!block) { missing.push(`model ${name}`); continue; }
  // Drop block + 1 trailing blank line if present
  let end = block.end;
  if (end + 1 < lines.length && lines[end + 1].trim() === '') end = end + 1;
  for (let k = block.start; k <= end; k++) toRemove.add(k);
  removedModels.push(name);
}

for (const name of ENUMS_TO_DROP) {
  const block = findBlock('enum', name);
  if (!block) { missing.push(`enum ${name}`); continue; }
  let end = block.end;
  if (end + 1 < lines.length && lines[end + 1].trim() === '') end = end + 1;
  // Also drop preceding /// comment lines that document the enum
  let start = block.start;
  while (start > 0 && lines[start - 1].trim().startsWith('///')) start--;
  for (let k = start; k <= end; k++) toRemove.add(k);
  removedEnums.push(name);
}

const newLines = lines.filter((_, i) => !toRemove.has(i));
const newSrc = newLines.join('\n');

fs.writeFileSync(SCHEMA, newSrc);

console.log('Removed models:', removedModels.length, '/', MODELS_TO_DROP.length);
console.log('Removed enums:', removedEnums.length, '/', ENUMS_TO_DROP.length);
if (missing.length) {
  console.log('Missing (already removed?):', missing.join(', '));
}
console.log('Original lines:', lines.length, '→ New lines:', newLines.length, '(dropped', lines.length - newLines.length, 'lines)');
