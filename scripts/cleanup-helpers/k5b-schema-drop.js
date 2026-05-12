// K5b schema drop — diet planning models. Variant A: drops AiCostLog + AiUsageLog too.
// Reuses logic from k5a-schema-drop.js — different lists only.

const fs = require('fs');
const path = require('path');

const SCHEMA = path.join(__dirname, '..', '..', 'packages', 'database', 'prisma', 'schema.prisma');

const MODELS_TO_DROP = [
  // Planning core (8)
  'DietPlan', 'DietPlanRevision', 'Meal', 'MealSwap',
  'NutritionTargets', 'FrequentInput', 'DayRegeneration', 'DietitianNote',
  // Templates (4)
  'TemplatePlan', 'TemplateMeal', 'DietTemplate', 'NoteTemplate',
  // Patient tracking (5)
  'CheckIn', 'BodyMeasurement', 'LabPanel', 'SupplementPrescription', 'Interview',
  // Messaging (2)
  'Conversation', 'Message',
  // Grey-area A (2): per user decision, drop oba — diet-AI-pipeline glue
  'AiCostLog', 'AiUsageLog',
];

const ENUMS_TO_DROP = [
  'DietPlanSource', 'DietPlanStatus', 'DietPlanRevisionReason',
  'DayRegenReason', 'DayRegenStatus',
  'MealType', 'DietType', 'ValidationStatus',
];

// FK lines z ZOSTAJĄCYCH modeli — wymagają manual drop (Prisma validate
// inaczej się sypnie na "Type X is neither a built-in type, nor refers to another model").
// Format: { model: 'X', fieldNames: ['relName1', 'relName2'] } — drop linie zawierające te field names.
const REMAINING_MODEL_FK_DROPS = [
  {
    model: 'User',
    fieldNames: [
      'dietitianNotes', 'noteTemplates', 'conversationsAsPatient',
      'conversationsAsDietitian', 'sentMessages', 'supplementPrescriptions',
    ],
  },
  {
    model: 'Patient',
    fieldNames: [
      'interviews', 'dietPlans', 'labPanels', 'nutritionTargets',
      'checkIns', 'aiUsageLogs', 'dietitianNotes', 'bodyMeasurements',
      'supplements',
    ],
  },
  {
    model: 'NutritionProtocol',
    fieldNames: ['dietPlans'],
  },
];

const src = fs.readFileSync(SCHEMA, 'utf-8');
const lines = src.split('\n');

function findBlock(kind, name) {
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(new RegExp('^' + kind + '\\s+' + name + '\\s*\\{'));
    if (!m) continue;
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

const toRemove = new Set();
let removedModels = [];
let removedEnums = [];
let removedFkLines = [];
let missing = [];

for (const name of MODELS_TO_DROP) {
  const block = findBlock('model', name);
  if (!block) { missing.push(`model ${name}`); continue; }
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
  let start = block.start;
  while (start > 0 && lines[start - 1].trim().startsWith('///')) start--;
  for (let k = start; k <= end; k++) toRemove.add(k);
  removedEnums.push(name);
}

// Drop FK lines z ZOSTAJĄCYCH modeli (Patient, User, NutritionProtocol)
for (const { model: modelName, fieldNames } of REMAINING_MODEL_FK_DROPS) {
  const block = findBlock('model', modelName);
  if (!block) { missing.push(`remaining model ${modelName}`); continue; }
  for (let i = block.start; i <= block.end; i++) {
    if (toRemove.has(i)) continue;
    const line = lines[i];
    for (const fname of fieldNames) {
      // Match: leading whitespace, fname, whitespace (field declaration line)
      const re = new RegExp('^\\s+' + fname + '\\s+');
      if (re.test(line)) {
        toRemove.add(i);
        removedFkLines.push(`${modelName}.${fname} (L${i + 1})`);
        break;
      }
    }
  }
}

const newLines = lines.filter((_, i) => !toRemove.has(i));
const newSrc = newLines.join('\n');

fs.writeFileSync(SCHEMA, newSrc);

console.log('Removed models:', removedModels.length, '/', MODELS_TO_DROP.length);
console.log('Removed enums:', removedEnums.length, '/', ENUMS_TO_DROP.length);
console.log('Removed FK lines from REMAINING models:', removedFkLines.length);
for (const l of removedFkLines) console.log('  -', l);
if (missing.length) {
  console.log('Missing (already removed?):', missing.join(', '));
}
console.log('Original lines:', lines.length, '→ New lines:', newLines.length, '(dropped', lines.length - newLines.length, 'lines)');
