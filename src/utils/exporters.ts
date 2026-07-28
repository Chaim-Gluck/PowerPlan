import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { ComparisonResult } from '../pricing';
import { formatNIS, formatKWh, formatPercent } from './format';

/** Export the comparison table to an .xlsx file. */
export function exportComparisonExcel(result: ComparisonResult): void {
  const rows = result.comparisons.map((c) => ({
    Plan: c.planName,
    Supplier: c.supplier ?? '',
    'Total Cost (₪)': round2(c.totalCost),
    'Savings vs Base (₪)': round2(c.savings),
    'Savings %': round2(c.savingsPercent),
    'Avg Monthly (₪)': round2(c.averageMonthlyCost),
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

  XLSX.writeFile(wb, 'iec-tariff-comparison.xlsx');
}

/** Export the comparison table to a PDF report. */
export function exportComparisonPdf(result: ComparisonResult): void {
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text('IEC Tariff Comparison', 14, 18);
  doc.setFontSize(10);
  doc.text(
    `Base price: ${formatNIS(result.basePrice, 4)}/kWh   •   Total: ${formatKWh(
      result.totalConsumption,
    )}   •   ${result.monthCount} months`,
    14,
    26,
  );

  autoTable(doc, {
    startY: 32,
    head: [[
      'Plan',
      'Supplier',
      'Total Cost',
      'Savings vs Base',
      'Savings %',
      'Avg Monthly',
      'Est. Yearly',
    ]],
    body: result.comparisons.map((c) => [
      c.planName + (c.isCheapest ? '  ★' : ''),
      c.supplier ?? '',
      formatNIS(c.totalCost),
      formatNIS(c.savings),
      formatPercent(c.savingsPercent),
      formatNIS(c.averageMonthlyCost),
      formatNIS(c.estimatedYearlyCost),
    ]),
    styles: { fontSize: 9 },
    headStyles: { fillColor: [25, 118, 210] },
  });

  doc.save('iec-tariff-comparison.pdf');
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
