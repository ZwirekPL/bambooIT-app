// ─── Shopping list page ───────────────────────────────────────────────────────

import type { ShoppingCategory } from './types';
import { COLORS, LAYOUT } from './types';
import { drawRoundedBox, renderHeader, renderFooter, sectionTitle } from './pdf-helpers';

const { margin, contentWidth, colGap } = LAYOUT;

/** Format a shopping item — handles both string and object formats */
function formatShoppingItem(item: unknown): string {
  if (typeof item === 'string') return item;
  if (item && typeof item === 'object') {
    const obj = item as Record<string, unknown>;
    const name = obj.name ?? obj.ingredient ?? '';
    const grams = obj.totalGrams ?? obj.grams ?? 0;
    const pieces = obj.pieces ? ` (${obj.pieces})` : '';
    return `${name} — ${grams}g${pieces}`;
  }
  return String(item);
}

/**
 * BUG-5 D3: first-fit-decreasing pack order. Ties (same item count) fall back
 * to the original ordering from SHOPPING_CATEGORIES so the output is stable.
 */
export function sortCategoriesForPacking(categories: ShoppingCategory[]): ShoppingCategory[] {
  return categories
    .map((c, originalIndex) => ({ c, originalIndex }))
    .sort((a, b) => {
      const diff = b.c.items.length - a.c.items.length;
      return diff !== 0 ? diff : a.originalIndex - b.originalIndex;
    })
    .map(({ c }) => c);
}

// BUG-5 layout constants — small categories pack better when boxes are tight.
const TITLE_H = 26;
const ITEM_H = 16;
const BOX_PADDING_BOTTOM = 10;
const CATEGORY_GAP = 6;   // was 10 — tighter to reduce whitespace between cards

function renderCategoryBox(
  doc: PDFKit.PDFDocument,
  x: number, y: number, w: number,
  titleText: string,
  items: string[],
): number {
  const boxH = TITLE_H + items.length * ITEM_H + BOX_PADDING_BOTTOM;

  drawRoundedBox(doc, x, y, w, boxH, {
    fill: COLORS.white, stroke: COLORS.border, radius: 6,
  });

  // Category header bg
  doc.save();
  doc.roundedRect(x, y, w, TITLE_H, 6).clip();
  doc.rect(x, y, w, TITLE_H).fillColor(COLORS.primaryBg).fill();
  doc.restore();
  // Square the bottom corners of the header
  doc.rect(x, y + TITLE_H - 6, w, 6).fillColor(COLORS.primaryBg).fill();

  doc.font('Bold').fontSize(9).fillColor(COLORS.primary)
    .text(titleText.toUpperCase(), x + 12, y + 8, { width: w - 24 });

  let iy = y + TITLE_H + 4;
  for (const item of items) {
    doc.rect(x + 12, iy + 1, 8, 8)
      .strokeColor(COLORS.border).lineWidth(0.5).stroke();
    doc.font('Regular').fontSize(8.5).fillColor(COLORS.text)
      .text(item, x + 24, iy, { width: w - 38 });
    iy += ITEM_H;
  }

  return boxH;
}

export function renderShoppingListPage(
  doc: PDFKit.PDFDocument,
  shoppingList: ShoppingCategory[],
  pageNum: number,
): void {
  doc.addPage();
  renderHeader(doc);
  renderFooter(doc, pageNum);

  doc.y = LAYOUT.headerHeight + 20;
  sectionTitle(doc, 'LISTA ZAKUPÓW', 20);

  doc.font('Regular').fontSize(9).fillColor(COLORS.muted)
    .text('Produkty z całego tygodnia zsumowane w jednym miejscu.', margin, doc.y, { width: contentWidth });
  doc.moveDown(1);

  // BUG-5 D3: sort categories by item count DESC so the biggest boxes are placed
  // first. Combined with the left-fill-right-fill-newpage strategy below, this is
  // a first-fit-decreasing bin pack that naturally closes small whitespace holes
  // left behind after BUG-1 filtered junk ingredients.
  const sortedList = sortCategoriesForPacking(shoppingList);

  // Two-column layout
  const colW = (contentWidth - colGap) / 2;
  let colX = margin;
  let colStartY = doc.y;
  let currentColY = colStartY;
  let isLeftCol = true;
  let currentPageNum = pageNum;

  const columnMaxY = LAYOUT.footerY - 20;
  const MIN_ITEMS_PER_PARTIAL = 3;

  const advanceColumn = (): void => {
    if (isLeftCol) {
      isLeftCol = false;
      colX = margin + colW + colGap;
      currentColY = colStartY;
    } else {
      doc.addPage();
      currentPageNum++;
      renderHeader(doc);
      renderFooter(doc, currentPageNum);
      colX = margin;
      colStartY = LAYOUT.headerHeight + 20;
      currentColY = colStartY;
      isLeftCol = true;
    }
  };

  for (const category of sortedList) {
    const items = category.items.map(formatShoppingItem);
    let remainingItems = items;
    let firstChunk = true;

    while (remainingItems.length > 0) {
      const spaceLeft = columnMaxY - currentColY;
      const needed = TITLE_H + remainingItems.length * ITEM_H + BOX_PADDING_BOTTOM;
      const itemsThatFit = Math.max(
        0,
        Math.floor((spaceLeft - TITLE_H - BOX_PADDING_BOTTOM) / ITEM_H),
      );

      if (needed <= spaceLeft) {
        // Whole (remaining) category fits here
        const title = firstChunk ? category.category : `${category.category} (cd.)`;
        const boxH = renderCategoryBox(doc, colX, currentColY, colW, title, remainingItems);
        currentColY += boxH + CATEGORY_GAP;
        remainingItems = [];
        continue;
      }

      // BUG-5 D1: category doesn't fit — if at least MIN items fit here AND there
      // would still be MIN items left for the continuation box, split the category.
      // Otherwise advance to the next column / page before placing.
      const canSplitHere = itemsThatFit >= MIN_ITEMS_PER_PARTIAL
        && remainingItems.length - itemsThatFit >= MIN_ITEMS_PER_PARTIAL;

      if (!canSplitHere) {
        advanceColumn();
        continue;
      }

      const title = firstChunk ? category.category : `${category.category} (cd.)`;
      const chunk = remainingItems.slice(0, itemsThatFit);
      renderCategoryBox(doc, colX, currentColY, colW, title, chunk);
      remainingItems = remainingItems.slice(itemsThatFit);
      firstChunk = false;
      advanceColumn();
    }
  }

  doc.y = Math.max(doc.y, currentColY);
}
