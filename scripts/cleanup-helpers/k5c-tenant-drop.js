// K5c bonus — drop Tenant model per D-025 (bambooIT is B2B, not SaaS).
// Drops Tenant model + User.ownedTenant + Patient.tenantId/tenant/index.

const fs = require('fs');
const path = require('path');

const SCHEMA = path.join(__dirname, '..', '..', 'packages', 'database', 'prisma', 'schema.prisma');

const MODELS_TO_DROP = ['Tenant'];
const ENUMS_TO_DROP = []; // no Tenant-specific enums

const REMAINING_MODEL_FK_DROPS = [
  { model: 'User', fieldNames: ['ownedTenant'] },
  { model: 'Patient', fieldNames: ['tenantId', 'tenant'] },
];

// Plus: drop @@index([tenantId]) line in Patient model
const REMAINING_INDEX_DROPS = [
  { model: 'Patient', indexPattern: /@@index\(\[tenantId\]\)/ },
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
let removedFkLines = [];
let removedIndexes = [];

for (const name of MODELS_TO_DROP) {
  const block = findBlock('model', name);
  if (!block) continue;
  let end = block.end;
  if (end + 1 < lines.length && lines[end + 1].trim() === '') end = end + 1;
  for (let k = block.start; k <= end; k++) toRemove.add(k);
  removedModels.push(name);
}

for (const { model: modelName, fieldNames } of REMAINING_MODEL_FK_DROPS) {
  const block = findBlock('model', modelName);
  if (!block) continue;
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

for (const { model: modelName, indexPattern } of REMAINING_INDEX_DROPS) {
  const block = findBlock('model', modelName);
  if (!block) continue;
  for (let i = block.start; i <= block.end; i++) {
    if (toRemove.has(i)) continue;
    if (indexPattern.test(lines[i])) {
      toRemove.add(i);
      removedIndexes.push(`${modelName} ${indexPattern} (L${i + 1})`);
    }
  }
}

const newLines = lines.filter((_, i) => !toRemove.has(i));
fs.writeFileSync(SCHEMA, newLines.join('\n'));

console.log('Removed models:', removedModels.length, '(' + removedModels.join(', ') + ')');
console.log('Removed FK lines:', removedFkLines.length);
for (const l of removedFkLines) console.log('  -', l);
console.log('Removed indexes:', removedIndexes.length);
for (const l of removedIndexes) console.log('  -', l);
console.log('Lines:', lines.length, '→', newLines.length, '(dropped', lines.length - newLines.length, ')');
