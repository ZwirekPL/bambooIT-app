// K5b.5 — drop diet planning types from frontend api layer.
// Parses TS exports (interface/type) and api sections, removes diet planning matches.

const fs = require('fs');
const path = require('path');

const TYPES_FILE = path.join(__dirname, '..', '..', 'apps', 'web', 'src', 'types', 'api.ts');
const LIB_FILE = path.join(__dirname, '..', '..', 'apps', 'web', 'src', 'lib', 'api.ts');

// Diet planning type names — drop all interface/type blocks starting with these.
const PLANNING_TYPE_NAMES = [
  // Core
  'Interview', 'InterviewSummary',
  'DietPlan', 'DietPlanSummary', 'DietPlanRevision', 'DietPlanRevisionDetail', 'DietPlanRevisionReason',
  'DietPlanSource', 'DietPlanStatus',
  'MealSwap', 'MealSwapAlternative',
  'NutritionTargets',
  // Slot/quality
  'PlanComparisonSide', 'SlotDecision', 'SlotDecisionScores', 'RunnerUp', 'DecisionConfidence',
  'PlanQualityData', 'PlanQualityGrade', 'SoftValidation', 'SoftValidationStatus', 'WeeklyMetrics',
  'PolicyMetadata', 'AiProcessingIssue', 'AiProcessingReport', 'SolverReport',
  'DietToolkitData', 'DietCacheStats',
  // Patient tracking
  'CheckIn', 'CheckInTrends', 'WeightTrend', 'PlateauInfo', 'RapidLossAlert',
  'MetricAverages', 'WeightDataPoint', 'Milestone', 'ProgressData',
  'BodyMeasurement', 'MeasurementSummary', 'WhrInterpretation', 'MeasurementTrends',
  'LabPanel', 'SupplementPrescription', 'SupplementCompliance', 'SupplementTaken', 'SupplementFrequency',
  // Dietitian notes/messaging
  'DietitianNote', 'NoteTemplate', 'DietitianAlert', 'DietitianStats',
  'PatientWithLatestPlan', 'PatientDetail', 'DietitianPatient', 'AdminDietitian',
  // AI tracking
  'AiCostLog', 'AiCostSummary', 'AiCostsListResponse', 'AiCostPlanDetailResponse',
  // Onboarding (diet-specific)
  'OnboardingStatus', 'DietitianOnboardingStatus',
  // Nutrition reports
  'MicronutrientReport', 'NutrientAssessment', 'SupplementRecommendation', 'NutrientStatus',
];

// Lib/api.ts section names — drop entire object sub-objects.
const LIB_SECTION_NAMES = [
  // Run 1 — diet planning fetch sections (K5b drops)
  'interviews', 'dietPlans', 'notes', 'noteTemplates',
  'adminAiCosts', 'checkIns', 'measurements', 'supplements', 'messages',
  // Run 2 — additional orphan sections (their backend routes dropped in K2a)
  'patients', 'onboarding', 'dietToolkit', 'dietitian',
];

// ─── Helper: find next-block boundary by indent + brace tracking ───────────

function dropTsBlocks(src, namesToDrop) {
  const lines = src.split('\n');
  const toRemove = new Set();
  let removed = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Match: "export interface NAME {" or "export type NAME ="
    const ifaceMatch = line.match(/^export interface (\w+)\b/);
    const typeMatch = line.match(/^export type (\w+)\b/);
    const name = ifaceMatch?.[1] || typeMatch?.[1];
    if (!name || !namesToDrop.includes(name)) continue;

    // Find end of block: for interface { ... }, track braces. For type X = ..., end at ;
    let end = i;
    if (ifaceMatch) {
      let depth = 0;
      for (let j = i; j < lines.length; j++) {
        depth += (lines[j].match(/\{/g) || []).length;
        depth -= (lines[j].match(/\}/g) || []).length;
        if (depth === 0 && j > i) { end = j; break; }
        if (j === i && depth === 0) { end = j; break; } // single-line
      }
    } else {
      // type X = Y;  could be multi-line. Walk until ; at end of line.
      for (let j = i; j < lines.length; j++) {
        if (lines[j].trim().endsWith(';') || lines[j].trim().endsWith('}')) { end = j; break; }
      }
    }
    // Include trailing blank line
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
    // Match: "  sectionName: {" at 2-space indent (inside `export const api = { ... }`)
    const m = line.match(/^  (\w+):\s*\{$/);
    if (!m || !sectionNames.includes(m[1])) continue;

    // Find matching closing brace at same indent level
    let depth = 1;
    let end = i;
    for (let j = i + 1; j < lines.length; j++) {
      depth += (lines[j].match(/\{/g) || []).length;
      depth -= (lines[j].match(/\}/g) || []).length;
      if (depth === 0) { end = j; break; }
    }
    // Trailing comma + blank line
    // (don't include next sibling section)
    for (let k = i; k <= end; k++) toRemove.add(k);
    removed.push(m[1]);
  }

  const newLines = lines.filter((_, i) => !toRemove.has(i));
  return { newSrc: newLines.join('\n'), removed, droppedLines: lines.length - newLines.length };
}

// ─── Run ──────────────────────────────────────────────────────────────────

const typesSrc = fs.readFileSync(TYPES_FILE, 'utf-8');
const typesResult = dropTsBlocks(typesSrc, PLANNING_TYPE_NAMES);
fs.writeFileSync(TYPES_FILE, typesResult.newSrc);
console.log('types/api.ts:');
console.log('  Removed', typesResult.removed.length, 'blocks (', typesResult.removed.join(', '), ')');
console.log('  Lines dropped:', typesResult.droppedLines);

const libSrc = fs.readFileSync(LIB_FILE, 'utf-8');
const libResult = dropLibSections(libSrc, LIB_SECTION_NAMES);
fs.writeFileSync(LIB_FILE, libResult.newSrc);
console.log('lib/api.ts:');
console.log('  Removed', libResult.removed.length, 'sections (', libResult.removed.join(', '), ')');
console.log('  Lines dropped:', libResult.droppedLines);
