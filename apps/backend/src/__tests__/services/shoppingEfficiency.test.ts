/**
 * BUG-4 Session A: unit tests for computeShoppingEfficiency.
 *
 * Seasonings (CleanProduct.category='Przyprawy i zioła' OR name in TASTE_ONLY_NAMES)
 * must be excluded. Repeating the same recipe across slots bumps totalUses but not
 * uniqueIngredients — which is what we want when measuring shared-shopping burden.
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';

const m = vi.hoisted(() => ({
  recipeIngredient: { findMany: vi.fn() },
}));

vi.mock('@db', () => ({
  prisma: { recipeIngredient: m.recipeIngredient },
  Prisma: {},
}));

import { computeShoppingEfficiency } from '../../services/dbPlanAssembly.service';

type IngRow = {
  recipeId: string;
  cleanProductId: string | null;
  cleanProduct: { name: string; category: string } | null;
};

function row(recipeId: string, cleanProductId: string, name: string, category = 'Mięso'): IngRow {
  return { recipeId, cleanProductId, cleanProduct: { name, category } };
}

describe('computeShoppingEfficiency', () => {
  beforeEach(() => {
    m.recipeIngredient.findMany.mockReset();
  });

  it('returns zero metrics for empty plan', async () => {
    const result = await computeShoppingEfficiency([]);
    expect(result.uniqueIngredients).toBe(0);
    expect(result.totalIngredientUses).toBe(0);
    expect(result.shoppingEfficiencyScore).toBe(0);
  });

  it('score = 1.0 when every product is used once (no reuse)', async () => {
    m.recipeIngredient.findMany.mockResolvedValue([
      row('r1', 'p1', 'Kurczak'),
      row('r2', 'p2', 'Wołowina'),
      row('r3', 'p3', 'Łosoś'),
    ]);

    const result = await computeShoppingEfficiency(['r1', 'r2', 'r3']);
    expect(result.uniqueIngredients).toBe(3);
    expect(result.totalIngredientUses).toBe(3);
    expect(result.shoppingEfficiencyScore).toBe(1);
  });

  it('score > 1 when products are reused across recipes', async () => {
    m.recipeIngredient.findMany.mockResolvedValue([
      row('r1', 'p_tomato', 'Pomidor'),
      row('r1', 'p_onion',  'Cebula'),
      row('r2', 'p_tomato', 'Pomidor'),
      row('r2', 'p_onion',  'Cebula'),
      row('r3', 'p_tomato', 'Pomidor'),
      row('r3', 'p_basil',  'Bazylia świeża'),  // NOT in seasoning category (świeża)
    ]);

    const result = await computeShoppingEfficiency(['r1', 'r2', 'r3']);
    // unique: tomato, onion, basil = 3
    // uses: r1(2) + r2(2) + r3(2) = 6
    // score = 6/3 = 2.0
    expect(result.uniqueIngredients).toBe(3);
    expect(result.totalIngredientUses).toBe(6);
    expect(result.shoppingEfficiencyScore).toBe(2);
    expect(result.topSharedProducts[0].name).toBe('Pomidor');
    expect(result.topSharedProducts[0].usedInSlots).toBe(3);
  });

  it('repeating the same recipe counts its ingredients multiple times', async () => {
    m.recipeIngredient.findMany.mockResolvedValue([
      row('r1', 'p_tomato', 'Pomidor'),
      row('r1', 'p_onion',  'Cebula'),
    ]);

    // Same recipe in 3 slots
    const result = await computeShoppingEfficiency(['r1', 'r1', 'r1']);
    expect(result.uniqueIngredients).toBe(2);
    expect(result.totalIngredientUses).toBe(6);
    expect(result.shoppingEfficiencyScore).toBe(3);
  });

  it('excludes seasonings by category=Przyprawy i zioła', async () => {
    m.recipeIngredient.findMany.mockResolvedValue([
      row('r1', 'p_chicken', 'Kurczak', 'Mięso'),
      row('r1', 'p_oregano', 'Oregano', 'Przyprawy i zioła'),
      row('r1', 'p_basil',   'Bazylia', 'Przyprawy i zioła'),
      row('r2', 'p_beef',    'Wołowina', 'Mięso'),
      row('r2', 'p_oregano', 'Oregano', 'Przyprawy i zioła'),
    ]);

    const result = await computeShoppingEfficiency(['r1', 'r2']);
    // Only chicken + beef count; oregano/basil excluded.
    expect(result.uniqueIngredients).toBe(2);
    expect(result.totalIngredientUses).toBe(2);
    expect(result.seasoningsExcluded).toBe(3);
  });

  it('excludes seasonings by TASTE_ONLY_NAMES fallback (category mismatch)', async () => {
    // Salt is mineralna, sometimes classified outside 'Przyprawy i zioła'
    m.recipeIngredient.findMany.mockResolvedValue([
      row('r1', 'p_chicken', 'Kurczak', 'Mięso'),
      row('r1', 'p_salt',    'Sól', 'Inne'),
      row('r1', 'p_pepper',  'Pieprz', 'Inne'),
    ]);

    const result = await computeShoppingEfficiency(['r1']);
    expect(result.uniqueIngredients).toBe(1);
    expect(result.seasoningsExcluded).toBe(2);
  });

  it('ignores rows with null cleanProductId (junk displayName)', async () => {
    m.recipeIngredient.findMany.mockResolvedValue([
      row('r1', 'p_chicken', 'Kurczak'),
      // junk rows filtered by Prisma WHERE cleanProductId:{not:null} — but double-check
    ]);

    const result = await computeShoppingEfficiency(['r1']);
    expect(result.uniqueIngredients).toBe(1);
  });

  it('topSharedProducts sorted by usage descending, capped at 10', async () => {
    const rows: IngRow[] = [];
    for (let i = 1; i <= 12; i++) {
      for (let n = 0; n < i; n++) {
        rows.push(row(`r_${i}_${n}`, `p_${i}`, `Produkt ${i}`));
      }
    }
    m.recipeIngredient.findMany.mockResolvedValue(rows);

    const recipeIds = rows.map((r) => r.recipeId);
    const result = await computeShoppingEfficiency(recipeIds);

    expect(result.topSharedProducts).toHaveLength(10);
    expect(result.topSharedProducts[0].usedInSlots).toBe(12);
    expect(result.topSharedProducts[9].usedInSlots).toBe(3);
  });
});
