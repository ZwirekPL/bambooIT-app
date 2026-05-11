import PDFDocument from 'pdfkit';
import type { MonthlyReport, PatientSummary } from './dietitianReport.service';

const COLORS = {
  primary: '#2d6a4f',
  text: '#1a1a1a',
  muted: '#6b7280',
  border: '#d1d5db',
  headerBg: '#f0fdf4',
} as const;

export async function generateReportPdf(report: MonthlyReport): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const [year, mon] = report.month.split('-');
    const monthName = new Date(Number(year), Number(mon) - 1)
      .toLocaleDateString('pl-PL', { month: 'long', year: 'numeric' });

    // ── Header ──────────────────────────────────────────────
    doc
      .fontSize(22)
      .fillColor(COLORS.primary)
      .text('Raport miesięczny dietetyka', { align: 'center' });
    doc
      .fontSize(14)
      .fillColor(COLORS.muted)
      .text(monthName.charAt(0).toUpperCase() + monthName.slice(1), { align: 'center' });
    doc.moveDown(1.5);

    // ── Summary cards ───────────────────────────────────────
    doc.fontSize(13).fillColor(COLORS.primary).text('Podsumowanie');
    doc.moveDown(0.3);

    const summaryItems = [
      ['Pacjenci łącznie', String(report.patients.total)],
      ['Nowi w tym miesiącu', String(report.patients.newThisMonth)],
      ['Plany wygenerowane', String(report.plans.generated)],
      ['Plany zweryfikowane', String(report.plans.reviewed)],
      ['Plany opublikowane', String(report.plans.published)],
      ['Plany do ręcznej weryfikacji', String(report.plans.manualReviewRequired)],
      ['Średnia compliance', report.compliance.averagePercent != null ? `${report.compliance.averagePercent}%` : '—'],
      ['Liczba check-inów', String(report.compliance.checkInsCount)],
      ['Pacjenci z check-inami', String(report.compliance.patientsWithCheckIns)],
      ['Pacjenci z celem wagowym', String(report.goalProgress.patientsWithGoal)],
      ['Osiągnęli cel', String(report.goalProgress.patientsReachedGoal)],
    ];

    for (const [label, value] of summaryItems) {
      doc.fontSize(10).fillColor(COLORS.text).text(`${label}: `, { continued: true });
      doc.font('Helvetica-Bold').text(value).font('Helvetica');
    }

    doc.moveDown(1.5);

    // ── Patient table ───────────────────────────────────────
    if (report.patientSummaries.length > 0) {
      doc.fontSize(13).fillColor(COLORS.primary).text('Szczegóły pacjentów');
      doc.moveDown(0.5);

      const tableTop = doc.y;
      const colWidths = [140, 65, 65, 65, 55, 50, 55];
      const headers = ['Pacjent', 'Waga', 'Cel', 'Zmiana', 'Compl.', 'Check', 'Plany'];
      const tableLeft = 50;

      // Header row
      doc.fontSize(8).fillColor(COLORS.primary);
      let x = tableLeft;
      for (let i = 0; i < headers.length; i++) {
        doc.text(headers[i], x, tableTop, { width: colWidths[i], align: 'left' });
        x += colWidths[i];
      }

      doc
        .moveTo(tableLeft, tableTop + 14)
        .lineTo(tableLeft + colWidths.reduce((a, b) => a + b, 0), tableTop + 14)
        .strokeColor(COLORS.border)
        .stroke();

      let rowY = tableTop + 18;

      for (const ps of report.patientSummaries) {
        // New page if needed
        if (rowY > 750) {
          doc.addPage();
          rowY = 50;
        }

        const name = [ps.firstName, ps.lastName].filter(Boolean).join(' ') || '—';
        const row = [
          name,
          ps.currentWeightKg != null ? `${ps.currentWeightKg} kg` : '—',
          ps.goalWeightKg != null ? `${ps.goalWeightKg} kg` : '—',
          ps.weightChangeKg != null ? `${ps.weightChangeKg > 0 ? '+' : ''}${ps.weightChangeKg} kg` : '—',
          ps.avgCompliance != null ? `${ps.avgCompliance}%` : '—',
          String(ps.checkInsCount),
          String(ps.planCount),
        ];

        doc.fontSize(8).fillColor(COLORS.text);
        x = tableLeft;
        for (let i = 0; i < row.length; i++) {
          doc.text(row[i], x, rowY, { width: colWidths[i], align: 'left' });
          x += colWidths[i];
        }

        rowY += 14;
      }
    }

    // ── Footer ──────────────────────────────────────────────
    doc
      .fontSize(7)
      .fillColor(COLORS.muted)
      .text(
        `Wygenerowano: ${new Date().toLocaleDateString('pl-PL')}`,
        50,
        doc.page.height - 40,
        { align: 'center', width: doc.page.width - 100 }
      );

    doc.end();
  });
}
