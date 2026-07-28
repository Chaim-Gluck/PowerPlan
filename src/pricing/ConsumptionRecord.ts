import dayjs, { type Dayjs } from 'dayjs';

/**
 * A single electricity consumption measurement.
 *
 * The record is intentionally minimal for storage/serialization: it holds the
 * timestamp (as epoch milliseconds) and the consumption in kWh. Optional
 * `billedCost` lets us validate the pricing engine against a real bill when the
 * source file provides it.
 */
export interface ConsumptionRecord {
  /** Epoch milliseconds of the interval start. */
  tsMs: number;
  /** Energy consumed during the interval, in kWh. */
  consumption: number;
  /** Optional real cost billed by the utility for this interval (for validation). */
  billedCost?: number;
}

/**
 * A {@link ConsumptionRecord} enriched with precomputed calendar fields.
 *
 * Enrichment happens once (at import / load time) so the pricing engine and the
 * charts can iterate tens of thousands of records without repeatedly parsing
 * dates. All derived fields are pure functions of `tsMs`.
 */
export interface EnrichedRecord extends ConsumptionRecord {
  /** Day of week, 0 = Sunday .. 6 = Saturday (matches Day.js `.day()`). */
  weekday: number;
  /** Minute of the day in [0, 1440). */
  minuteOfDay: number;
  /** Hour of the day in [0, 24). */
  hour: number;
  /** `YYYY-MM-DD` local day key, used for daily aggregation. */
  dayKey: string;
  /** `YYYY-MM` local month key, used for monthly aggregation. */
  monthKey: string;
  /** `YYYY` local year key, used for yearly aggregation. */
  yearKey: string;
}

/**
 * Enrich a raw record with calendar fields derived from its timestamp.
 */
export function enrichRecord(record: ConsumptionRecord): EnrichedRecord {
  const d = dayjs(record.tsMs);
  return {
    ...record,
    weekday: d.day(),
    minuteOfDay: d.hour() * 60 + d.minute(),
    hour: d.hour(),
    dayKey: d.format('YYYY-MM-DD'),
    monthKey: d.format('YYYY-MM'),
    yearKey: d.format('YYYY'),
  };
}

/**
 * Enrich a list of raw records. Sorted ascending by timestamp so downstream
 * interval detection and charting can rely on ordering.
 */
export function enrichRecords(records: ConsumptionRecord[]): EnrichedRecord[] {
  return records
    .slice()
    .sort((a, b) => a.tsMs - b.tsMs)
    .map(enrichRecord);
}

/** Day.js helper for a record. */
export function recordDate(record: ConsumptionRecord): Dayjs {
  return dayjs(record.tsMs);
}
