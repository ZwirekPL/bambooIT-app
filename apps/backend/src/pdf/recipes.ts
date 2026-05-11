// ─── Recipes page ─────────────────────────────────────────────────────────────

import type { Recipe } from './types';
import { COLORS, LAYOUT } from './types';
import { drawRoundedBox, ensureSpace, renderHeader, renderFooter, sectionTitle } from './pdf-helpers';

const { margin, contentWidth } = LAYOUT;

function renderRecipe(doc: PDFKit.PDFDocument, recipe: Recipe): void {
  const ingredientLines = recipe.ingredients.length;
  const stepLines = recipe.steps.length;
  const estimatedH = 60 + ingredientLines * 14 + stepLines * 22;

  ensureSpace(doc, Math.min(estimatedH, 180));

  const startY = doc.y;

  // Top accent bar
  drawRoundedBox(doc, margin, startY, contentWidth, 4, {
    fill: COLORS.primary, radius: 2,
  });

  // Recipe title
  doc.font('Bold').fontSize(12).fillColor(COLORS.dark)
    .text(recipe.name, margin + 14, startY + 14, { width: contentWidth - 28 });

  doc.moveDown(0.6);

  // ─── Ingredients ────────────────────────────────────────────────────────────
  doc.font('Bold').fontSize(9).fillColor(COLORS.primary)
    .text('SKŁADNIKI', margin + 14, doc.y, { width: contentWidth - 28 });
  doc.moveDown(0.25);

  for (const ing of recipe.ingredients) {
    ensureSpace(doc, 16);
    doc.font('Regular').fontSize(9).fillColor(COLORS.text)
      .text(`•  ${ing}`, margin + 22, doc.y, { width: contentWidth - 44 });
    doc.moveDown(0.15);
  }

  doc.moveDown(0.5);

  // ─── Scaled portions note ─────────────────────────────────────────────────
  ensureSpace(doc, 30);
  const noteY = doc.y;
  const noteH = 22;
  drawRoundedBox(doc, margin + 14, noteY, contentWidth - 28, noteH, {
    fill: '#fef9e7', radius: 4,
  });
  doc.font('Regular').fontSize(7.5).fillColor('#8a7a2a')
    .text('Gramatury w przepisie mogą różnić się od Twojej porcji — stosuj wagi ze SKŁADNIKÓW powyżej.',
      margin + 22, noteY + 6, { width: contentWidth - 44 });
  doc.y = noteY + noteH + 6;

  // ─── Steps ──────────────────────────────────────────────────────────────────
  doc.font('Bold').fontSize(9).fillColor(COLORS.primary)
    .text('PRZYGOTOWANIE', margin + 14, doc.y, { width: contentWidth - 28 });
  doc.moveDown(0.3);

  recipe.steps.forEach((step, i) => {
    ensureSpace(doc, 30);

    const numX = margin + 18;
    const numY = doc.y;

    // Step number circle
    doc.circle(numX + 7, numY + 6, 9).fillColor(COLORS.primaryBg).fill();
    doc.font('Bold').fontSize(8).fillColor(COLORS.primary)
      .text(`${i + 1}`, numX + 2, numY + 2, { width: 10, align: 'center' });

    // Step text
    doc.font('Regular').fontSize(9).fillColor(COLORS.text)
      .text(step, margin + 40, numY, { width: contentWidth - 56, lineGap: 2 });
    doc.moveDown(0.35);
  });

  // Bottom separator
  doc.moveTo(margin + 14, doc.y + 4)
    .lineTo(margin + contentWidth - 14, doc.y + 4)
    .strokeColor(COLORS.borderLight)
    .lineWidth(0.5)
    .stroke();

  doc.moveDown(0.6);
}

export function renderRecipesPages(
  doc: PDFKit.PDFDocument,
  recipes: Recipe[],
  startPageNum: number,
): void {
  if (recipes.length === 0) return;

  doc.addPage();
  let currentPage = startPageNum;
  renderHeader(doc);
  renderFooter(doc, currentPage);

  doc.y = LAYOUT.headerHeight + 20;
  sectionTitle(doc, 'PRZEPISY', 20);

  doc.font('Regular').fontSize(9).fillColor(COLORS.muted)
    .text('Szczegółowe instrukcje przygotowania posiłków.', margin, doc.y, { width: contentWidth });
  doc.moveDown(1);

  for (const recipe of recipes) {
    renderRecipe(doc, recipe);
  }
}
