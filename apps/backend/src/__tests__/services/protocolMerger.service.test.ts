import { vi, describe, it, expect, beforeEach } from 'vitest';

// ── hoisted mocks ────────────────────────────────────────────────────────────
const m = vi.hoisted(() => ({
  nutritionProtocol: { findMany: vi.fn() },
}));

vi.mock('@db', () => ({
  prisma: { nutritionProtocol: m.nutritionProtocol },
  Prisma: {},
}));

// ── imports ──────────────────────────────────────────────────────────────────
import { mergeProtocols } from '../../services/protocolMerger.service';
import type { MatchedProtocol } from '../../services/protocolMatcher.service';

// ── helpers ──────────────────────────────────────────────────────────────────

/** Raw DB row shape (as Prisma returns with JsonValue + Decimal-like fields) */
const makeRawProtocol = (overrides: Record<string, unknown> = {}) => ({
  id: 'proto-1',
  name: 'Standard WHO',
  description: null,
  version: 1,
  isActive: true,
  isDefault: true,
  scope: 'GLOBAL',
  dietitianId: null,
  bmrFormula: 'MIFFLIN',
  macroRatios: {
    REDUCE: { proteinPct: 30, fatPct: 25, carbsPct: 45 },
    GAIN: { proteinPct: 25, fatPct: 25, carbsPct: 50 },
    MAINTAIN: { proteinPct: 25, fatPct: 30, carbsPct: 45 },
  },
  caloricAdjustments: { REDUCE: -15, GAIN: 15, MAINTAIN: 0 },
  minProteinPerKg: { toString: () => '0.8' },
  maxProteinPerKg: { toString: () => '2.5' },
  defaultMealCount: 5,
  mealDistribution: [
    { mealName: 'Śniadanie', pct: 25 },
    { mealName: 'II Śniadanie', pct: 10 },
    { mealName: 'Obiad', pct: 35 },
    { mealName: 'Podwieczorek', pct: 10 },
    { mealName: 'Kolacja', pct: 20 },
  ],
  foodRestrictions: [],
  systemPromptAdditions: null,
  preferredCuisines: ['polish', 'mediterranean'],
  recipeComplexity: 'MODERATE',
  avoidFoodCategories: [],
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const makeMatchedProtocol = (overrides: Partial<MatchedProtocol> = {}): MatchedProtocol => ({
  triggerId: 'trigger-1',
  protocolId: 'proto-1',
  protocolName: 'Standard WHO',
  interviewField: 'mainGoal',
  interviewValue: 'REDUCE',
  priority: 3,
  score: 1.0,
  ...overrides,
});

// ── tests ────────────────────────────────────────────────────────────────────
describe('protocolMerger.service', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('mergeProtocols()', () => {
    it('returns null when no matched protocols and no dietitian override', async () => {
      const result = await mergeProtocols([]);

      expect(result).toBeNull();
    });

    it('returns single protocol unchanged when only one matched', async () => {
      const raw = makeRawProtocol();
      m.nutritionProtocol.findMany.mockResolvedValue([raw]);

      const matched = [makeMatchedProtocol()];
      const result = await mergeProtocols(matched);

      expect(result).not.toBeNull();
      expect(result!.id).toBe('proto-1');
      expect(result!.name).toBe('Standard WHO');
      expect(result!.sourceProtocols).toHaveLength(1);
      expect(result!.macroRatios.REDUCE.proteinPct).toBe(30);
    });

    it('merges macros: higher protein%, lower fat%', async () => {
      const protoA = makeRawProtocol({
        id: 'proto-a',
        name: 'Protocol A',
        macroRatios: {
          REDUCE: { proteinPct: 30, fatPct: 25, carbsPct: 45 },
          GAIN: { proteinPct: 25, fatPct: 25, carbsPct: 50 },
          MAINTAIN: { proteinPct: 25, fatPct: 30, carbsPct: 45 },
        },
      });
      const protoB = makeRawProtocol({
        id: 'proto-b',
        name: 'Protocol B',
        macroRatios: {
          REDUCE: { proteinPct: 35, fatPct: 20, carbsPct: 45 },
          GAIN: { proteinPct: 30, fatPct: 20, carbsPct: 50 },
          MAINTAIN: { proteinPct: 30, fatPct: 25, carbsPct: 45 },
        },
      });
      m.nutritionProtocol.findMany.mockResolvedValue([protoA, protoB]);

      const matched = [
        makeMatchedProtocol({ protocolId: 'proto-a', priority: 1 }),
        makeMatchedProtocol({ protocolId: 'proto-b', priority: 2, triggerId: 't2', interviewField: 'allergies', interviewValue: 'LACTOSE' }),
      ];

      const result = await mergeProtocols(matched);

      // Higher protein (max), lower fat (min)
      expect(result!.macroRatios.REDUCE.proteinPct).toBe(35);
      expect(result!.macroRatios.REDUCE.fatPct).toBe(20);
      // Carbs = 100 - protein - fat
      expect(result!.macroRatios.REDUCE.carbsPct).toBe(45);
    });

    it('merges caloric adjustments: more aggressive cut wins', async () => {
      const protoA = makeRawProtocol({
        id: 'proto-a',
        caloricAdjustments: { REDUCE: -15, GAIN: 15, MAINTAIN: 0 },
      });
      const protoB = makeRawProtocol({
        id: 'proto-b',
        caloricAdjustments: { REDUCE: -20, GAIN: 10, MAINTAIN: 0 },
      });
      m.nutritionProtocol.findMany.mockResolvedValue([protoA, protoB]);

      const matched = [
        makeMatchedProtocol({ protocolId: 'proto-a', priority: 1 }),
        makeMatchedProtocol({ protocolId: 'proto-b', priority: 2, triggerId: 't2' }),
      ];

      const result = await mergeProtocols(matched);

      expect(result!.caloricAdjustments.REDUCE).toBe(-20); // more aggressive
      expect(result!.caloricAdjustments.GAIN).toBe(10);    // less surplus
    });

    it('merges protein: lower max, higher min (more restrictive)', async () => {
      const protoA = makeRawProtocol({
        id: 'proto-a',
        minProteinPerKg: { toString: () => '0.8' },
        maxProteinPerKg: { toString: () => '2.5' },
      });
      const protoB = makeRawProtocol({
        id: 'proto-b',
        minProteinPerKg: { toString: () => '1.2' },
        maxProteinPerKg: { toString: () => '1.8' },
      });
      m.nutritionProtocol.findMany.mockResolvedValue([protoA, protoB]);

      const matched = [
        makeMatchedProtocol({ protocolId: 'proto-a', priority: 1 }),
        makeMatchedProtocol({ protocolId: 'proto-b', priority: 2, triggerId: 't2' }),
      ];

      const result = await mergeProtocols(matched);

      expect(result!.minProteinPerKg).toBe(1.2);
      expect(result!.maxProteinPerKg).toBe(1.8);
    });

    it('clamps minProtein to maxProtein when conflict', async () => {
      const protoA = makeRawProtocol({
        id: 'proto-a',
        minProteinPerKg: { toString: () => '1.5' },
        maxProteinPerKg: { toString: () => '2.5' },
      });
      const protoB = makeRawProtocol({
        id: 'proto-b',
        minProteinPerKg: { toString: () => '0.8' },
        maxProteinPerKg: { toString: () => '1.2' },
      });
      m.nutritionProtocol.findMany.mockResolvedValue([protoA, protoB]);

      const matched = [
        makeMatchedProtocol({ protocolId: 'proto-a', priority: 1 }),
        makeMatchedProtocol({ protocolId: 'proto-b', priority: 2, triggerId: 't2' }),
      ];

      const result = await mergeProtocols(matched);

      // max = min(2.5, 1.2) = 1.2, min = max(1.5, 0.8) = 1.5 → clamped to 1.2
      expect(result!.maxProteinPerKg).toBe(1.2);
      expect(result!.minProteinPerKg).toBe(1.2);
      expect(result!.mergeExplanation).toHaveProperty('proteinClamp');
    });

    it('merges food restrictions: union with highest severity', async () => {
      const protoA = makeRawProtocol({
        id: 'proto-a',
        foodRestrictions: [
          { category: 'dairy', keywords: ['milk', 'cheese'], level: 'SOFT', reason: 'preference' },
        ],
      });
      const protoB = makeRawProtocol({
        id: 'proto-b',
        foodRestrictions: [
          { category: 'dairy', keywords: ['milk', 'yogurt'], level: 'HARD_BLOCK', reason: 'allergy' },
          { category: 'nuts', keywords: ['peanut'], level: 'STRONG', reason: 'allergy' },
        ],
      });
      m.nutritionProtocol.findMany.mockResolvedValue([protoA, protoB]);

      const matched = [
        makeMatchedProtocol({ protocolId: 'proto-a', priority: 1 }),
        makeMatchedProtocol({ protocolId: 'proto-b', priority: 2, triggerId: 't2' }),
      ];

      const result = await mergeProtocols(matched);

      const dairy = result!.foodRestrictions.find((r) => r.category === 'dairy');
      const nuts = result!.foodRestrictions.find((r) => r.category === 'nuts');

      expect(dairy).toBeDefined();
      expect(dairy!.level).toBe('HARD_BLOCK'); // highest severity
      expect(dairy!.keywords).toContain('milk');
      expect(dairy!.keywords).toContain('cheese');
      expect(dairy!.keywords).toContain('yogurt');
      expect(nuts).toBeDefined();
      expect(nuts!.level).toBe('STRONG');
    });

    it('merges avoid categories: union all', async () => {
      const protoA = makeRawProtocol({
        id: 'proto-a',
        avoidFoodCategories: [{ category: 'fast_food', reason: 'health' }],
      });
      const protoB = makeRawProtocol({
        id: 'proto-b',
        avoidFoodCategories: [
          { category: 'fast_food', reason: 'health' },
          { category: 'alcohol', reason: 'liver' },
        ],
      });
      m.nutritionProtocol.findMany.mockResolvedValue([protoA, protoB]);

      const matched = [
        makeMatchedProtocol({ protocolId: 'proto-a', priority: 1 }),
        makeMatchedProtocol({ protocolId: 'proto-b', priority: 2, triggerId: 't2' }),
      ];

      const result = await mergeProtocols(matched);

      expect(result!.avoidFoodCategories).toHaveLength(2);
      expect(result!.avoidFoodCategories.map((c) => c.category)).toContain('fast_food');
      expect(result!.avoidFoodCategories.map((c) => c.category)).toContain('alcohol');
    });

    it('merges cuisines: intersection', async () => {
      const protoA = makeRawProtocol({
        id: 'proto-a',
        preferredCuisines: ['polish', 'mediterranean', 'asian'],
      });
      const protoB = makeRawProtocol({
        id: 'proto-b',
        preferredCuisines: ['polish', 'asian'],
      });
      m.nutritionProtocol.findMany.mockResolvedValue([protoA, protoB]);

      const matched = [
        makeMatchedProtocol({ protocolId: 'proto-a', priority: 1 }),
        makeMatchedProtocol({ protocolId: 'proto-b', priority: 2, triggerId: 't2' }),
      ];

      const result = await mergeProtocols(matched);

      expect(result!.preferredCuisines).toEqual(['polish', 'asian']);
    });

    it('concatenates system prompt additions', async () => {
      const protoA = makeRawProtocol({
        id: 'proto-a',
        systemPromptAdditions: 'Avoid high-GI foods',
      });
      const protoB = makeRawProtocol({
        id: 'proto-b',
        systemPromptAdditions: 'Limit sodium to 2000mg',
      });
      m.nutritionProtocol.findMany.mockResolvedValue([protoA, protoB]);

      const matched = [
        makeMatchedProtocol({ protocolId: 'proto-a', priority: 1 }),
        makeMatchedProtocol({ protocolId: 'proto-b', priority: 2, triggerId: 't2' }),
      ];

      const result = await mergeProtocols(matched);

      expect(result!.systemPromptAdditions).toContain('Avoid high-GI foods');
      expect(result!.systemPromptAdditions).toContain('Limit sodium to 2000mg');
    });

    it('dietitian override takes first position in merge order', async () => {
      const protoOverride = makeRawProtocol({
        id: 'proto-override',
        name: 'Dietitian Custom',
        macroRatios: {
          REDUCE: { proteinPct: 35, fatPct: 20, carbsPct: 45 },
          GAIN: { proteinPct: 30, fatPct: 20, carbsPct: 50 },
          MAINTAIN: { proteinPct: 30, fatPct: 25, carbsPct: 45 },
        },
      });
      const protoMatched = makeRawProtocol({
        id: 'proto-matched',
        name: 'Auto-Matched',
      });
      m.nutritionProtocol.findMany.mockResolvedValue([protoOverride, protoMatched]);

      const matched = [
        makeMatchedProtocol({ protocolId: 'proto-matched', priority: 1 }),
      ];

      const result = await mergeProtocols(matched, 'proto-override');

      expect(result!.sourceProtocols[0].id).toBe('proto-override');
      expect(result!.sourceProtocols[0].triggerField).toBe('dietitianOverride');
    });

    it('returns null when all matched protocols are inactive', async () => {
      m.nutritionProtocol.findMany.mockResolvedValue([]); // no active found

      const matched = [makeMatchedProtocol()];

      const result = await mergeProtocols(matched);

      expect(result).toBeNull();
    });

    it('tracks source protocols with trigger info', async () => {
      const raw = makeRawProtocol();
      m.nutritionProtocol.findMany.mockResolvedValue([raw]);

      const matched = [
        makeMatchedProtocol({
          interviewField: 'chronicDiseases',
          interviewValue: 'DIABETES_T2',
          priority: 1,
        }),
      ];

      const result = await mergeProtocols(matched);

      expect(result!.sourceProtocols[0]).toMatchObject({
        id: 'proto-1',
        name: 'Standard WHO',
        priority: 1,
        triggerField: 'chronicDiseases',
        triggerValue: 'DIABETES_T2',
      });
    });

    it('builds merge explanation for each override', async () => {
      const protoA = makeRawProtocol({ id: 'proto-a', name: 'Proto A' });
      const protoB = makeRawProtocol({
        id: 'proto-b',
        name: 'Proto B',
        maxProteinPerKg: { toString: () => '1.5' },
      });
      m.nutritionProtocol.findMany.mockResolvedValue([protoA, protoB]);

      const matched = [
        makeMatchedProtocol({ protocolId: 'proto-a', priority: 1 }),
        makeMatchedProtocol({ protocolId: 'proto-b', priority: 2, triggerId: 't2' }),
      ];

      const result = await mergeProtocols(matched);

      expect(result!.mergeExplanation['base']).toContain('Proto A');
      expect(result!.mergeExplanation[`macros_proto-b`]).toContain('Proto B');
      expect(result!.mergeExplanation[`maxProtein_proto-b`]).toContain('1.5');
    });
  });
});
