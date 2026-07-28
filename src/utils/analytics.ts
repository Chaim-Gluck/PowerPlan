import dayjs from 'dayjs';
import type { EnrichedRecord } from '../pricing';
import type { ComparisonResult } from '../pricing';

/** High-level dataset summary shown on the dashboard. */
export interface DataSummary {
  recordCount: number;
  totalConsumption: number;
  startDate: string;
  endDate: string;
  dayCount: number;
  averageDailyConsumption: number;
  intervalMinutes: number;
  monthCount: number;
  averageMonthlyConsumption: number;
}

export interface NamedValue {
  name: string;
  value: number;
}

/** Weekend in Israel = Friday (5) & Saturday (6). */
export function isWeekend(weekday: number): boolean {
  return weekday === 5 || weekday === 6;
}

/** Configurable day/evening/night boundaries (hours 0–23). */
export interface TimeBoundaries {
  /** Hour at which "day" begins (default 7). */
  dayStart: number;
  /** Hour at which "evening" begins (default 17). */
  eveningStart: number;
  /** Hour at which "night" begins (default 23). */
  nightStart: number;
}

/** Default boundaries: day 07:00, evening 17:00, night 23:00. */
export const DEFAULT_TIME_BOUNDARIES: TimeBoundaries = {
  dayStart: 7,
  eveningStart: 17,
  nightStart: 23,
};

/**
 * Time-of-day bucket for distribution analysis. Requires
 * `dayStart < eveningStart < nightStart`; "night" wraps midnight, covering
 * `[nightStart, 24)` and `[0, dayStart)`.
 */
export function timeBucket(hour: number, b: TimeBoundaries = DEFAULT_TIME_BOUNDARIES): 'night' | 'day' | 'evening' {
  if (hour >= b.dayStart && hour < b.eveningStart) return 'day';
  if (hour >= b.eveningStart && hour < b.nightStart) return 'evening';
  return 'night';
}

/** `HH:00` label for an hour. */
function hourLabel(h: number): string {
  return `${String(h).padStart(2, '0')}:00`;
}

export function summarize(records: EnrichedRecord[], intervalMinutes: number): DataSummary {
  if (records.length === 0) {
    return {
      recordCount: 0,
      totalConsumption: 0,
      startDate: '',
      endDate: '',
      dayCount: 0,
      averageDailyConsumption: 0,
      intervalMinutes,
      monthCount: 0,
      averageMonthlyConsumption: 0,
    };
  }
  const total = records.reduce((s, r) => s + r.consumption, 0);
  const start = dayjs(records[0].tsMs);
  const end = dayjs(records[records.length - 1].tsMs);
  const dayCount = Math.max(end.diff(start, 'day') + 1, 1);
  const monthCount = new Set(records.map((r) => r.monthKey)).size;
  return {
    recordCount: records.length,
    totalConsumption: total,
    startDate: start.format('DD/MM/YYYY'),
    endDate: end.format('DD/MM/YYYY'),
    dayCount,
    averageDailyConsumption: total / dayCount,
    intervalMinutes,
    monthCount,
    averageMonthlyConsumption: total / Math.max(monthCount, 1),
  };
}

/** Sum a numeric field grouped by a key extractor. */
function groupSum<T>(items: T[], key: (t: T) => string, value: (t: T) => number): Map<string, number> {
  const m = new Map<string, number>();
  for (const it of items) {
    const k = key(it);
    m.set(k, (m.get(k) ?? 0) + value(it));
  }
  return m;
}

/** Daily consumption series, sorted by date. */
export function dailyConsumption(records: EnrichedRecord[]): NamedValue[] {
  const m = groupSum(records, (r) => r.dayKey, (r) => r.consumption);
  return Array.from(m.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([name, value]) => ({ name, value }));
}

/** Monthly consumption series. */
export function monthlyConsumption(records: EnrichedRecord[]): NamedValue[] {
  const m = groupSum(records, (r) => r.monthKey, (r) => r.consumption);
  return Array.from(m.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([name, value]) => ({ name, value }));
}

/** ISO-week consumption series (`YYYY-Www`). */
export function weeklyConsumption(records: EnrichedRecord[]): NamedValue[] {
  const m = groupSum(
    records,
    (r) => {
      const d = dayjs(r.tsMs);
      const onejan = dayjs(new Date(d.year(), 0, 1));
      const week = Math.ceil((d.diff(onejan, 'day') + onejan.day() + 1) / 7);
      return `${d.year()}-W${String(week).padStart(2, '0')}`;
    },
    (r) => r.consumption,
  );
  return Array.from(m.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([name, value]) => ({ name, value }));
}

const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Average consumption per hour of day (0–23). */
export function consumptionByHour(records: EnrichedRecord[]): NamedValue[] {
  const totals = new Array(24).fill(0);
  const counts = new Array(24).fill(0);
  for (const r of records) {
    totals[r.hour] += r.consumption;
    counts[r.hour] += 1;
  }
  return totals.map((t, h) => ({
    name: `${String(h).padStart(2, '0')}:00`,
    value: t,
  }));
}

/** Total consumption per weekday. Only days present in the data are returned,
 *  so applying a weekday/weekend filter shows just the relevant days instead of
 *  misleading empty bars. */
export function consumptionByWeekday(records: EnrichedRecord[]): NamedValue[] {
  const totals = new Array(7).fill(0);
  const present = new Array(7).fill(false);
  for (const r of records) {
    totals[r.weekday] += r.consumption;
    present[r.weekday] = true;
  }
  return totals
    .map((value, i) => ({ name: WEEKDAY_NAMES[i], value, i }))
    .filter((e) => present[e.i])
    .map(({ name, value }) => ({ name, value }));
}

/** Heatmap cell: weekday × hour average. */
export interface HeatCell {
  weekday: number;
  hour: number;
  value: number;
}

/** Weekday × hour matrix of total consumption (for the heatmap). Only weekdays
 *  present in the data are included, so a weekday/weekend filter hides the
 *  irrelevant rows rather than showing empty ones. */
export function hourWeekdayHeatmap(records: EnrichedRecord[]): HeatCell[] {
  const grid = Array.from({ length: 7 }, () => new Array(24).fill(0));
  const present = new Array(7).fill(false);
  for (const r of records) {
    grid[r.weekday][r.hour] += r.consumption;
    present[r.weekday] = true;
  }
  const cells: HeatCell[] = [];
  for (let d = 0; d < 7; d++) {
    if (!present[d]) continue;
    for (let h = 0; h < 24; h++) {
      cells.push({ weekday: d, hour: h, value: grid[d][h] });
    }
  }
  return cells;
}

export const WEEKDAY_LABELS = WEEKDAY_NAMES;

/** Weekday vs weekend split. */
export function weekdayWeekendSplit(records: EnrichedRecord[]): NamedValue[] {
  let weekday = 0;
  let weekend = 0;
  for (const r of records) {
    if (isWeekend(r.weekday)) weekend += r.consumption;
    else weekday += r.consumption;
  }
  return [
    { name: 'Weekdays', value: weekday },
    { name: 'Weekend', value: weekend },
  ];
}

/** Day / evening / night split using the configured boundaries. */
export function timeOfDaySplit(
  records: EnrichedRecord[],
  boundaries: TimeBoundaries = DEFAULT_TIME_BOUNDARIES,
): NamedValue[] {
  const buckets = { day: 0, evening: 0, night: 0 };
  for (const r of records) buckets[timeBucket(r.hour, boundaries)] += r.consumption;
  const { dayStart, eveningStart, nightStart } = boundaries;
  return [
    { name: `Day (${hourLabel(dayStart)}–${hourLabel(eveningStart)})`, value: buckets.day },
    { name: `Evening (${hourLabel(eveningStart)}–${hourLabel(nightStart)})`, value: buckets.evening },
    { name: `Night (${hourLabel(nightStart)}–${hourLabel(dayStart)})`, value: buckets.night },
  ];
}

/**
 * Generate natural-language insights from the data and the plan comparison.
 */
export function generateInsights(
  records: EnrichedRecord[],
  comparison: ComparisonResult | null,
  boundaries: TimeBoundaries = DEFAULT_TIME_BOUNDARIES,
): string[] {
  const insights: string[] = [];
  if (records.length === 0) return insights;

  const total = records.reduce((s, r) => s + r.consumption, 0) || 1;

  // Weekday evening share.
  let weekdayEvening = 0;
  let weekend = 0;
  const tod = { day: 0, evening: 0, night: 0 };
  for (const r of records) {
    if (isWeekend(r.weekday)) weekend += r.consumption;
    if (!isWeekend(r.weekday) && timeBucket(r.hour, boundaries) === 'evening') {
      weekdayEvening += r.consumption;
    }
    tod[timeBucket(r.hour, boundaries)] += r.consumption;
  }
  insights.push(
    `You consume ${pct(weekdayEvening / total)} of your electricity during weekday evenings.`,
  );
  insights.push(
    `Your usage splits into ${pct(tod.day / total)} daytime, ${pct(tod.evening / total)} evening and ${pct(tod.night / total)} night.`,
  );
  insights.push(`${pct(weekend / total)} of your consumption falls on weekends (Fri–Sat).`);

  if (comparison && comparison.comparisons.length > 0) {
    const cheapest = comparison.cheapest;
    if (cheapest) {
      insights.push(
        `Your best plan is “${cheapest.planName}”, saving ${nis(cheapest.savings)} (${pct(cheapest.savingsPercent / 100)}) over the imported period vs. the flat base price.`,
      );
    }
    // Share of consumption that actually landed in a discounted window (cheapest plan).
    if (cheapest) {
      const discounted = cheapest.appliedRules
        .filter((r) => r.discountPercent > 0)
        .reduce((s, r) => s + r.consumption, 0);
      insights.push(
        `Under “${cheapest.planName}”, only ${pct(discounted / total)} of your usage occurs during discount hours.`,
      );
    }
    // Call out weak plans.
    for (const c of comparison.comparisons) {
      if (c.savingsPercent > 0 && c.savingsPercent < 2) {
        insights.push(
          `The “${c.planName}” plan saves only ${pct(c.savingsPercent / 100)} because your usage barely overlaps its discount window.`,
        );
      }
    }
    // Billed-cost validation.
    const withBilled = comparison.comparisons.find((c) => c.billedTotal != null);
    if (withBilled && withBilled.billedTotal) {
      const diff = withBilled.totalCost - withBilled.billedTotal;
      insights.push(
        `Engine check: computed ${nis(withBilled.totalCost)} vs. billed ${nis(withBilled.billedTotal)} (${nis(Math.abs(diff))} ${diff >= 0 ? 'over' : 'under'}).`,
      );
    }
  }

  return insights;
}

function pct(fraction: number): string {
  return `${(fraction * 100).toFixed(1)}%`;
}
function nis(v: number): string {
  return `₪${v.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}
