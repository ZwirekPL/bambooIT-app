// ─── 38.10: Micronutrient analysis page in PDF ─────────────────────────────────

import { COLORS, LAYOUT } from './types';
import { drawRoundedBox, drawSeparator, renderHeader, renderFooter, ensureSpace, renderWatermark } from './pdf-helpers';

const { margin, contentWidth } = LAYOUT;

// ─── Types ──────────────────────────────────────────────────────────────────

export interface PdfNutrientAssessment {
  label: string;
  unit: string;
  dailyAvgIntake: number;
  target: number | null;
  status: 'ADEQUATE' | 'SUBOPTIMAL' | 'DEFICIENT' | 'EXCESSIVE' | 'UNKNOWN';
  percentOfTarget: number | null;
}

export interface PdfSupplementRecommendation {
  label: string;
  suggestedDose: string;
  reason: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface PdfMicronutrientData {
  overallScore: number;
  analyzedDays: number;
  assessments: PdfNutrientAssessment[];
  supplementRecommendations: PdfSupplementRecommendation[];
}

// ─── Status colors ──────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, { fill: string; text: string; label: string }> = {
  ADEQUATE:   { fill: '#e8f5e9', text: '#2e7d32', label: 'OK' },
  SUBOPTIMAL: { fill: '#fff8e1', text: '#f57f17', label: 'Suboptymalne' },
  DEFICIENT:  { fill: '#ffebee', text: '#c62828', label: 'Niedobór' },
  EXCESSIVE:  { fill: '#fff3e0', text: '#e65100', label: 'Nadmiar' },
  UNKNOWN:    { fill: '#f5f5f5', text: '#757575', label: '—' },
};

const PRIORITY_COLORS: Record<string, string> = {
  HIGH: '#c62828',
  MEDIUM: '#f57f17',
  LOW: '#757575',
};

// ─── Render functions ───────────────────────────────────────────────────────

export function renderMicronutrientsPage(
  doc: PDFKit.PDFDocument,
  data: PdfMicronutrientData,
  startPageNum: number,
  watermarkText?: string | null,
): number {
  let pageNum = startPageNum;

  doc.addPage();
  renderHeader(doc);
  renderFooter(doc, pageNum);
  if (watermarkText) renderWatermark(doc, watermarkText);

  // Title
  doc.y = LAYOUT.headerHeight + 14;
  doc.font('Bold').fontSize(18).fillColor(COLORS.primary)
    .text('ANALIZA MIKROSKŁADNIKÓW', margin, doc.y, { width: contentWidth });
  doc.moveDown(0.3);

  // Score box
  const scoreY = doc.y;
  const scoreH = 50;
  const scoreColor = data.overallScore >= 70 ? '#2e7d32' : data.overallScore >= 40 ? '#f57f17' : '#c62828';

  drawRoundedBox(doc, margin, scoreY, contentWidth, scoreH, {
    fill: COLORS.primaryBg, stroke: COLORS.primaryBorder, radius: 8,
  });

  doc.font('Regular').fontSize(9).fillColor(COLORS.textLight)
    .text('OGÓLNY WYNIK', margin + 16, scoreY + 10);
  doc.font('Bold').fontSize(24).fillColor(scoreColor)
    .text(`${data.overallScore}%`, margin + 16, scoreY + 22);
  doc.font('Regular').fontSize(9).fillColor(COLORS.textLight)
    .text(`na podstawie ${data.analyzedDays} dni`, margin + 100, scoreY + 30);

  doc.y = scoreY + scoreH + 12;

  // Assessment table
  drawSeparator(doc);
  doc.moveDown(0.5);

  doc.font('Bold').fontSize(12).fillColor(COLORS.dark)
    .text('SKŁADNIKI ODŻYWCZE', margin, doc.y, { width: contentWidth });
  doc.moveDown(0.4);

  // Table header
  const colX = {
    label: margin + 4,
    intake: margin + 160,
    target: margin + 240,
    pct: margin + 310,
    status: margin + 380,
  };

  doc.font('Bold').fontSize(7).fillColor(COLORS.muted);
  doc.text('SKŁADNIK', colX.label, doc.y, { width: 150, lineBreak: false });
  doc.text('SPOŻYCIE', colX.intake, doc.y, { width: 70, lineBreak: false });
  doc.text('NORMA', colX.target, doc.y, { width: 60, lineBreak: false });
  doc.text('%', colX.pct, doc.y, { width: 50, lineBreak: false });
  doc.text('STATUS', colX.status, doc.y, { width: 80, lineBreak: false });
  doc.moveDown(0.6);

  const rowH = 16;

  for (let i = 0; i < data.assessments.length; i++) {
    const a = data.assessments[i];
    const y = doc.y;

    ensureSpace(doc, rowH + 4);
    if (doc.y < y) {
      // Page was added
      pageNum++;
      renderHeader(doc);
      renderFooter(doc, pageNum);
      if (watermarkText) renderWatermark(doc, watermarkText);
      doc.y = LAYOUT.headerHeight + 14;
    }

    // Alternating row bg
    if (i % 2 === 0) {
      doc.rect(margin, doc.y - 1, contentWidth, rowH).fillColor('#fafafa').fill();
    }

    const statusStyle = STATUS_COLORS[a.status] ?? STATUS_COLORS.UNKNOWN;

    doc.font('Regular').fontSize(8).fillColor(COLORS.text)
      .text(a.label, colX.label, doc.y + 2, { width: 150, lineBreak: false });

    doc.text(`${a.dailyAvgIntake} ${a.unit}`, colX.intake, doc.y + 2, { width: 70, lineBreak: false });

    doc.text(a.target ? `${a.target} ${a.unit}` : '—', colX.target, doc.y + 2, { width: 60, lineBreak: false });

    doc.text(a.percentOfTarget ? `${a.percentOfTarget}%` : '—', colX.pct, doc.y + 2, { width: 50, lineBreak: false });

    // Status badge
    const badgeW = 60;
    const badgeH = 12;
    const badgeX = colX.status;
    const badgeY = doc.y + 1;
    drawRoundedBox(doc, badgeX, badgeY, badgeW, badgeH, { fill: statusStyle.fill, radius: 3 });
    doc.font('Bold').fontSize(6.5).fillColor(statusStyle.text)
      .text(statusStyle.label, badgeX + 4, badgeY + 2, { width: badgeW - 8, align: 'center', lineBreak: false });

    doc.y += rowH;
  }

  // Supplements section
  if (data.supplementRecommendations.length > 0) {
    doc.moveDown(0.8);
    ensureSpace(doc, 60);

    drawSeparator(doc);
    doc.moveDown(0.5);

    doc.font('Bold').fontSize(12).fillColor(COLORS.dark)
      .text('SUGEROWANE SUPLEMENTY', margin, doc.y, { width: contentWidth });
    doc.moveDown(0.4);

    for (const rec of data.supplementRecommendations) {
      ensureSpace(doc, 36);

      const recY = doc.y;
      const priorityColor = PRIORITY_COLORS[rec.priority] ?? COLORS.muted;

      // Priority dot
      doc.circle(margin + 8, recY + 6, 3).fillColor(priorityColor).fill();

      doc.font('Bold').fontSize(9).fillColor(COLORS.text)
        .text(rec.label, margin + 16, recY, { width: contentWidth - 20, lineBreak: false });

      doc.font('Regular').fontSize(8).fillColor(COLORS.primaryLight)
        .text(rec.suggestedDose, margin + 16, recY + 12, { width: contentWidth - 20 });

      doc.font('Regular').fontSize(7).fillColor(COLORS.muted)
        .text(rec.reason, margin + 16, doc.y, { width: contentWidth - 20 });

      doc.moveDown(0.5);
    }
  }

  // Note at bottom
  doc.moveDown(0.6);
  ensureSpace(doc, 30);
  doc.font('Regular').fontSize(7).fillColor(COLORS.muted)
    .text(
      'Analiza oparta na danych z planu diety i polskich normach IŻŻ 2020. Wyniki mają charakter orientacyjny — nie zastępują diagnostyki laboratoryjnej.',
      margin,
      doc.y,
      { width: contentWidth },
    );

  return pageNum;
}
