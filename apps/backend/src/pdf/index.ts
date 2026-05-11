// ─── Diet Plan PDF Generator — main entry point ──────────────────────────────
//
// Modular structure:
//   pdf/types.ts              — shared types, colors, layout constants
//   pdf/content-parser.ts     — parse encrypted content into structured data
//   pdf/pdf-helpers.ts        — drawing helpers, header/footer
//   pdf/meal-card.ts          — individual meal card renderer
//   pdf/diet-plan-template.ts — summary page + day pages
//   pdf/shopping-list.ts      — shopping list page
//   pdf/recipes.ts            — recipes page

import path from 'path';
import PDFDocument from 'pdfkit';
import type { DietPlanData } from './types';
import { LAYOUT } from './types';
import { renderHeader, renderFooter, renderWatermark } from './pdf-helpers';
import { parseContent } from './content-parser';
import { renderSummaryPage, renderDayPage } from './diet-plan-template';
import { renderShoppingListPage } from './shopping-list';
import { renderRecipesPages } from './recipes';
import { renderMicronutrientsPage } from './micronutrients';

const FONTS_DIR = path.join(__dirname, '../assets/fonts');

export type { DietPlanData, TenantBranding } from './types';

export async function generateDietPlanPdf(plan: DietPlanData): Promise<PDFKit.PDFDocument> {
  const doc = new PDFDocument({ margin: LAYOUT.margin, size: 'A4' });

  // Register fonts
  doc.registerFont('Regular', path.join(FONTS_DIR, 'Roboto-Regular.ttf'));
  doc.registerFont('Bold', path.join(FONTS_DIR, 'Roboto-Bold.ttf'));

  // Parse content
  const parsed = parseContent(plan.content);

  let pageNum = 1;

  const watermark = plan.watermarkText ?? null;

  // ─── Page 1: Summary ───────────────────────────────────────────────────────
  await renderSummaryPage(doc, plan, parsed, pageNum);
  if (watermark) renderWatermark(doc, watermark);

  // ─── Pages 2+: Daily meal plans (1 day = 1 page) ──────────────────────────
  for (const day of parsed.days) {
    doc.addPage();
    pageNum++;
    renderDayPage(doc, day, pageNum);
    if (watermark) renderWatermark(doc, watermark);
  }

  // ─── Shopping list page ────────────────────────────────────────────────────
  if (parsed.shoppingList.length > 0) {
    pageNum++;
    renderShoppingListPage(doc, parsed.shoppingList, pageNum);
  }

  // ─── Recipes pages ─────────────────────────────────────────────────────────
  if (parsed.recipes.length > 0) {
    pageNum++;
    renderRecipesPages(doc, parsed.recipes, pageNum);
  }

  // ─── 38.10: Micronutrient analysis page ──────────────────────────────────
  if (plan.micronutrients) {
    pageNum = renderMicronutrientsPage(doc, plan.micronutrients, pageNum + 1, watermark);
  }

  doc.end();
  return doc;
}
