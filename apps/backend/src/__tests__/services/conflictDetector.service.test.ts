import { vi, describe, it, expect, beforeEach } from 'vitest';

// ── hoisted mocks ────────────────────────────────────────────────────────────
const m = vi.hoisted(() => ({
  protocolConflict: { findMany: vi.fn() },
  redisGet: vi.fn(),
  redisSet: vi.fn(),
  redisDel: vi.fn(),
}));

vi.mock('@db', () => ({
  prisma: { protocolConflict: m.protocolConflict },
  Prisma: {},
}));

vi.mock('../../utils/redis', () => ({
  redis: { get: m.redisGet, set: m.redisSet, del: m.redisDel },
}));

// ── imports ──────────────────────────────────────────────────────────────────
import {
  detectConflicts,
  invalidateConflictCache,
} from '../../services/conflictDetector.service';

// ── helpers ──────────────────────────────────────────────────────────────────
const makeConflictRow = (overrides = {}) => ({
  id: 'conflict-1',
  triggerAField: 'mainGoal',
  triggerAValue: 'BUILD_MUSCLE',
  triggerBField: 'chronicDiseases',
  triggerBValue: 'CKD_4_5',
  severity: 'BLOCK',
  messageKey: 'conflicts.renal_mass',
  winnerSide: 'B',
  isActive: true,
  ...overrides,
});

// ── tests ────────────────────────────────────────────────────────────────────
describe('conflictDetector.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.redisGet.mockResolvedValue(null);
    m.redisSet.mockResolvedValue('OK');
  });

  describe('detectConflicts()', () => {
    it('returns empty when no conflict definitions exist', async () => {
      m.protocolConflict.findMany.mockResolvedValue([]);

      const result = await detectConflicts({
        mainGoal: 'BUILD_MUSCLE',
        chronicDiseases: ['CKD_4_5'],
      });

      expect(result.conflicts).toHaveLength(0);
      expect(result.hasBlockingConflict).toBe(false);
    });

    it('returns empty when no conflict matches', async () => {
      m.protocolConflict.findMany.mockResolvedValue([makeConflictRow()]);

      const result = await detectConflicts({
        mainGoal: 'REDUCE',
        chronicDiseases: ['DIABETES_T2'],
      });

      expect(result.conflicts).toHaveLength(0);
      expect(result.hasBlockingConflict).toBe(false);
    });

    it('detects BLOCK conflict (scalar + array)', async () => {
      m.protocolConflict.findMany.mockResolvedValue([makeConflictRow()]);

      const result = await detectConflicts({
        mainGoal: 'BUILD_MUSCLE',
        chronicDiseases: ['CKD_4_5'],
      });

      expect(result.conflicts).toHaveLength(1);
      expect(result.hasBlockingConflict).toBe(true);
      expect(result.conflicts[0]).toMatchObject({
        conflictId: 'conflict-1',
        severity: 'BLOCK',
        triggerAValue: 'BUILD_MUSCLE',
        triggerBValue: 'CKD_4_5',
        winnerSide: 'B',
      });
    });

    it('detects WARN conflict', async () => {
      m.protocolConflict.findMany.mockResolvedValue([
        makeConflictRow({
          id: 'conflict-warn',
          triggerAValue: 'BUILD_MUSCLE',
          triggerBValue: 'DIABETES_T2',
          severity: 'WARN',
          messageKey: 'conflicts.muscle_diabetes',
        }),
      ]);

      const result = await detectConflicts({
        mainGoal: 'BUILD_MUSCLE',
        chronicDiseases: ['DIABETES_T2'],
      });

      expect(result.conflicts).toHaveLength(1);
      expect(result.hasBlockingConflict).toBe(false);
      expect(result.conflicts[0].severity).toBe('WARN');
    });

    it('detects multiple conflicts at once', async () => {
      m.protocolConflict.findMany.mockResolvedValue([
        makeConflictRow({
          id: 'c1',
          triggerAValue: 'BUILD_MUSCLE',
          triggerBValue: 'CKD_4_5',
          severity: 'BLOCK',
        }),
        makeConflictRow({
          id: 'c2',
          triggerAField: 'dietType',
          triggerAValue: 'KETO',
          triggerBField: 'chronicDiseases',
          triggerBValue: 'CKD_4_5',
          severity: 'BLOCK',
          messageKey: 'conflicts.keto_renal',
        }),
      ]);

      const result = await detectConflicts({
        mainGoal: 'BUILD_MUSCLE',
        dietType: 'KETO',
        chronicDiseases: ['CKD_4_5'],
      });

      expect(result.conflicts).toHaveLength(2);
      expect(result.hasBlockingConflict).toBe(true);
    });

    it('requires both sides to be present for conflict', async () => {
      m.protocolConflict.findMany.mockResolvedValue([makeConflictRow()]);

      // Only side A present (BUILD_MUSCLE) — no conflict
      const result = await detectConflicts({
        mainGoal: 'BUILD_MUSCLE',
        chronicDiseases: ['DIABETES_T2'], // not CKD_4_5
      });

      expect(result.conflicts).toHaveLength(0);
    });

    it('matches array values correctly (both sides)', async () => {
      m.protocolConflict.findMany.mockResolvedValue([
        makeConflictRow({
          triggerAField: 'chronicDiseases',
          triggerAValue: 'EATING_DISORDER_ANOREXIA',
          triggerBField: 'chronicDiseases',
          triggerBValue: 'CKD_4_5',
          severity: 'BLOCK',
        }),
      ]);

      const result = await detectConflicts({
        chronicDiseases: ['EATING_DISORDER_ANOREXIA', 'CKD_4_5'],
      });

      expect(result.conflicts).toHaveLength(1);
    });

    it('ignores null, undefined, empty string, and "none" values', async () => {
      m.protocolConflict.findMany.mockResolvedValue([makeConflictRow()]);

      const result = await detectConflicts({
        mainGoal: null,
        chronicDiseases: ['none', ''],
      });

      expect(result.conflicts).toHaveLength(0);
    });

    it('hasBlockingConflict is false when only WARN conflicts exist', async () => {
      m.protocolConflict.findMany.mockResolvedValue([
        makeConflictRow({ severity: 'WARN' }),
      ]);

      const result = await detectConflicts({
        mainGoal: 'BUILD_MUSCLE',
        chronicDiseases: ['CKD_4_5'],
      });

      expect(result.hasBlockingConflict).toBe(false);
    });

    it('uses cached conflicts when available', async () => {
      const cached = [
        {
          id: 'c-cached',
          triggerAField: 'mainGoal',
          triggerAValue: 'BUILD_MUSCLE',
          triggerBField: 'chronicDiseases',
          triggerBValue: 'CKD_4_5',
          severity: 'BLOCK',
          messageKey: 'conflicts.renal_mass',
          winnerSide: 'B',
        },
      ];
      m.redisGet.mockResolvedValue(JSON.stringify(cached));

      const result = await detectConflicts({
        mainGoal: 'BUILD_MUSCLE',
        chronicDiseases: ['CKD_4_5'],
      });

      expect(result.conflicts).toHaveLength(1);
      expect(m.protocolConflict.findMany).not.toHaveBeenCalled();
    });

    it('falls back to DB when Redis unavailable', async () => {
      m.redisGet.mockRejectedValue(new Error('Redis down'));
      m.redisSet.mockRejectedValue(new Error('Redis down'));
      m.protocolConflict.findMany.mockResolvedValue([makeConflictRow()]);

      const result = await detectConflicts({
        mainGoal: 'BUILD_MUSCLE',
        chronicDiseases: ['CKD_4_5'],
      });

      expect(result.conflicts).toHaveLength(1);
      expect(m.protocolConflict.findMany).toHaveBeenCalled();
    });
  });

  describe('invalidateConflictCache()', () => {
    it('deletes cache key', async () => {
      m.redisDel.mockResolvedValue(1);

      await invalidateConflictCache();

      expect(m.redisDel).toHaveBeenCalledWith('protocol-conflicts:active');
    });

    it('does not throw when Redis unavailable', async () => {
      m.redisDel.mockRejectedValue(new Error('Redis down'));

      await expect(invalidateConflictCache()).resolves.toBeUndefined();
    });
  });
});
