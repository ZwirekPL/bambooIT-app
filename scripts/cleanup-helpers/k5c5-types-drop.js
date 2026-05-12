// K5c.5 — drop diet clinical types from frontend api layer.
// Analog do k5b5-types-drop.js.

const fs = require('fs');
const path = require('path');

const TYPES_FILE = path.join(__dirname, '..', '..', 'apps', 'web', 'src', 'types', 'api.ts');
const LIB_FILE = path.join(__dirname, '..', '..', 'apps', 'web', 'src', 'lib', 'api.ts');

const CLINICAL_TYPE_NAMES = [
  'ClinicalRule', 'ClinicalRuleHistory', 'ClinicalRuleType', 'ClinicalRuleSource', 'RuleSeverity',
  'NutritionProtocol', 'NutritionProtocolCreateData',
  'DietitianProtocolWithAccess', 'ProtocolAssignedDietitian',
  'MacroRatio', 'MacroRatios', 'CaloricAdjustments', 'MealSlot',
  'FoodRestriction', 'AvoidCategory',
  'ProtocolTrigger', 'ProtocolTriggerCreateData',
  'ProtocolConflict', 'ProtocolConflictCreateData',
  'MatchedProtocolEntry', 'DetectedConflictEntry', 'MergedProtocolSummary',
  'MatchedProtocolsResponse',
  'ProtocolScope', 'RecipeComplexity', 'BmrFormula',
  'MonthlyReport',
];

const LIB_SECTION_NAMES = [
  'report', 'protocols', 'dietitianProtocol',
  'protocolTriggers', 'protocolConflicts', 'clinicalRules',
];

function dropTsBlocks(src, namesToDrop) {
  const lines = src.split('\n');
  const toRemove = new Set();
  let removed = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const ifaceMatch = line.match(/^export interface (\w+)\b/);
    const typeMatch = line.match(/^export type (\w+)\b/);
    const name = ifaceMatch?.[1] || typeMatch?.[1];
    if (!name || !namesToDrop.includes(name)) continue;

    let end = i;
    if (ifaceMatch) {
      let depth = 0;
      for (let j = i; j < lines.length; j++) {
        depth += (lines[j].match(/\{/g) || []).length;
        depth -= (lines[j].match(/\}/g) || []).length;
        if (depth === 0 && j > i) { end = j; break; }
        if (j === i && depth === 0) { end = j; break; }
      }
    } else {
      for (let j = i; j < lines.length; j++) {
        if (lines[j].trim().endsWith(';') || lines[j].trim().endsWith('}')) { end = j; break; }
      }
    }
    if (end + 1 < lines.length && lines[end + 1].trim() === '') end = end + 1;
    for (let k = i; k <= end; k++) toRemove.add(k);
    removed.push(name);
  }

  const newLines = lines.filter((_, i) => !toRemove.has(i));
  return { newSrc: newLines.join('\n'), removed, droppedLines: lines.length - newLines.length };
}

function dropLibSections(src, sectionNames) {
  const lines = src.split('\n');
  const toRemove = new Set();
  let removed = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const m = line.match(/^  (\w+):\s*\{$/);
    if (!m || !sectionNames.includes(m[1])) continue;

    let depth = 1;
    let end = i;
    for (let j = i + 1; j < lines.length; j++) {
      depth += (lines[j].match(/\{/g) || []).length;
      depth -= (lines[j].match(/\}/g) || []).length;
      if (depth === 0) { end = j; break; }
    }
    for (let k = i; k <= end; k++) toRemove.add(k);
    removed.push(m[1]);
  }

  const newLines = lines.filter((_, i) => !toRemove.has(i));
  return { newSrc: newLines.join('\n'), removed, droppedLines: lines.length - newLines.length };
}

const typesSrc = fs.readFileSync(TYPES_FILE, 'utf-8');
const typesResult = dropTsBlocks(typesSrc, CLINICAL_TYPE_NAMES);
fs.writeFileSync(TYPES_FILE, typesResult.newSrc);
console.log('types/api.ts: removed', typesResult.removed.length, 'blocks (' + typesResult.removed.join(', ') + ')');
console.log('  lines dropped:', typesResult.droppedLines);

const libSrc = fs.readFileSync(LIB_FILE, 'utf-8');
const libResult = dropLibSections(libSrc, LIB_SECTION_NAMES);
fs.writeFileSync(LIB_FILE, libResult.newSrc);
console.log('lib/api.ts: removed', libResult.removed.length, 'sections (' + libResult.removed.join(', ') + ')');
console.log('  lines dropped:', libResult.droppedLines);
