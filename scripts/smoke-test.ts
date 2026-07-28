import { readFileSync } from 'node:fs';
import { importCsvText } from '../src/utils/dataImport';
import { enrichRecords, BillCalculator, defaultPlans, DEFAULT_BASE_PRICE } from '../src/pricing';
import { summarize, generateInsights } from '../src/utils/analytics';

const path = process.argv[2];
const text = readFileSync(path, 'utf8');

console.time('import');
const result = importCsvText(text);
console.timeEnd('import');
console.log('format:', result.format, '| interval:', result.intervalMinutes, 'min | records:', result.records.length);

console.time('enrich+compare');
const enriched = enrichRecords(result.records);
const summary = summarize(enriched, result.intervalMinutes);
const cmp = BillCalculator.compareAll(enriched, defaultPlans(), DEFAULT_BASE_PRICE);
console.timeEnd('enrich+compare');

console.log('date range:', summary.startDate, '->', summary.endDate, '| months:', summary.monthCount);
console.log('total kWh:', summary.totalConsumption.toFixed(1), '| base cost NIS:', cmp.baseCost.toFixed(0));
console.log('\nPlan comparison:');
for (const c of cmp.comparisons) {
  console.log(
    `  ${c.isCheapest ? '★' : ' '} ${c.planName.padEnd(30)} total ₪${c.totalCost.toFixed(0).padStart(7)}  save ₪${c.savings.toFixed(0).padStart(6)} (${c.savingsPercent.toFixed(1)}%)  avg/mo ₪${c.averageMonthlyCost.toFixed(0)}`,
  );
}
console.log('\nInsights:');
for (const i of generateInsights(enriched, cmp)) console.log('  •', i);
