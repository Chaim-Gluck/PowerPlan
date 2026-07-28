/**
 * A pricing rule inside a {@link TariffPlan}.
 *
 * A rule grants a discount (relative to the base price) when a consumption
 * interval falls within the configured days of week AND time-of-day window.
 *
 * Design notes / future-proofing:
 * - Matching is expressed against a {@link RuleContext} rather than a raw
 *   record so we can later add seasonal / holiday / date-range constraints
 *   without touching the engine's iteration loop.
 * - Time windows are stored as minute-of-day so half-hour and quarter-hour
 *   intervals are represented losslessly, and overnight windows (e.g. 22:00 ->
 *   06:00) are supported by allowing `endMinutes <= startMinutes` to wrap past
 *   midnight.
 */
export interface TariffRule {
  /** Stable id (used as React key and for editing). */
  id: string;
  /** Optional human label shown in the editor and "kWh per rule" breakdowns. */
  label?: string;
  /** Days of week the rule applies to. 0 = Sunday .. 6 = Saturday. */
  daysOfWeek: number[];
  /** Inclusive start minute-of-day in [0, 1440]. */
  startMinutes: number;
  /** Exclusive end minute-of-day in [0, 1440]. May wrap past midnight. */
  endMinutes: number;
  /** Discount percentage in [0, 100] applied to the base price. */
  discountPercent: number;

  // --- Reserved for future features (ignored by the current engine) ---
  /** Optional inclusive season start as `MM-DD` (e.g. summer tariffs). */
  seasonStart?: string;
  /** Optional inclusive season end as `MM-DD`. */
  seasonEnd?: string;
  /** If true the rule only applies on holidays (requires a holiday provider). */
  holidaysOnly?: boolean;
}

/**
 * The context evaluated against a rule for a single consumption interval.
 * Additional fields (isHoliday, month, etc.) can be added here as the engine
 * grows, keeping {@link ruleMatches} the single source of truth for matching.
 */
export interface RuleContext {
  weekday: number;
  minuteOfDay: number;
  /** `MM-DD` for optional seasonal matching. */
  monthDay: string;
  isHoliday?: boolean;
}

/** Minutes in a full day. */
export const MINUTES_PER_DAY = 24 * 60;

/**
 * Does the given time-of-day fall inside the rule's window?
 * Supports windows that wrap past midnight (endMinutes <= startMinutes).
 */
export function timeInWindow(
  minuteOfDay: number,
  startMinutes: number,
  endMinutes: number,
): boolean {
  // Full-day window.
  if (startMinutes === 0 && (endMinutes === 0 || endMinutes >= MINUTES_PER_DAY)) {
    return true;
  }
  if (startMinutes < endMinutes) {
    return minuteOfDay >= startMinutes && minuteOfDay < endMinutes;
  }
  // Wraps past midnight, e.g. 22:00 -> 06:00.
  return minuteOfDay >= startMinutes || minuteOfDay < endMinutes;
}

/** Number of minutes covered by a (possibly wrapping) time window. */
export function windowMinutes(startMinutes: number, endMinutes: number): number {
  if (startMinutes === 0 && (endMinutes === 0 || endMinutes >= MINUTES_PER_DAY)) {
    return MINUTES_PER_DAY;
  }
  if (startMinutes < endMinutes) return endMinutes - startMinutes;
  return MINUTES_PER_DAY - startMinutes + endMinutes;
}

/**
 * Whether a rule matches the given context (day + time [+ future constraints]).
 */
export function ruleMatches(rule: TariffRule, ctx: RuleContext): boolean {
  if (rule.daysOfWeek.length > 0 && !rule.daysOfWeek.includes(ctx.weekday)) {
    return false;
  }
  if (rule.holidaysOnly && !ctx.isHoliday) return false;
  if (rule.seasonStart && rule.seasonEnd) {
    if (!monthDayInSeason(ctx.monthDay, rule.seasonStart, rule.seasonEnd)) {
      return false;
    }
  }
  return timeInWindow(ctx.minuteOfDay, rule.startMinutes, rule.endMinutes);
}

/**
 * Specificity score: how narrow a rule is. Narrower (more specific) rules win
 * when multiple rules match. Lower coverage => more specific => preferred.
 *
 * Coverage = (#days the rule applies to) * (minutes of the day it covers).
 * A rule with an empty `daysOfWeek` is treated as "every day" (7 days).
 */
export function ruleSpecificityCoverage(rule: TariffRule): number {
  const days = rule.daysOfWeek.length > 0 ? rule.daysOfWeek.length : 7;
  return days * windowMinutes(rule.startMinutes, rule.endMinutes);
}

/** Inclusive `MM-DD` season check, supporting wrap across the new year. */
function monthDayInSeason(monthDay: string, start: string, end: string): boolean {
  if (start <= end) return monthDay >= start && monthDay <= end;
  return monthDay >= start || monthDay <= end; // wraps year boundary
}

/** Convert `HH:mm` to minutes-of-day. `24:00` maps to 1440. */
export function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map((v) => parseInt(v, 10));
  return h * 60 + (m || 0);
}

/** Convert minutes-of-day to `HH:mm`. 1440 renders as `24:00`. */
export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
