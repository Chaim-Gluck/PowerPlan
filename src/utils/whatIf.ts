import type { EnrichedRecord } from '../pricing';
import { enrichRecords } from '../pricing';
import { timeBucket, DEFAULT_TIME_BOUNDARIES, type TimeBoundaries } from './analytics';

export type Bucket = 'day' | 'evening' | 'night';
export type DayType = 'weekday' | 'weekend';

/**
 * Core shift: move a fraction of consumption from one group to another, where
 * groups are defined by a classifier (time-of-day bucket, weekday/weekend, …).
 * The source group is scaled down by `fraction` and the target group scaled up
 * proportionally, so total energy is conserved and each group keeps its internal
 * shape. Kept generic so new axes (e.g. season) reuse the same tested logic.
 */
function shiftByGroup<K extends string>(
  records: EnrichedRecord[],
  classify: (r: EnrichedRecord) => K,
  from: K,
  to: K,
  fraction: number,
): EnrichedRecord[] {
  if (from === to || fraction <= 0) return records;
  const f = Math.min(Math.max(fraction, 0), 1);

  let sourceTotal = 0;
  let targetTotal = 0;
  for (const r of records) {
    const g = classify(r);
    if (g === from) sourceTotal += r.consumption;
    else if (g === to) targetTotal += r.consumption;
  }
  const moved = sourceTotal * f;
  if (moved <= 0 || targetTotal <= 0) return records;
  const targetScale = (targetTotal + moved) / targetTotal;

  const next = records.map((r) => {
    const g = classify(r);
    if (g === from) return { ...r, consumption: r.consumption * (1 - f) };
    if (g === to) return { ...r, consumption: r.consumption * targetScale };
    return r;
  });
  // Re-enrich to keep the type honest (fields unchanged but consumption differs).
  return enrichRecords(next);
}

/**
 * "What-if" simulator: shift a fraction of consumption from one time-of-day
 * bucket to another (e.g. move 20% of daytime usage to night). Total energy is
 * conserved.
 */
export function shiftConsumption(
  records: EnrichedRecord[],
  from: Bucket,
  to: Bucket,
  fraction: number,
  boundaries: TimeBoundaries = DEFAULT_TIME_BOUNDARIES,
): EnrichedRecord[] {
  return shiftByGroup(records, (r) => timeBucket(r.hour, boundaries), from, to, fraction);
}

/** Israel weekend = Friday (5) and Saturday (6), matching the day filters. */
const isWeekend = (r: EnrichedRecord) => r.weekday === 5 || r.weekday === 6;

/**
 * "What-if" simulator on the day-type axis: shift a fraction of consumption
 * between weekdays and weekends (e.g. move 20% of weekend usage to weekdays).
 * Total energy is conserved.
 */
export function shiftByDayType(
  records: EnrichedRecord[],
  from: DayType,
  to: DayType,
  fraction: number,
): EnrichedRecord[] {
  return shiftByGroup(records, (r) => (isWeekend(r) ? 'weekend' : 'weekday'), from, to, fraction);
}
