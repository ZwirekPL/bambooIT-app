import https from 'https';
import http from 'http';
import path from 'path';
import PDFDocument from 'pdfkit';

const FONTS_DIR = path.join(__dirname, '../assets/fonts');

interface MealItem {
  name: string;
  grams?: number;
  kcal?: number;
  protein?: number;
  fat?: number;
  carbs?: number;
}

function formatMealItem(item: string | MealItem): string {
  if (typeof item === 'string') return item;
  const parts = [item.name];
  if (item.grams) parts.push(`${item.grams}g`);
  const macros: string[] = [];
  if (item.kcal) macros.push(`${item.kcal} kcal`);
  if (item.protein) macros.push(`B: ${item.protein}g`);
  if (item.fat) macros.push(`T: ${item.fat}g`);
  if (item.carbs) macros.push(`W: ${item.carbs}g`);
  if (macros.length) parts.push(`(${macros.join(', ')})`);
  return parts.join(' — ');
}

interface Meal {
  name: string;
  items: (string | MealItem)[];
}

interface Day {
  day: string;
  meals: Meal[];
}

interface DietPlanContent {
  days?: Day[];
  text?: string;
}

export interface TenantBranding {
  name: string;
  logoUrl?: string | null;
}

export interface PlanData {
  id: string;
  kcal?: number | null;
  proteinG?: number | null;
  fatG?: number | null;
  carbsG?: number | null;
  content: Record<string, unknown>;
  createdAt: Date | string;
  source?: string;
  tenant?: TenantBranding | null;
}

async function fetchImageBuffer(url: string): Promise<Buffer> {
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

export async function generateDietPlanPdf(plan: PlanData): Promise<PDFKit.PDFDocument> {
  const doc = new PDFDocument({ margin: 50, size: 'A4' });

  doc.registerFont('Regular', path.join(FONTS_DIR, 'Roboto-Regular.ttf'));
  doc.registerFont('Bold', path.join(FONTS_DIR, 'Roboto-Bold.ttf'));

  // ─── Tenant branding ────────────────────────────────────────────────────────
  if (plan.tenant) {
    if (plan.tenant.logoUrl) {
      try {
        const logoBuffer = await fetchImageBuffer(plan.tenant.logoUrl);
        doc.image(logoBuffer, 50, 40, { height: 40, fit: [120, 40] });
        doc
          .font('Bold')
          .fontSize(11)
          .fillColor('#2d6a4f')
          .text(plan.tenant.name, 180, 52, { align: 'right', width: 365 });
      } catch {
        // fallback: show only tenant name if logo fetch fails
        doc
          .font('Bold')
          .fontSize(12)
          .fillColor('#2d6a4f')
          .text(plan.tenant.name, 50, 45, { align: 'right', width: 495 });
      }
      doc.moveDown(2.5);
    } else {
      doc
        .font('Bold')
        .fontSize(12)
        .fillColor('#2d6a4f')
        .text(plan.tenant.name, { align: 'right' });
      doc.moveDown(0.6);
    }
  }

  // ─── Header ────────────────────────────────────────────────────────────────
  doc
    .font('Bold')
    .fontSize(22)
    .fillColor('#2d6a4f')
    .text('Plan Diety', { align: 'center' });

  doc.moveDown(0.3);

  const dateStr = new Date(plan.createdAt).toLocaleDateString('pl-PL', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  doc
    .font('Regular')
    .fontSize(10)
    .fillColor('#666666')
    .text(`Data wygenerowania: ${dateStr}`, { align: 'center' });

  if (plan.source) {
    const sourceLabel = plan.source === 'AI' ? 'Plan AI' : 'Plan ręczny';
    doc.text(sourceLabel, { align: 'center' });
  }

  doc.moveDown(1);

  // ─── Separator ─────────────────────────────────────────────────────────────
  doc
    .moveTo(50, doc.y)
    .lineTo(545, doc.y)
    .strokeColor('#d0e4d8')
    .lineWidth(1)
    .stroke();

  doc.moveDown(1);

  // ─── Macros ────────────────────────────────────────────────────────────────
  const hasMacros = plan.kcal || plan.proteinG || plan.fatG || plan.carbsG;

  if (hasMacros) {
    doc
      .font('Bold')
      .fontSize(14)
      .fillColor('#1a1a1a')
      .text('Makroskładniki');

    doc.moveDown(0.4);

    const macros = [
      { label: 'Kalorie', value: plan.kcal, unit: 'kcal' },
      { label: 'Białko', value: plan.proteinG, unit: 'g' },
      { label: 'Tłuszcze', value: plan.fatG, unit: 'g' },
      { label: 'Węglowodany', value: plan.carbsG, unit: 'g' },
    ].filter(m => m.value != null);

    const colWidth = 117;
    const startX = 50;
    const startY = doc.y;
    const boxH = 48;

    macros.forEach((m, i) => {
      const x = startX + i * colWidth;
      doc
        .roundedRect(x, startY, colWidth - 6, boxH, 6)
        .fillColor('#f0f7f4')
        .fill();

      doc
        .font('Bold')
        .fontSize(16)
        .fillColor('#2d6a4f')
        .text(`${m.value}`, x + 8, startY + 6, { width: colWidth - 14 });

      doc
        .font('Regular')
        .fontSize(9)
        .fillColor('#666666')
        .text(`${m.label} (${m.unit})`, x + 8, startY + 26, { width: colWidth - 14 });
    });

    doc.y = startY + boxH + 16;
    doc.moveDown(0.5);
  }

  // ─── Content ───────────────────────────────────────────────────────────────
  doc
    .font('Bold')
    .fontSize(14)
    .fillColor('#1a1a1a')
    .text('Jadłospis');

  doc.moveDown(0.6);

  const content = plan.content as DietPlanContent;

  if (content.days && Array.isArray(content.days) && content.days.length > 0) {
    content.days.forEach((d) => {
      doc
        .font('Bold')
        .fontSize(12)
        .fillColor('#2d6a4f')
        .text(d.day ?? '');

      doc.moveDown(0.3);

      (d.meals ?? []).forEach((meal) => {
        doc
          .font('Bold')
          .fontSize(10)
          .fillColor('#333333')
          .text(meal.name ?? '', { indent: 12 });

        (meal.items ?? []).forEach((item) => {
          doc
            .font('Regular')
            .fontSize(10)
            .fillColor('#555555')
            .text(`• ${formatMealItem(item)}`, { indent: 24 });
        });

        doc.moveDown(0.3);
      });

      doc.moveDown(0.4);
    });
  } else if (typeof content.text === 'string' && content.text.trim()) {
    doc
      .font('Regular')
      .fontSize(10)
      .fillColor('#333333')
      .text(content.text, { lineGap: 3 });
  } else {
    doc
      .font('Regular')
      .fontSize(9)
      .fillColor('#888888')
      .text(JSON.stringify(plan.content, null, 2), { lineGap: 2 });
  }

  // ─── Footer ────────────────────────────────────────────────────────────────
  const footerText = plan.tenant
    ? `${plan.tenant.name} — plan diety wygenerowany automatycznie`
    : 'Plan diety — dokument wygenerowany automatycznie';

  doc.on('pageAdded', () => {
    doc
      .font('Regular')
      .fontSize(8)
      .fillColor('#aaaaaa')
      .text(footerText, 50, doc.page.height - 40, {
        align: 'center',
        width: doc.page.width - 100,
      });
  });

  doc.end();
  return doc;
}
