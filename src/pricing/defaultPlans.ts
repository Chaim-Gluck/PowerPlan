import type { TariffPlan } from './TariffPlan';
import { makeId } from './TariffPlan';
import { timeToMinutes } from './TariffRule';

/** Weekday constants (Day.js convention, 0 = Sunday). */
export const SUN = 0;
export const MON = 1;
export const TUE = 2;
export const WED = 3;
export const THU = 4;
export const FRI = 5;
export const SAT = 6;

export const WORK_WEEK = [SUN, MON, TUE, WED, THU]; // Israel Sun–Thu
export const ALL_DAYS = [SUN, MON, TUE, WED, THU, FRI, SAT];

/** Supplier accent colors. */
const COLORS = {
  electra: '#0288d1',
  cellcom: '#7b1fa2',
  amisragas: '#2e7d32',
  pazgas: '#ed6c02',
} as const;

let seq = 0;
/** Stable-ish id helper for seeded plans/rules. */
function rid(prefix: string): string {
  seq += 1;
  return `${prefix}_seed_${seq}_${makeId('x').slice(-4)}`;
}

/** Build a single all-day flat-discount plan. */
function flatPlan(name: string, supplier: string, color: string, percent: number, description: string, bundleOnly = false): TariffPlan {
  return {
    id: rid('plan'),
    name,
    supplier,
    color,
    description,
    bundleOnly,
    rules: [
      {
        id: rid('rule'),
        label: `${percent}% • all day, every day`,
        daysOfWeek: ALL_DAYS,
        startMinutes: timeToMinutes('00:00'),
        endMinutes: timeToMinutes('24:00'),
        discountPercent: percent,
      },
    ],
  };
}

/** Build a single time-window plan (one rule). */
function windowPlan(
  name: string, supplier: string, color: string, description: string,
  days: number[], start: string, end: string, percent: number,
): TariffPlan {
  return {
    id: rid('plan'),
    name,
    supplier,
    color,
    description,
    rules: [
      {
        id: rid('rule'),
        label: `${percent}% • ${start}–${end}`,
        daysOfWeek: days,
        startMinutes: timeToMinutes(start),
        endMinutes: timeToMinutes(end),
        discountPercent: percent,
      },
    ],
  };
}

/**
 * Real Israeli electricity supplier discount tracks (as advertised in
 * 2025–2026, following the electricity-market reform). Percentages and hours
 * come from public supplier pages and comparison sites — ALWAYS confirm the
 * exact current terms with the supplier before switching.
 *
 * Notes:
 * - Time-based plans (day/night/etc.) require a smart meter.
 * - Each discount applies only to the variable (per-kWh) part of the bill,
 *   which is exactly what this app models.
 * - Suppliers use DIFFERENT hour windows (e.g. Electra 10×10 is 10:00–22:00,
 *   Cellcom Family is 14:00–20:00); each window is encoded in the plan's own
 *   rules, so pricing is always accurate regardless of the cosmetic
 *   day/evening/night boundaries used by the distribution charts.
 */
export function defaultPlans(): TariffPlan[] {
  seq = 0;
  return [
    // ---- Electra Power (סופר פאוור) ----
    flatPlan('Anytime 6.5%', 'Electra Power', COLORS.electra, 6.5, 'Fixed 6.5% discount, 24/7, any meter.'),
    windowPlan('Day 21%', 'Electra Power', COLORS.electra, '21% off Sun–Thu 07:00–17:00 (smart meter required).', WORK_WEEK, '07:00', '17:00', 21),
    windowPlan('Night 21%', 'Electra Power', COLORS.electra, '21% off Sun–Thu 23:00–07:00 (smart meter required).', WORK_WEEK, '23:00', '07:00', 21),
    windowPlan('10×10', 'Electra Power', COLORS.electra, '10% off Sun–Thu 10:00–22:00 (smart meter required).', WORK_WEEK, '10:00', '22:00', 10),

    // ---- Cellcom Energy (סלקום אנרג'י) ----
    flatPlan('Fixed 6%', 'Cellcom Energy', COLORS.cellcom, 6, 'Fixed 6% discount, 24/7, any meter.'),
    windowPlan('Day 20%', 'Cellcom Energy', COLORS.cellcom, '20% off Sun–Thu 07:00–17:00 (smart meter required).', WORK_WEEK, '07:00', '17:00', 20),
    windowPlan('Family 18%', 'Cellcom Energy', COLORS.cellcom, '18% off Sun–Thu 14:00–20:00 (smart meter required).', WORK_WEEK, '14:00', '20:00', 18),
    windowPlan('Night 15%', 'Cellcom Energy', COLORS.cellcom, '15% off every day 23:00–07:00 (smart meter required).', ALL_DAYS, '23:00', '07:00', 15),

    // ---- Amisragas (אמישראגז) ----
    flatPlan('Gas-customer 7%', 'Amisragas', COLORS.amisragas, 7, 'Fixed 7% discount, 24/7 — requires an Amisragas gas subscription (bundle deal).', true),

    // ---- Pazgas (פזגז) ----
    flatPlan('Fixed 5%', 'Pazgas', COLORS.pazgas, 5, 'Fixed 5% discount, 24/7 (5–7% depending on the current joining promo). Optional 10% Yellow-app cashback instead.'),
    windowPlan('Day 15%', 'Pazgas', COLORS.pazgas, '15% off Sun–Thu 07:00–17:00 (smart meter required).', WORK_WEEK, '07:00', '17:00', 15),
    windowPlan('Night 20%', 'Pazgas', COLORS.pazgas, '20% off every day 23:00–07:00 (smart meter required).', ALL_DAYS, '23:00', '07:00', 20),
  ];
}

/** Default base price per kWh in NIS (IEC residential tariff). */
export const DEFAULT_BASE_PRICE = 0.6432;
