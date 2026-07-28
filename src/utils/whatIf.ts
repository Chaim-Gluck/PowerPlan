import type { EnrichedRecord } from '../pricing';
import { enrichRecords } from '../pricing';
import { timeBucket, DEFAULT_TIME_BOUNDARIES, type TimeBoundaries } from './analytics';

export type Bucket = 'day' | 'evening' | 'night';

/**
 * "What-if" simulator: shift a fraction of consumption from one time-of-day
 * bucket to another (e.g. move 20% of daytime usage to night) and return a new
 * set of records. Total energy is conserved.
 */
export function shiftConsumption(
  records: EnrichedRecord[],
  from: Bucket,
  to: Bucket,
  fraction: number,
  boundaries: TimeBoundaries = DEFAULT_TIME_BOUNDARIES,
): EnrichedRecord[] {
  if (from === to || fraction <= 0) return records;
  const f = Math.min(Math.max(fraction, 0), 1);

  let sourceTotal = 0;
  let targetTotal = 0;
  for (const r of records) {
    const b = timeBucket(r.hour, boundaries);
    if (b === from) sourceTotal += r.consumption;
    else if (b === to) targetTotal += r.consumption;
  }
  const moved = sourceTotal * f;
  if (moved <= 0 || targetTotal <= 0) return records;
  const targetScale = (targetTotal + moved) / targetTotal;

  const next = records.map((r) => {
    const b = timeBucket(r.hour, boundaries);
    if (b === from) return { ...r, consumption: r.consumption * (1 - f) };
    if (b === to) return { ...r, consumption: r.consumption * targetScale };
    return r;
  });
  // Re-enrich to keep the type honest (fields unchanged but consumption differs).
  return enrichRecords(next);
}
