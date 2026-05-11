// ─── Shared PDF drawing helpers ───────────────────────────────────────────────

import https from 'https';
import http from 'http';
import { COLORS, LAYOUT, DISCLAIMER_SHORT } from './types';

const { margin, contentWidth } = LAYOUT;

// ─── Page structure ───────────────────────────────────────────────────────────

export function renderHeader(doc: PDFKit.PDFDocument): void {
  const savedY = doc.y;
  const savedBottom = doc.page.margins.bottom;
  doc.page.margins.bottom = 0;

  // Top bar
  doc.rect(0, 0, LAYOUT.pageWidth, LAYOUT.headerHeight).fillColor(COLORS.primary).fill();
  doc.font('Bold').fontSize(8).fillColor(COLORS.white)
    .text('PLAN DIETY', margin, 10, { width: contentWidth, align: 'left', lineBreak: false });

  doc.page.margins.bottom = savedBottom;
  doc.y = savedY;
}

export function renderFooter(doc: PDFKit.PDFDocument, pageNum?: number): void {
  const savedY = doc.y;
  const savedBottom = doc.page.margins.bottom;
  doc.page.margins.bottom = 0;

  // Thin line
  doc.moveTo(margin, LAYOUT.footerY - 8)
    .lineTo(margin + contentWidth, LAYOUT.footerY - 8)
    .strokeColor(COLORS.borderLight)
    .lineWidth(0.5)
    .stroke();

  doc.font('Regular').fontSize(7).fillColor(COLORS.mutedLight)
    .text('e-dietetyk.com', margin, LAYOUT.footerY, { width: contentWidth / 3, align: 'left', lineBreak: false });

  doc.font('Regular').fontSize(6).fillColor(COLORS.mutedLight)
    .text(DISCLAIMER_SHORT, margin + contentWidth / 3, LAYOUT.footerY, { width: contentWidth / 3, align: 'center', lineBreak: false });

  if (pageNum != null) {
    doc.font('Regular').fontSize(7).fillColor(COLORS.mutedLight)
      .text(`${pageNum}`, margin + 2 * contentWidth / 3, LAYOUT.footerY, { width: contentWidth / 3, align: 'right', lineBreak: false });
  }

  doc.page.margins.bottom = savedBottom;
  doc.y = savedY;
}

// ─── Drawing primitives ───────────────────────────────────────────────────────

export function drawSeparator(doc: PDFKit.PDFDocument, y?: number): void {
  const yPos = y ?? doc.y;
  doc.moveTo(margin, yPos)
    .lineTo(margin + contentWidth, yPos)
    .strokeColor(COLORS.primaryBorder)
    .lineWidth(0.5)
    .stroke();
}

export function ensureSpace(doc: PDFKit.PDFDocument, needed: number): void {
  if (doc.y + needed > LAYOUT.footerY - 20) {
    doc.addPage();
    renderHeader(doc);
    renderFooter(doc);
    doc.y = LAYOUT.headerHeight + 14;
  }
}

export function sectionTitle(doc: PDFKit.PDFDocument, text: string, fontSize = 16): void {
  ensureSpace(doc, 40);
  doc.font('Bold').fontSize(fontSize).fillColor(COLORS.primary)
    .text(text, margin, doc.y, { width: contentWidth });
  doc.moveDown(0.4);
}

export function drawRoundedBox(
  doc: PDFKit.PDFDocument,
  x: number, y: number, w: number, h: number,
  opts: { fill?: string; stroke?: string; radius?: number } = {},
): void {
  const r = opts.radius ?? 6;
  if (opts.fill) {
    doc.roundedRect(x, y, w, h, r).fillColor(opts.fill).fill();
  }
  if (opts.stroke) {
    doc.roundedRect(x, y, w, h, r).strokeColor(opts.stroke).lineWidth(0.5).stroke();
  }
}

// ─── 39.5.1: Watermark ───────────────────────────────────────────────────────

/**
 * Render a diagonal watermark on the current page.
 * Shows patient email + brand domain to deter unauthorized sharing.
 */
export function renderWatermark(doc: PDFKit.PDFDocument, text: string): void {
  if (!text) return;
  const savedY = doc.y;

  const cx = LAYOUT.pageWidth / 2;
  const cy = LAYOUT.pageHeight / 2;

  // ─── Line 1: patient email ────────────────────────────────────────
  doc.save();
  doc.opacity(0.04);
  doc.font('Bold').fontSize(36).fillColor('#000000');

  doc.translate(cx, cy);
  doc.rotate(-35, { origin: [0, 0] });

  const emailW = doc.widthOfString(text);
  doc.text(text, -emailW / 2, -30, { lineBreak: false });

  doc.restore();

  // ─── Line 2: brand domain ────────────────────────────────────────
  doc.save();
  doc.opacity(0.035);
  doc.font('Regular').fontSize(20).fillColor('#000000');

  doc.translate(cx, cy);
  doc.rotate(-35, { origin: [0, 0] });

  const brand = 'e-dietetyk.com';
  const brandW = doc.widthOfString(brand);
  doc.text(brand, -brandW / 2, 14, { lineBreak: false });

  doc.restore();
  doc.y = savedY;
}

// ─── Network ──────────────────────────────────────────────────────────────────

export async function fetchImageBuffer(url: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`Failed to fetch image: ${res.statusCode}`));
        return;
      }
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}
