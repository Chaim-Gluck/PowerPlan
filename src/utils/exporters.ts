import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTableDefault from 'jspdf-autotable';
import type { ComparisonResult } from '../pricing';
import { formatPercent } from './format';

// jspdf-autotable ships CJS; depending on the bundler the default import may be
// either the function itself or `{ default: fn }`. Normalise so it's callable
// in every environment (Vite browser build, tsx/node, etc.).
const autoTable = (
  (autoTableDefault as unknown as { default?: unknown }).default ?? autoTableDefault
) as (doc: jsPDF, options: Record<string, unknown>) => void;

/** Export the comparison table to an .xlsx file. */
export function exportComparisonExcel(result: ComparisonResult): void {
  const rows = result.comparisons.map((c) => ({
    Plan: c.planName,
    Supplier: c.supplier ?? '',
    'Total Cost (₪)': round2(c.totalCost),
    'Savings vs Base (₪)': round2(c.savings),
    'Savings %': round2(c.savingsPercent),
    'Avg Monthly (₪)': round2(c.averageMonthlyCost),
    'Avg Monthly Savings (₪)': round2(c.savings / Math.max(result.monthCount, 1)),
    'Est. Yearly (₪)': round2(c.estimatedYearlyCost),
    Cheapest: c.isCheapest ? 'YES' : '',
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Comparison');

  const meta = XLSX.utils.json_to_sheet([
    { Metric: 'Base price (₪/kWh)', Value: result.basePrice },
    { Metric: 'Total consumption (kWh)', Value: round2(result.totalConsumption) },
    { Metric: 'Base cost (₪)', Value: round2(result.baseCost) },
    { Metric: 'Months of data', Value: result.monthCount },
  ]);
  XLSX.utils.book_append_sheet(wb, meta, 'Summary');

  XLSX.writeFile(wb, 'powerplan-comparison.xlsx');
}

/** Export the comparison table to a PDF report. */
export function exportComparisonPdf(result: ComparisonResult): void {
  const doc = new jsPDF();
  // jsPDF's built-in fonts only support WinAnsi/Latin-1, so avoid the New Sheqel
  // sign (₪, U+20AA) and other non-Latin-1 glyphs — they corrupt text rendering.
  // Money is shown as plain numbers with "NIS" in the column headers instead.
  const num = (v: number) => Math.round(v).toLocaleString('en-US');

  doc.setFontSize(16);
  doc.text('PowerPlan - Tariff Comparison', 14, 18);
  doc.setFontSize(10);
  doc.text(
    `Base price: NIS ${result.basePrice.toFixed(4)}/kWh   |   Total: ${num(result.totalConsumption)} kWh   |   ${result.monthCount} months`,
    14,
    26,
  );

  autoTable(doc, {
    startY: 32,
    head: [[
      'Plan',
      'Supplier',
      'Total (NIS)',
      'Savings (NIS)',
      'Savings %',
      'Avg/mo (NIS)',
      'Avg Save/mo (NIS)',
      'Est./yr (NIS)',
    ]],
    body: result.comparisons.map((c) => [
      c.planName + (c.isCheapest ? '  *' : ''),
      c.supplier ?? '',
      num(c.totalCost),
      num(c.savings),
      formatPercent(c.savingsPercent),
      num(c.averageMonthlyCost),
      num(c.savings / Math.max(result.monthCount, 1)),
      num(c.estimatedYearlyCost),
    ]),
    styles: { fontSize: 9 },
    headStyles: { fillColor: [25, 118, 210] },
  });

  doc.save('powerplan-comparison.pdf');
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
