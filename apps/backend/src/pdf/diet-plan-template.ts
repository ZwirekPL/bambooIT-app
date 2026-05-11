// ─── Summary page + day pages ─────────────────────────────────────────────────

import { COLORS, LAYOUT, DISCLAIMER_TEXT } from './types';
import type { DietPlanData, Day, ParsedContent, MealItem } from './types';
import { drawRoundedBox, drawSeparator, fetchImageBuffer, renderHeader, renderFooter } from './pdf-helpers';
import { renderMealCard } from './meal-card';

const { margin, contentWidth } = LAYOUT;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function macroPercent(value: number | null | undefined, totalKcal: number | null | undefined): string {
  if (!value || !totalKcal || totalKcal === 0) return '';
  // protein/carbs = 4kcal/g, fat = 9kcal/g — but we just do % of total grams for simplicity
  return '';
}

function macroPercentKcal(
  grams: number | null | undefined,
  kcalPerGram: number,
  totalKcal: number | null | undefined,
): string {
  if (!grams || !totalKcal || totalKcal === 0) return '';
  const pct = Math.round((grams * kcalPerGram / totalKcal) * 100);
  return `(${pct}%)`;
}

/**
 * Faza D Phase 1 W2-Thu: returns every structured MealItem in the meal so
 * day-totals sum correctly across compose-mode slots (1-3 items per
 * LUNCH/DINNER ≥18% slot). Legacy / single-item slots yield a 1-element
 * array, preserving previous behaviour.
 */
function getMealItems(meal: { items: (string | MealItem)[] }): MealItem[] {
  if (!meal.items || meal.items.length === 0) return [];
  return meal.items.filter((it): it is MealItem => typeof it !== 'string');
}

// ─── Page 1: Summary ─────────────────────────────────────────────────────────

export async function renderSummaryPage(
  doc: PDFKit.PDFDocument,
  plan: DietPlanData,
  parsed: ParsedContent,
  pageNum: number,
): Promise<void> {
  renderHeader(doc);
  renderFooter(doc, pageNum);

  // ─── Tenant branding ──────────────────────────────────────────────────────
  let startY = LAYOUT.headerHeight + 25;

  if (plan.tenant) {
    if (plan.tenant.logoUrl) {
      try {
        const logoBuffer = await fetchImageBuffer(plan.tenant.logoUrl);
        doc.image(logoBuffer, margin, startY, { height: 32, fit: [100, 32] });
        doc.font('Bold').fontSize(10).fillColor(COLORS.primaryLight)
          .text(plan.tenant.name, margin + 110, startY + 10, { align: 'right', width: contentWidth - 110 });
      } catch {
        doc.font('Bold').fontSize(10).fillColor(COLORS.primaryLight)
          .text(plan.tenant.name, margin, startY + 5, { align: 'right', width: contentWidth });
      }
      startY += 50;
    } else {
      doc.font('Bold').fontSize(10).fillColor(COLORS.primaryLight)
        .text(plan.tenant.name, margin, startY, { align: 'right', width: contentWidth });
      startY += 25;
    }
  }

  // ─── Title ────────────────────────────────────────────────────────────────
  doc.font('Bold').fontSize(28).fillColor(COLORS.primary)
    .text('PLAN DIETY', margin, startY, { align: 'center', width: contentWidth });

  const dateStr = new Date(plan.createdAt).toLocaleDateString('pl-PL', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
  doc.moveDown(0.3);
  doc.font('Regular').fontSize(10).fillColor(COLORS.muted)
    .text(dateStr, { align: 'center', width: contentWidth });

  doc.moveDown(0.8);

  // ─── Disclaimer box ────────────────────────────────────────────────────────
  const disclaimerY = doc.y;
  const disclaimerPad = 10;
  const disclaimerFontSize = 8;
  doc.font('Regular').fontSize(disclaimerFontSize);
  const disclaimerH = doc.heightOfString(DISCLAIMER_TEXT, { width: contentWidth - 2 * disclaimerPad }) + 2 * disclaimerPad;
  drawRoundedBox(doc, margin, disclaimerY, contentWidth, disclaimerH, {
    fill: '#fef9e7', stroke: '#e6d68a', radius: 6,
  });
  doc.font('Regular').fontSize(disclaimerFontSize).fillColor(COLORS.text)
    .text(DISCLAIMER_TEXT, margin + disclaimerPad, disclaimerY + disclaimerPad, {
      width: contentWidth - 2 * disclaimerPad,
    });
  doc.y = disclaimerY + disclaimerH + 8;

  drawSeparator(doc);
  doc.moveDown(0.6);

  // ─── Macro summary ─────────────────────────────────────────────────────────
  const hasMacros = plan.kcal || plan.proteinG || plan.fatG || plan.carbsG;

  if (hasMacros) {
    doc.font('Bold').fontSize(13).fillColor(COLORS.dark)
      .text('DZIENNE ZAPOTRZEBOWANIE', margin, doc.y, { width: contentWidth });
    doc.moveDown(0.5);

    // ─── Kcal box ─────────────────────────────────────────────────────────────
    const kcalY = doc.y;
    const kcalH = 54;
    drawRoundedBox(doc, margin, kcalY, contentWidth, kcalH, {
      fill: COLORS.primaryBg, stroke: COLORS.primaryBorder, radius: 8,
    });

    doc.font('Regular').fontSize(9).fillColor(COLORS.textLight)
      .text('KALORIE DZIENNE', margin + 16, kcalY + 10);
    doc.font('Bold').fontSize(26).fillColor(COLORS.accentKcal)
      .text(`${plan.kcal ?? '—'}`, margin + 16, kcalY + 24);
    doc.font('Bold').fontSize(26);
    const kcalW = doc.widthOfString(`${plan.kcal ?? '—'}`);
    doc.font('Regular').fontSize(12).fillColor(COLORS.textLight)
      .text('kcal', margin + 20 + kcalW, kcalY + 30);

    doc.y = kcalY + kcalH + 8;

    // ─── Macro cards (3 columns) with percentages ─────────────────────────────
    const macros = [
      {
        label: 'BIAŁKO', value: plan.proteinG, color: COLORS.accentProtein,
        pct: macroPercentKcal(plan.proteinG, 4, plan.kcal),
      },
      {
        label: 'TŁUSZCZE', value: plan.fatG, color: COLORS.accentFat,
        pct: macroPercentKcal(plan.fatG, 9, plan.kcal),
      },
      {
        label: 'WĘGLOWODANY', value: plan.carbsG, color: COLORS.accentCarbs,
        pct: macroPercentKcal(plan.carbsG, 4, plan.kcal),
      },
    ];

    const colW = (contentWidth - 2 * LAYOUT.colGap) / 3;
    const boxH = 72;
    const boxY = doc.y;

    macros.forEach((m, i) => {
      const x = margin + i * (colW + LAYOUT.colGap);
      drawRoundedBox(doc, x, boxY, colW, boxH, { fill: COLORS.white, stroke: COLORS.border, radius: 8 });

      // Color bar at top
      doc.save();
      doc.roundedRect(x, boxY, colW, 5, 3).clip();
      doc.rect(x, boxY, colW, 5).fillColor(m.color).fill();
      doc.restore();

      doc.font('Regular').fontSize(8).fillColor(COLORS.muted)
        .text(m.label, x + 12, boxY + 16, { width: colW - 24 });

      doc.font('Bold').fontSize(22).fillColor(COLORS.dark)
        .text(`${m.value ?? '—'}`, x + 12, boxY + 30, { width: colW - 24 });

      // Unit + percentage
      const unitLine = m.pct ? `g  ${m.pct}` : 'g';
      doc.font('Regular').fontSize(9).fillColor(COLORS.textLight)
        .text(unitLine, x + 12, boxY + 54, { width: colW - 24 });
    });

    doc.y = boxY + boxH + 10;
  }

  // ─── Info section ─────────────────────────────────────────────────────────
  drawSeparator(doc);
  doc.moveDown(0.5);

  doc.font('Bold').fontSize(13).fillColor(COLORS.dark)
    .text('INFORMACJE', margin, doc.y, { width: contentWidth });
  doc.moveDown(0.3);

  const infos: string[] = [];
  if (parsed.mealsPerDay > 0) infos.push(`Liczba posiłków dziennie: ${parsed.mealsPerDay}`);
  if (parsed.days.length > 0) infos.push(`Liczba dni w planie: ${parsed.days.length}`);
  if (plan.source === 'AI') infos.push('Plan wygenerowany przez AI');

  for (const info of infos) {
    doc.font('Regular').fontSize(10).fillColor(COLORS.text)
      .text(`•  ${info}`, margin + 8, doc.y, { width: contentWidth - 16 });
    doc.moveDown(0.3);
  }

  // ─── Rules section ────────────────────────────────────────────────────────
  if (parsed.rules.length > 0) {
    doc.moveDown(0.4);
    doc.font('Bold').fontSize(13).fillColor(COLORS.primary)
      .text('ZASADY DIETY', margin, doc.y, { width: contentWidth });
    doc.moveDown(0.3);

    for (const rule of parsed.rules) {
      doc.font('Regular').fontSize(10).fillColor(COLORS.text)
        .text(`•  ${rule}`, margin + 8, doc.y, { width: contentWidth - 16, lineGap: 2 });
      doc.moveDown(0.3);
    }
  }

  // ─── Week overview ────────────────────────────────────────────────────────
  if (parsed.days.length > 0) {
    doc.moveDown(0.4);
    drawSeparator(doc);
    doc.moveDown(0.5);

    doc.font('Bold').fontSize(13).fillColor(COLORS.dark)
      .text('PLAN TYGODNIA — PRZEGLĄD', margin, doc.y, { width: contentWidth });
    doc.moveDown(0.4);

    for (const day of parsed.days) {
      // Day name
      doc.font('Bold').fontSize(10).fillColor(COLORS.primary)
        .text(day.day, margin + 8, doc.y, { width: 120 });

      const mealNames = (day.meals ?? []).map(m => m.name).join('  •  ');
      doc.font('Regular').fontSize(9).fillColor(COLORS.textLight)
        .text(mealNames, margin + 8, doc.y, { width: contentWidth - 16 });
      doc.moveDown(0.4);
    }
  }
}

// ─── Day pages (1 day = 1 page) ─────────────────────────────────────────────

export function renderDayPage(
  doc: PDFKit.PDFDocument,
  day: Day,
  pageNum: number,
): void {
  renderHeader(doc);
  renderFooter(doc, pageNum);

  // Day title
  doc.y = LAYOUT.headerHeight + 14;
  doc.font('Bold').fontSize(20).fillColor(COLORS.primary)
    .text(day.day.toUpperCase(), margin, doc.y, { width: contentWidth });

  doc.moveDown(0.15);
  doc.moveTo(margin, doc.y)
    .lineTo(margin + contentWidth, doc.y)
    .strokeColor(COLORS.primaryBorder)
    .lineWidth(1)
    .stroke();
  doc.moveDown(0.4);

  // Render meal cards
  for (let i = 0; i < (day.meals ?? []).length; i++) {
    renderMealCard(doc, day.meals[i], i);
  }

  // ─── Day total summary ──────────────────────────────────────────────────────
  // Faza D Phase 1 W2-Thu: sum across all items per meal (compose mode emits
  // 1-3 items per LUNCH/DINNER ≥18% slot). Pre-Faza-D plans have 1 item per
  // meal, so the inner loop is a no-op for legacy data.
  const totals = { kcal: 0, protein: 0, fat: 0, carbs: 0 };
  for (const meal of (day.meals ?? [])) {
    for (const item of getMealItems(meal)) {
      totals.kcal += item.kcal ?? 0;
      totals.protein += item.protein ?? 0;
      totals.fat += item.fat ?? 0;
      totals.carbs += item.carbs ?? 0;
    }
  }

  const sumY = doc.y + 2;
  const sumH = 34;
  drawRoundedBox(doc, margin, sumY, contentWidth, sumH, {
    fill: COLORS.primaryBg, radius: 6,
  });

  doc.font('Bold').fontSize(9).fillColor(COLORS.primary)
    .text('SUMA DNIA:', margin + 14, sumY + 11, { width: 75 });

  const parts = [
    `${Math.round(totals.kcal)} kcal`,
    `Białko: ${totals.protein.toFixed(1)}g`,
    `Tłuszcze: ${totals.fat.toFixed(1)}g`,
    `Węglowodany: ${totals.carbs.toFixed(1)}g`,
  ];
  doc.font('Bold').fontSize(9).fillColor(COLORS.dark)
    .text(parts.join('   |   '), margin + 88, sumY + 11, {
      width: contentWidth - 100,
    });

  doc.y = sumY + sumH + 6;
}
