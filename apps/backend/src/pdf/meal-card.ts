// ─── Meal card renderer ───────────────────────────────────────────────────────
//
// Renders a single meal as a styled card with:
//   - Meal type label + dish name
//   - Portion size + calories
//   - Macronutrient breakdown (B/T/W)

import type { Meal, MealItem } from './types';
import { COLORS, LAYOUT } from './types';
import { drawRoundedBox, ensureSpace } from './pdf-helpers';

const { margin, contentWidth } = LAYOUT;

const CARD_PADDING = 14;
const CARD_INNER = contentWidth - 2 * CARD_PADDING;

/**
 * Faza D Phase 1 W2-Thu: returns every structured (non-string) MealItem
 * in the meal. Compose-mode slots (LUNCH/DINNER ≥18% kcal) carry 1-3
 * items (main + carb_side + veg_side); legacy / single-item slots return
 * a 1-element array. Replaces the previous `items[0]`-only helper.
 *
 * Exported for unit testing of the aggregation pipeline that drives both
 * the per-card "Porcja / kcal / Białko / Tłuszcze / Węglowodany" totals
 * and the day-summary in `diet-plan-template.ts:renderDayPage`.
 */
export function getMealItems(meal: Meal): MealItem[] {
  if (!meal.items || meal.items.length === 0) return [];
  return meal.items.filter((it): it is MealItem => typeof it !== 'string');
}

/** Sum kcal/protein/fat/carbs/grams across items (skipping nulls). */
export function aggregateItems(items: MealItem[]): {
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
  grams: number;
} {
  return items.reduce(
    (acc, it) => ({
      kcal:    acc.kcal    + (it.kcal ?? 0),
      protein: acc.protein + (it.protein ?? 0),
      fat:     acc.fat     + (it.fat ?? 0),
      carbs:   acc.carbs   + (it.carbs ?? 0),
      grams:   acc.grams   + (it.grams ?? 0),
    }),
    { kcal: 0, protein: 0, fat: 0, carbs: 0, grams: 0 },
  );
}

function fallbackMealType(name: string, index: number): string {
  const lower = name.toLowerCase().trim();
  if (lower.includes('śniadanie') || lower.includes('breakfast')) {
    if (lower.includes('drug') || lower.includes('ii') || lower.includes('second')) return 'II ŚNIADANIE';
    return 'ŚNIADANIE';
  }
  if (lower.includes('obiad') || lower.includes('lunch')) return 'OBIAD';
  if (lower.includes('kolacja') || lower.includes('dinner') || lower.includes('supper')) return 'KOLACJA';
  if (lower.includes('przekąsk') || lower.includes('snack') || lower.includes('posiłek')) return 'PRZEKĄSKA';
  const fallback = ['ŚNIADANIE', 'OBIAD', 'PRZEKĄSKA', 'KOLACJA'];
  return fallback[index] ?? 'POSIŁEK';
}

export function renderMealCard(
  doc: PDFKit.PDFDocument,
  meal: Meal,
  mealIndex: number,
): void {
  const items = getMealItems(meal);
  const itemCount = items.length;
  // Compose mode: ≥2 structured items → main + carb_side(s) + veg_side(s).
  // Item ordering is solver-guaranteed: items[0] is the MAIN.
  const isComposed = itemCount >= 2;
  const item = items[0] ?? null;
  const hasItem = item !== null;

  // Calculate dynamic card height. Compose mode adds one breakdown row per
  // side element under the main dish name (each row ~14px).
  const nameLineH = 18;
  const macroBlockH = hasItem ? 44 : 0;
  const composeBreakdownH = isComposed ? (itemCount - 1) * 14 + 4 : 0;
  const fallbackItemsH = !hasItem ? meal.items.length * 14 + 4 : 0;
  const cardH = 12 + nameLineH + composeBreakdownH + macroBlockH + fallbackItemsH + 8;

  ensureSpace(doc, cardH + 6);

  const y = doc.y;
  const mealType = meal._type ? meal._type.toUpperCase() : fallbackMealType(meal.name, mealIndex);

  // ─── Card background + border ─────────────────────────────────────────────
  drawRoundedBox(doc, margin, y, contentWidth, cardH, {
    fill: COLORS.white, stroke: COLORS.border, radius: 8,
  });

  // Left accent bar
  doc.save();
  doc.roundedRect(margin, y, 5, cardH, 3).clip();
  doc.rect(margin, y, 5, cardH).fillColor(COLORS.primary).fill();
  doc.restore();

  // ─── Meal type label ──────────────────────────────────────────────────────
  const labelX = margin + CARD_PADDING + 4;
  const labelY = y + 10;

  doc.font('Bold').fontSize(9).fillColor(COLORS.primaryLight)
    .text(mealType, labelX, labelY, { width: CARD_INNER });

  // ─── Dish name ────────────────────────────────────────────────────────────
  const dishName = meal.name;
  doc.font('Bold').fontSize(12).fillColor(COLORS.dark)
    .text(dishName, labelX, labelY + 16, { width: CARD_INNER - 140 });

  // ─── Portion + Kcal (right side) ──────────────────────────────────────────
  if (hasItem) {
    const totals = aggregateItems(items);
    const displayGrams = isComposed ? totals.grams : (item.grams ?? 0);
    const displayKcal = isComposed ? totals.kcal : (item.kcal ?? 0);

    const rightX = margin + contentWidth - CARD_PADDING - 130;

    if (displayGrams) {
      doc.font('Regular').fontSize(9).fillColor(COLORS.muted)
        .text(`Porcja: ${Math.round(displayGrams)}g`, rightX, labelY, { width: 120, align: 'right' });
    }

    if (displayKcal) {
      doc.font('Bold').fontSize(13).fillColor(COLORS.accentKcal)
        .text(`${Math.round(displayKcal)}`, rightX, labelY + 14, { width: 90, align: 'right' });
      doc.font('Regular').fontSize(9).fillColor(COLORS.muted)
        .text('kcal', rightX + 90, labelY + 17, { width: 30, align: 'right' });
    }

    // ─── Compose breakdown — per-element line for sides ──────────────────
    if (isComposed) {
      let lineY = labelY + nameLineH + 16;
      // Skip items[0] (the main — its name is the dish title). Render
      // sides as bullet rows: "• Ryż biały — 150g · 200 kcal"
      for (let i = 1; i < items.length; i++) {
        const side = items[i];
        if (!side) continue;
        const grams = side.grams ? `${Math.round(side.grams)}g` : null;
        const kcal = side.kcal ? `${Math.round(side.kcal)} kcal` : null;
        const detail = [grams, kcal].filter((p) => p !== null).join(' · ');
        const text = detail ? `+ ${side.name} — ${detail}` : `+ ${side.name}`;
        doc.font('Regular').fontSize(9).fillColor(COLORS.muted)
          .text(text, labelX, lineY, { width: CARD_INNER });
        lineY += 14;
      }
    }

    // ─── Macros row (aggregated when composed) ────────────────────────────
    const macroY = y + cardH - macroBlockH + 2;

    // Subtle separator line above macros
    doc.moveTo(margin + CARD_PADDING + 4, macroY)
      .lineTo(margin + contentWidth - CARD_PADDING, macroY)
      .strokeColor(COLORS.borderLight)
      .lineWidth(0.5)
      .stroke();

    const macros = isComposed
      ? [
          { label: 'Białko', value: Math.round(totals.protein * 10) / 10, color: COLORS.accentProtein },
          { label: 'Tłuszcze', value: Math.round(totals.fat * 10) / 10, color: COLORS.accentFat },
          { label: 'Węglowodany', value: Math.round(totals.carbs * 10) / 10, color: COLORS.accentCarbs },
        ]
      : [
          { label: 'Białko', value: item.protein, color: COLORS.accentProtein },
          { label: 'Tłuszcze', value: item.fat, color: COLORS.accentFat },
          { label: 'Węglowodany', value: item.carbs, color: COLORS.accentCarbs },
        ];

    let mx = labelX;
    for (const m of macros) {
      if (m.value == null) continue;

      // Colored dot
      doc.circle(mx + 4, macroY + 18, 3.5).fillColor(m.color).fill();

      doc.font('Regular').fontSize(8).fillColor(COLORS.muted)
        .text(m.label, mx + 11, macroY + 10, { width: 80 });

      doc.font('Bold').fontSize(11).fillColor(COLORS.dark)
        .text(`${m.value}g`, mx + 11, macroY + 22, { width: 80 });

      mx += 120;
    }
  } else {
    // Fallback: render items as text list
    let textY = labelY + nameLineH + 4;
    for (const it of meal.items) {
      const text = typeof it === 'string' ? it : it.name;
      doc.font('Regular').fontSize(9).fillColor(COLORS.text)
        .text(`•  ${text}`, labelX, textY, { width: CARD_INNER });
      textY += 14;
    }
  }

  doc.y = y + cardH + 6;
}
