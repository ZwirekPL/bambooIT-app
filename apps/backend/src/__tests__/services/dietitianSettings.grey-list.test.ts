/**
 * Z1 — Grey-list service unit tests.
 *
 * Verifies:
 *   1. `getGreyListWindow` clamps to [0, 4] and respects the lookup order
 *      (dietitian profile → AppSettings → default 1).
 *   2. `getGreyListRecipeIds` reads `policyMetadata.recipeIds` from the
 *      patient's most recent N plans, deduplicates IDs across them,
 *      filters out non-customer-visible statuses, and respects
 *      `excludePlanId`.
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';

const m = vi.hoisted(() => ({
  dietitianProfile: { findUnique: vi.fn() },
  dietPlan: { findMany: vi.fn() },
  appSettings: { findUnique: vi.fn() },
}));

vi.mock('@db', () => ({
  prisma: {
    dietitianProfile: m.dietitianProfile,
    dietPlan: m.dietPlan,
    appSettings: m.appSettings,
  },
  Prisma: {},
}));

import {
  DEFAULT_GREY_LIST_WINDOW,
  GREY_LIST_WINDOW_MAX,
  getGreyListWindow,
  getGreyListRecipeIds,
} from '../../services/dietitianSettings.service';

describe('dietitianSettings — grey list', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.appSettings.findUnique.mockResolvedValue(null);
    m.dietitianProfile.findUnique.mockResolvedValue(null);
    m.dietPlan.findMany.mockResolvedValue([]);
  });

  describe('getGreyListWindow', () => {
    it('returns DEFAULT (1) when no dietitian + no global setting', async () => {
      const w = await getGreyListWindow();
      expect(w).toBe(DEFAULT_GREY_LIST_WINDOW);
      expect(m.dietitianProfile.findUnique).not.toHaveBeenCalled();
    });

    it('returns dietitian profile value when present', async () => {
      m.dietitianProfile.findUnique.mockResolvedValueOnce({ greyListWindow: 3 });
      const w = await getGreyListWindow('user-123');
      expect(w).toBe(3);
      expect(m.appSettings.findUnique).not.toHaveBeenCalled();
    });

    it('falls back to AppSettings global when dietitian profile missing', async () => {
      m.dietitianProfile.findUnique.mockResolvedValueOnce(null);
      m.appSettings.findUnique.mockResolvedValueOnce({ value: 2, key: 'grey_list_window', updatedAt: new Date() });
      const w = await getGreyListWindow('user-456');
      expect(w).toBe(2);
    });

    it('clamps values above the max (4)', async () => {
      m.dietitianProfile.findUnique.mockResolvedValueOnce({ greyListWindow: 99 });
      const w = await getGreyListWindow('user-clamp');
      expect(w).toBe(GREY_LIST_WINDOW_MAX);
    });

    it('clamps negative values to 0 (disabled)', async () => {
      m.dietitianProfile.findUnique.mockResolvedValueOnce({ greyListWindow: -5 });
      const w = await getGreyListWindow('user-neg');
      expect(w).toBe(0);
    });

    it('treats NaN/non-numeric global as the hard-coded default', async () => {
      m.dietitianProfile.findUnique.mockResolvedValueOnce(null);
      m.appSettings.findUnique.mockResolvedValueOnce({ value: 'banana', key: 'grey_list_window', updatedAt: new Date() });
      const w = await getGreyListWindow('user-nan');
      expect(w).toBe(DEFAULT_GREY_LIST_WINDOW);
    });
  });

  describe('getGreyListRecipeIds', () => {
    it('returns empty Set when window=0 (feature disabled, no DB hit)', async () => {
      const ids = await getGreyListRecipeIds('patient-1', 0);
      expect(ids.size).toBe(0);
      expect(m.dietPlan.findMany).not.toHaveBeenCalled();
    });

    it('returns empty Set when patient has no prior plans', async () => {
      m.dietPlan.findMany.mockResolvedValueOnce([]);
      const ids = await getGreyListRecipeIds('patient-2', 1);
      expect(ids.size).toBe(0);
    });

    it('deduplicates recipe IDs across multiple plans', async () => {
      m.dietPlan.findMany.mockResolvedValueOnce([
        { policyMetadata: { recipeIds: ['r-a', 'r-b', 'r-c'] } },
        { policyMetadata: { recipeIds: ['r-b', 'r-d'] } }, // r-b is duplicate
      ]);
      const ids = await getGreyListRecipeIds('patient-3', 2);
      expect(ids.size).toBe(4);
      expect(ids.has('r-a')).toBe(true);
      expect(ids.has('r-b')).toBe(true);
      expect(ids.has('r-c')).toBe(true);
      expect(ids.has('r-d')).toBe(true);
    });

    it('passes the requested window to findMany.take', async () => {
      m.dietPlan.findMany.mockResolvedValueOnce([]);
      await getGreyListRecipeIds('patient-4', 3);
      expect(m.dietPlan.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 3 }),
      );
    });

    it('forwards excludePlanId as id != filter', async () => {
      m.dietPlan.findMany.mockResolvedValueOnce([]);
      await getGreyListRecipeIds('patient-5', 1, 'plan-current');
      const call = m.dietPlan.findMany.mock.calls[0][0];
      expect(call.where).toMatchObject({ id: { not: 'plan-current' } });
    });

    it('skips malformed policyMetadata entries (string, null, missing recipeIds)', async () => {
      m.dietPlan.findMany.mockResolvedValueOnce([
        { policyMetadata: null },
        { policyMetadata: { recipeIds: 'not-an-array' } },
        { policyMetadata: { recipeIds: ['r-real', 42, null, 'r-also-real'] } }, // bad entries filtered
      ]);
      const ids = await getGreyListRecipeIds('patient-6', 3);
      expect(ids.size).toBe(2);
      expect(ids.has('r-real')).toBe(true);
      expect(ids.has('r-also-real')).toBe(true);
    });

    it('filters by customer-visible plan statuses (no AI_DRAFT)', async () => {
      m.dietPlan.findMany.mockResolvedValueOnce([]);
      await getGreyListRecipeIds('patient-7', 1);
      const call = m.dietPlan.findMany.mock.calls[0][0];
      expect(call.where.status.in).toEqual(
        expect.arrayContaining(['GENERATED', 'REVIEWED', 'PUBLISHED', 'SENT', 'MANUAL_REVIEW_REQUIRED']),
      );
      // AI_DRAFT must NOT be in the list — that would pollute grey list with
      // throwaway drafts that the patient never saw.
      expect(call.where.status.in).not.toContain('AI_DRAFT');
    });
  });
});
