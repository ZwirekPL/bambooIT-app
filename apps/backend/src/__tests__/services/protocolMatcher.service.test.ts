import { vi, describe, it, expect, beforeEach } from 'vitest';

// ── hoisted mocks ────────────────────────────────────────────────────────────
const m = vi.hoisted(() => ({
  protocolTrigger: { findMany: vi.fn() },
  redisGet: vi.fn(),
  redisSet: vi.fn(),
  redisDel: vi.fn(),
}));

vi.mock('@db', () => ({
  prisma: { protocolTrigger: m.protocolTrigger },
  Prisma: {},
}));

vi.mock('../../utils/redis', () => ({
  redis: { get: m.redisGet, set: m.redisSet, del: m.redisDel },
}));

// ── imports ──────────────────────────────────────────────────────────────────
import {
  matchProtocolsFromInterview,
  invalidateTriggerCache,
} from '../../services/protocolMatcher.service';

// ── helpers ──────────────────────────────────────────────────────────────────
const makeTriggerRow = (overrides = {}) => ({
  id: 'trigger-1',
  interviewField: 'mainGoal',
  interviewValue: 'REDUCE',
  protocolId: 'proto-1',
  priority: 3,
  score: 1.0,
  isActive: true,
  protocol: { name: 'Redukcja', isActive: true },
  ...overrides,
});

// ── tests ────────────────────────────────────────────────────────────────────
describe('protocolMatcher.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: no cache
    m.redisGet.mockResolvedValue(null);
    m.redisSet.mockResolvedValue('OK');
  });

  describe('matchProtocolsFromInterview()', () => {
    it('returns empty when no triggers exist', async () => {
      m.protocolTrigger.findMany.mockResolvedValue([]);

      const result = await matchProtocolsFromInterview({ mainGoal: 'REDUCE' });

      expect(result.matchedProtocols).toHaveLength(0);
    });

    it('matches scalar field (mainGoal)', async () => {
      m.protocolTrigger.findMany.mockResolvedValue([
        makeTriggerRow(),
      ]);

      const result = await matchProtocolsFromInterview({ mainGoal: 'REDUCE' });

      expect(result.matchedProtocols).toHaveLength(1);
      expect(result.matchedProtocols[0]).toMatchObject({
        protocolId: 'proto-1',
        protocolName: 'Redukcja',
        interviewField: 'mainGoal',
        interviewValue: 'REDUCE',
        priority: 3,
      });
    });

    it('matches array field (chronicDiseases)', async () => {
      m.protocolTrigger.findMany.mockResolvedValue([
        makeTriggerRow({
          id: 'trigger-d',
          interviewField: 'chronicDiseases',
          interviewValue: 'DIABETES_T2',
          protocolId: 'proto-diab',
          priority: 1,
          protocol: { name: 'Cukrzyca T2', isActive: true },
        }),
      ]);

      const result = await matchProtocolsFromInterview({
        chronicDiseases: ['DIABETES_T2', 'HYPERTENSION'],
      });

      expect(result.matchedProtocols).toHaveLength(1);
      expect(result.matchedProtocols[0].protocolId).toBe('proto-diab');
    });

    it('matches multiple triggers from different fields', async () => {
      m.protocolTrigger.findMany.mockResolvedValue([
        makeTriggerRow({
          id: 'trigger-goal',
          interviewField: 'mainGoal',
          interviewValue: 'REDUCE',
          protocolId: 'proto-reduce',
          priority: 3,
          protocol: { name: 'Redukcja', isActive: true },
        }),
        makeTriggerRow({
          id: 'trigger-disease',
          interviewField: 'chronicDiseases',
          interviewValue: 'DIABETES_T2',
          protocolId: 'proto-diab',
          priority: 1,
          protocol: { name: 'Cukrzyca T2', isActive: true },
        }),
      ]);

      const result = await matchProtocolsFromInterview({
        mainGoal: 'REDUCE',
        chronicDiseases: ['DIABETES_T2'],
      });

      expect(result.matchedProtocols).toHaveLength(2);
      // Sorted by priority: disease (1) before goal (3)
      expect(result.matchedProtocols[0].protocolId).toBe('proto-diab');
      expect(result.matchedProtocols[1].protocolId).toBe('proto-reduce');
    });

    it('deduplicates by protocolId, keeping highest priority', async () => {
      m.protocolTrigger.findMany.mockResolvedValue([
        makeTriggerRow({
          id: 'trigger-a',
          interviewField: 'chronicDiseases',
          interviewValue: 'DIABETES_T2',
          protocolId: 'proto-1',
          priority: 1,
          protocol: { name: 'Cukrzyca T2', isActive: true },
        }),
        makeTriggerRow({
          id: 'trigger-b',
          interviewField: 'mainGoal',
          interviewValue: 'REDUCE',
          protocolId: 'proto-1',
          priority: 3,
          protocol: { name: 'Cukrzyca T2', isActive: true },
        }),
      ]);

      const result = await matchProtocolsFromInterview({
        mainGoal: 'REDUCE',
        chronicDiseases: ['DIABETES_T2'],
      });

      expect(result.matchedProtocols).toHaveLength(1);
      expect(result.matchedProtocols[0].priority).toBe(1);
    });

    it('filters out inactive protocols', async () => {
      m.protocolTrigger.findMany.mockResolvedValue([
        makeTriggerRow({
          protocol: { name: 'Inactive', isActive: false },
        }),
      ]);

      const result = await matchProtocolsFromInterview({ mainGoal: 'REDUCE' });

      expect(result.matchedProtocols).toHaveLength(0);
    });

    it('ignores "none" values in arrays', async () => {
      m.protocolTrigger.findMany.mockResolvedValue([
        makeTriggerRow({
          interviewField: 'allergies',
          interviewValue: 'none',
          protocolId: 'proto-none',
          protocol: { name: 'None Protocol', isActive: true },
        }),
      ]);

      const result = await matchProtocolsFromInterview({
        allergies: ['none'],
      });

      expect(result.matchedProtocols).toHaveLength(0);
    });

    it('ignores empty string values', async () => {
      m.protocolTrigger.findMany.mockResolvedValue([
        makeTriggerRow(),
      ]);

      const result = await matchProtocolsFromInterview({ mainGoal: '' });

      expect(result.matchedProtocols).toHaveLength(0);
    });

    it('reports unmatched fields', async () => {
      m.protocolTrigger.findMany.mockResolvedValue([]);

      const result = await matchProtocolsFromInterview({
        mainGoal: 'REDUCE',
        dietType: 'VEGAN',
      });

      expect(result.unmatchedFields).toContain('mainGoal');
      expect(result.unmatchedFields).toContain('dietType');
    });

    it('does not report matched fields as unmatched', async () => {
      m.protocolTrigger.findMany.mockResolvedValue([
        makeTriggerRow(),
      ]);

      const result = await matchProtocolsFromInterview({
        mainGoal: 'REDUCE',
        dietType: 'VEGAN',
      });

      expect(result.unmatchedFields).not.toContain('mainGoal');
      expect(result.unmatchedFields).toContain('dietType');
    });

    it('sorts by priority first, then by score descending', async () => {
      m.protocolTrigger.findMany.mockResolvedValue([
        makeTriggerRow({
          id: 't1',
          interviewField: 'mainGoal',
          interviewValue: 'REDUCE',
          protocolId: 'proto-goal',
          priority: 3,
          score: 0.9,
          protocol: { name: 'Goal', isActive: true },
        }),
        makeTriggerRow({
          id: 't2',
          interviewField: 'allergies',
          interviewValue: 'LACTOSE',
          protocolId: 'proto-allergy',
          priority: 2,
          score: 0.5,
          protocol: { name: 'Allergy', isActive: true },
        }),
        makeTriggerRow({
          id: 't3',
          interviewField: 'chronicDiseases',
          interviewValue: 'DIABETES_T2',
          protocolId: 'proto-disease',
          priority: 1,
          score: 1.0,
          protocol: { name: 'Disease', isActive: true },
        }),
      ]);

      const result = await matchProtocolsFromInterview({
        mainGoal: 'REDUCE',
        allergies: ['LACTOSE'],
        chronicDiseases: ['DIABETES_T2'],
      });

      expect(result.matchedProtocols.map((p) => p.priority)).toEqual([1, 2, 3]);
    });

    it('uses cached triggers when available', async () => {
      const cached = [
        {
          id: 'trigger-cached',
          interviewField: 'mainGoal',
          interviewValue: 'REDUCE',
          protocolId: 'proto-1',
          protocolName: 'Redukcja',
          priority: 3,
          score: 1.0,
        },
      ];
      m.redisGet.mockResolvedValue(JSON.stringify(cached));

      const result = await matchProtocolsFromInterview({ mainGoal: 'REDUCE' });

      expect(result.matchedProtocols).toHaveLength(1);
      expect(m.protocolTrigger.findMany).not.toHaveBeenCalled();
    });

    it('falls back to DB when Redis is unavailable', async () => {
      m.redisGet.mockRejectedValue(new Error('Redis down'));
      m.redisSet.mockRejectedValue(new Error('Redis down'));
      m.protocolTrigger.findMany.mockResolvedValue([makeTriggerRow()]);

      const result = await matchProtocolsFromInterview({ mainGoal: 'REDUCE' });

      expect(result.matchedProtocols).toHaveLength(1);
      expect(m.protocolTrigger.findMany).toHaveBeenCalled();
    });
  });

  describe('invalidateTriggerCache()', () => {
    it('deletes cache key', async () => {
      m.redisDel.mockResolvedValue(1);

      await invalidateTriggerCache();

      expect(m.redisDel).toHaveBeenCalledWith('protocol-triggers:active');
    });

    it('does not throw when Redis is unavailable', async () => {
      m.redisDel.mockRejectedValue(new Error('Redis down'));

      await expect(invalidateTriggerCache()).resolves.toBeUndefined();
    });
  });
});
