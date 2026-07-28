import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import type { ConsumptionRecord } from '../pricing';

dayjs.extend(customParseFormat);

/** Outcome of importing a data file. */
export interface ImportResult {
  records: ConsumptionRecord[];
  /** Detected sampling interval in minutes (15 / 30 / 60 ...). */
  intervalMinutes: number;
  /** Non-fatal messages surfaced to the user. */
  warnings: string[];
  /** Which parsing strategy succeeded. */
  format: 'iec' | 'generic';
  /** True if the file also contained a real billed cost column. */
  hasBilledCost: boolean;
}

const DATE_RE = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/;
const TIME_RE = /^(\d{1,2}):(\d{2})(?::\d{2})?$/;

/** Entry point: parse a File (CSV or XLSX) into consumption records. */
export async function importFile(file: File): Promise<ImportResult> {
  const name = file.name.toLowerCase();
  const rows = name.endsWith('.xlsx') || name.endsWith('.xls')
    ? await readExcelRows(file)
    : await readCsvRows(file);
  return parseRows(rows);
}

/** Parse raw CSV text (used for the bundled sample). */
export function importCsvText(text: string): ImportResult {
  const parsed = Papa.parse<string[]>(text, { skipEmptyLines: true });
  return parseRows(parsed.data as string[][]);
}

async function readCsvRows(file: File): Promise<string[][]> {
  const text = await file.text();
  const parsed = Papa.parse<string[]>(text, { skipEmptyLines: true });
  return parsed.data as string[][];
}

async function readExcelRows(file: File): Promise<string[][]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json<string[]>(sheet, {
    header: 1,
    raw: false,
    defval: '',
  });
}

/**
 * Convert a 2D grid of strings into records. Tries the IEC array layout first
 * (date + time + consumption cells anywhere in a row) then a header-based
 * generic layout (Timestamp + Consumption columns).
 */
function parseRows(rows: string[][]): ImportResult {
  const iec = tryParseIec(rows);
  if (iec.records.length > 0) return finalize(iec.records, iec.warnings, 'iec');

  const generic = tryParseGeneric(rows);
  if (generic.records.length > 0) {
    return finalize(generic.records, generic.warnings, 'generic');
  }

  throw new Error(
    'Could not find timestamp + consumption data in the file. Expected either the IEC meter export, or columns named like "Timestamp"/"Date" and "Consumption"/"kWh".',
  );
}

/**
 * IEC / positional layout: scan every row for a date cell, a time cell and a
 * numeric consumption cell that follows the time. Works regardless of the
 * Hebrew metadata header rows and column ordering.
 */
function tryParseIec(rows: string[][]): { records: ConsumptionRecord[]; warnings: string[] } {
  const records: ConsumptionRecord[] = [];
  const warnings: string[] = [];
  let badRows = 0;

  for (const row of rows) {
    if (!row || row.length < 3) continue;
    const cells = row.map((c) => (c ?? '').toString().trim());

    let dateIdx = -1;
    let timeIdx = -1;
    for (let i = 0; i < cells.length; i++) {
      if (dateIdx === -1 && DATE_RE.test(cells[i])) dateIdx = i;
      else if (dateIdx !== -1 && timeIdx === -1 && TIME_RE.test(cells[i])) {
        timeIdx = i;
        break;
      }
    }
    if (dateIdx === -1 || timeIdx === -1) continue;

    // Consumption = first numeric cell after the time cell.
    let consumption: number | null = null;
    let consIdx = -1;
    for (let i = timeIdx + 1; i < cells.length; i++) {
      const n = parseNumber(cells[i]);
      if (n != null) {
        consumption = n;
        consIdx = i;
        break;
      }
    }
    if (consumption == null) continue;

    const tsMs = buildTimestamp(cells[dateIdx], cells[timeIdx]);
    if (tsMs == null) {
      badRows++;
      continue;
    }

    // Optional billed cost: a later numeric cell that is clearly a currency-ish value.
    const billed = findBilledCost(cells, consIdx);
    records.push(billed != null ? { tsMs, consumption, billedCost: billed } : { tsMs, consumption });
  }

  if (badRows > 0) warnings.push(`${badRows} row(s) had an unrecognised date/time and were skipped.`);
  return { records, warnings };
}

/**
 * Generic layout: locate a header row, then map columns by name.
 */
function tryParseGeneric(rows: string[][]): { records: ConsumptionRecord[]; warnings: string[] } {
  const records: ConsumptionRecord[] = [];
  const warnings: string[] = [];
  if (rows.length < 2) return { records, warnings };

  // Find a header row within the first few rows.
  let headerIdx = -1;
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const lc = rows[i].map((c) => (c ?? '').toString().toLowerCase());
    if (lc.some((c) => /time|date|תאריך|מועד/.test(c)) &&
        lc.some((c) => /consum|kwh|usage|energy|צריכה|קוט/.test(c))) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx === -1) return { records, warnings };

  const header = rows[headerIdx].map((c) => (c ?? '').toString().toLowerCase().trim());
  const tsCol = header.findIndex((c) => /timestamp|datetime|date|time|תאריך|מועד/.test(c));
  const dateCol = header.findIndex((c) => /^date|תאריך/.test(c));
  const timeCol = header.findIndex((c) => /^time|שעה|מועד/.test(c));
  const consCol = header.findIndex((c) => /consum|kwh|usage|energy|צריכה|קוט/.test(c));
  const costCol = header.findIndex((c) => /cost|bill|amount|charge|price|₪|nis|עלות|חיוב/.test(c));

  if (consCol === -1) return { records, warnings };

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const cells = rows[i].map((c) => (c ?? '').toString().trim());
    if (cells.every((c) => c === '')) continue;

    const consumption = parseNumber(cells[consCol]);
    if (consumption == null) continue;

    let tsMs: number | null = null;
    if (dateCol !== -1 && timeCol !== -1 && dateCol !== timeCol) {
      tsMs = buildTimestamp(cells[dateCol], cells[timeCol]);
    }
    if (tsMs == null && tsCol !== -1) tsMs = parseAnyTimestamp(cells[tsCol]);
    if (tsMs == null) continue;

    const cost = costCol !== -1 ? parseNumber(cells[costCol]) : null;
    records.push(cost != null ? { tsMs, consumption, billedCost: cost } : { tsMs, consumption });
  }

  return { records, warnings };
}

function finalize(
  records: ConsumptionRecord[],
  warnings: string[],
  format: 'iec' | 'generic',
): ImportResult {
  records.sort((a, b) => a.tsMs - b.tsMs);
  const intervalMinutes = detectInterval(records);
  const hasBilledCost = records.some((r) => r.billedCost != null);
  return { records, intervalMinutes, warnings, format, hasBilledCost };
}

/** Most common gap between consecutive timestamps, in minutes. */
export function detectInterval(records: ConsumptionRecord[]): number {
  if (records.length < 2) return 60;
  const counts = new Map<number, number>();
  const limit = Math.min(records.length, 2000);
  for (let i = 1; i < limit; i++) {
    const diff = Math.round((records[i].tsMs - records[i - 1].tsMs) / 60000);
    if (diff > 0 && diff <= 60) counts.set(diff, (counts.get(diff) ?? 0) + 1);
  }
  let best = 60;
  let bestCount = 0;
  for (const [diff, count] of counts) {
    if (count > bestCount) {
      best = diff;
      bestCount = count;
    }
  }
  // Snap to the nearest supported interval.
  const supported = [15, 30, 60];
  return supported.reduce((a, b) => (Math.abs(b - best) < Math.abs(a - best) ? b : a));
}

/** Build epoch ms from a date string (DD/MM/YYYY or ISO) and a time string. */
function buildTimestamp(dateStr: string, timeStr: string): number | null {
  const m = DATE_RE.exec(dateStr);
  const t = TIME_RE.exec(timeStr);
  if (!t) return null;
  const hh = parseInt(t[1], 10);
  const mm = parseInt(t[2], 10);

  if (m) {
    // Ambiguous DD/MM vs MM/DD: IEC uses DD/MM/YYYY. If first > 12 it's the day.
    let a = parseInt(m[1], 10);
    let b = parseInt(m[2], 10);
    let year = parseInt(m[3], 10);
    if (year < 100) year += 2000;
    let day: number;
    let month: number;
    if (a > 12) {
      day = a;
      month = b;
    } else if (b > 12) {
      month = a;
      day = b;
    } else {
      // Default to DD/MM (IEC and Israeli locale).
      day = a;
      month = b;
    }
    const d = dayjs(new Date(year, month - 1, day, hh, mm, 0));
    return d.isValid() ? d.valueOf() : null;
  }

  // Fall back to ISO date part.
  const iso = dayjs(`${dateStr} ${timeStr}`);
  return iso.isValid() ? iso.valueOf() : null;
}

/** Parse any single timestamp cell across common formats. */
function parseAnyTimestamp(value: string): number | null {
  if (!value) return null;
  const formats = [
    'YYYY-MM-DDTHH:mm:ss',
    'YYYY-MM-DDTHH:mm',
    'YYYY-MM-DD HH:mm:ss',
    'YYYY-MM-DD HH:mm',
    'DD/MM/YYYY HH:mm',
    'DD/MM/YYYY HH:mm:ss',
    'MM/DD/YYYY HH:mm',
    'DD/MM/YYYY',
    'YYYY-MM-DD',
  ];
  for (const f of formats) {
    const d = dayjs(value, f, true);
    if (d.isValid()) return d.valueOf();
  }
  const loose = dayjs(value);
  return loose.isValid() ? loose.valueOf() : null;
}

/** Parse a number, tolerating leading dots (".376"), commas and blanks. */
function parseNumber(value: string | undefined): number | null {
  if (value == null) return null;
  let s = value.toString().trim();
  if (s === '' || s === '-') return null;
  s = s.replace(/,/g, '');
  if (s.startsWith('.')) s = '0' + s;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/**
 * Heuristic to spot an optional billed-cost column in positional data. IEC
 * exports put an "injection" (usually 0) after consumption; we only treat a
 * later non-zero currency-scale value as a billed cost, so plain 0s are ignored.
 */
function findBilledCost(cells: string[], consIdx: number): number | null {
  for (let i = consIdx + 1; i < cells.length; i++) {
    const raw = cells[i];
    if (/[₪]|nis/i.test(raw)) {
      const n = parseNumber(raw.replace(/[₪]|nis/gi, ''));
      if (n != null) return n;
    }
  }
  return null;
}
