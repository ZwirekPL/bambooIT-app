// K5c schema drop — diet clinical models + email campaign sweep.
// Analog do k5a/k5b-schema-drop.js.

const fs = require('fs');
const path = require('path');

const SCHEMA = path.join(__dirname, '..', '..', 'packages', 'database', 'prisma', 'schema.prisma');

const MODELS_TO_DROP = [
  // Clinical core (6)
  'NutritionProtocol', 'DietitianProtocolAccess', 'ProtocolTrigger',
  'ProtocolConflict', 'ClinicalRule', 'ClinicalRuleHistory',
  // Email residue sweep (2) — orphaned after K2c service drop
  'EmailCampaign', 'EmailSend',
];

const ENUMS_TO_DROP = [
  'ProtocolScope', 'RecipeComplexity', 'BmrFormula',
  'ClinicalRuleType', 'RuleSeverity',
];

// FK lines from REMAINING models to K5c USUWANE — manual drop required.
const REMAINING_MODEL_FK_DROPS = [
  {
    model: 'User',
    fieldNames: [
      'ownedProtocols',       // NutritionProtocol[]
      'protocolAccesses',     // DietitianProtocolAccess[] (relation "DietitianProtocolAccesses")
      'protocolAssignments',  // DietitianProtocolAccess[] (relation "ProtocolAssignments")
    ],
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

for (const { model: modelName, fieldNames } of REMAINING_MODEL_FK_DROPS) {
  const block = findBlock('model', modelName);
  if (!block) { missing.push(`remaining model ${modelName}`); continue; }
  for (let i = block.start; i <= block.end; i++) {
    if (toRemove.has(i)) continue;
    const line = lines[i];
    for (const fname of fieldNames) {
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
fs.writeFileSync(SCHEMA, newLines.join('\n'));

console.log('Removed models:', removedModels.length, '/', MODELS_TO_DROP.length);
console.log('Removed enums:', removedEnums.length, '/', ENUMS_TO_DROP.length);
console.log('Removed FK lines from REMAINING:', removedFkLines.length);
for (const l of removedFkLines) console.log('  -', l);
if (missing.length) console.log('Missing:', missing.join(', '));
console.log('Original lines:', lines.length, '→ New lines:', newLines.length, '(dropped', lines.length - newLines.length, 'lines)');
