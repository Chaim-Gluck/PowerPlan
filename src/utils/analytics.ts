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
/** Stable weekday keys (index 0 = Sunday) for i18n lookups. */
export const WEEKDAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

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

/** Total consumption per weekday. Only days present in the data are returned.
 *  `weekdayLabel(index)` lets the UI supply localised names. */
export function consumptionByWeekday(
  records: EnrichedRecord[],
  weekdayLabel: (index: number) => string = (i) => WEEKDAY_NAMES[i],
): NamedValue[] {
  const totals = new Array(7).fill(0);
  const present = new Array(7).fill(false);
  for (const r of records) {
    totals[r.weekday] += r.consumption;
    present[r.weekday] = true;
  }
  return totals
    .map((value, i) => ({ value, i }))
    .filter((e) => present[e.i])
    .map(({ value, i }) => ({ name: weekdayLabel(i), value }));
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

/** Labels for the weekday/weekend split (overridable for i18n). */
export interface SplitLabels {
  weekdays: string;
  weekend: string;
}

/** Weekday vs weekend split. */
export function weekdayWeekendSplit(
  records: EnrichedRecord[],
  labels: SplitLabels = { weekdays: 'Weekdays', weekend: 'Weekend' },
): NamedValue[] {
  let weekday = 0;
  let weekend = 0;
  for (const r of records) {
    if (isWeekend(r.weekday)) weekend += r.consumption;
    else weekday += r.consumption;
  }
  return [
    { name: labels.weekdays, value: weekday },
    { name: labels.weekend, value: weekend },
  ];
}

/** Builds a label for a time-of-day bucket given its start/end hour labels. */
export type BucketLabeler = (bucket: 'day' | 'evening' | 'night', start: string, end: string) => string;

const defaultBucketLabeler: BucketLabeler = (bucket, start, end) => {
  const name = bucket === 'day' ? 'Day' : bucket === 'evening' ? 'Evening' : 'Night';
  return `${name} (${start}–${end})`;
};

/** Day / evening / night split using the configured boundaries. */
export function timeOfDaySplit(
  records: EnrichedRecord[],
  boundaries: TimeBoundaries = DEFAULT_TIME_BOUNDARIES,
  label: BucketLabeler = defaultBucketLabeler,
): NamedValue[] {
  const buckets = { day: 0, evening: 0, night: 0 };
  for (const r of records) buckets[timeBucket(r.hour, boundaries)] += r.consumption;
  const { dayStart, eveningStart, nightStart } = boundaries;
  return [
    { name: label('day', hourLabel(dayStart), hourLabel(eveningStart)), value: buckets.day },
    { name: label('evening', hourLabel(eveningStart), hourLabel(nightStart)), value: buckets.evening },
    { name: label('night', hourLabel(nightStart), hourLabel(dayStart)), value: buckets.night },
  ];
}

/** A translatable insight: an i18n key + interpolation params. */
export interface Insight {
  key: string;
  params?: Record<string, string | number>;
}

/**
 * Generate insights (as i18n key + params) from the data and plan comparison.
 * Kept UI-agnostic: the React layer translates the returned keys.
 */
export function generateInsights(
  records: EnrichedRecord[],
  comparison: ComparisonResult | null,
  boundaries: TimeBoundaries = DEFAULT_TIME_BOUNDARIES,
): Insight[] {
  const insights: Insight[] = [];
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
  insights.push({ key: 'insights.weekdayEvening', params: { percent: pct(weekdayEvening / total) } });
  insights.push({
    key: 'insights.todSplit',
    params: { day: pct(tod.day / total), evening: pct(tod.evening / total), night: pct(tod.night / total) },
  });
  insights.push({ key: 'insights.weekendShare', params: { percent: pct(weekend / total) } });

  if (comparison && comparison.comparisons.length > 0) {
    const cheapest = comparison.cheapest;
    if (cheapest) {
      insights.push({
        key: 'insights.bestPlan',
        params: { plan: cheapest.planName, savings: nis(cheapest.savings), percent: pct(cheapest.savingsPercent / 100) },
      });
      const discounted = cheapest.appliedRules
        .filter((r) => r.discountPercent > 0)
        .reduce((s, r) => s + r.consumption, 0);
      insights.push({
        key: 'insights.discountShare',
        params: { plan: cheapest.planName, percent: pct(discounted / total) },
      });
    }
    for (const c of comparison.comparisons) {
      if (c.savingsPercent > 0 && c.savingsPercent < 2) {
        insights.push({ key: 'insights.weakPlan', params: { plan: c.planName, percent: pct(c.savingsPercent / 100) } });
      }
    }
    const withBilled = comparison.comparisons.find((c) => c.billedTotal != null);
    if (withBilled && withBilled.billedTotal) {
      const diff = withBilled.totalCost - withBilled.billedTotal;
      insights.push({
        key: 'insights.engineCheck',
        params: {
          computed: nis(withBilled.totalCost),
          billed: nis(withBilled.billedTotal),
          diff: nis(Math.abs(diff)),
          direction: diff >= 0 ? 'over' : 'under',
        },
      });
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
