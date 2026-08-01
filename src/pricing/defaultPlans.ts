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
  bezeq: '#00838f',
  partner: '#558b2f',
  hot: '#c2185b',
} as const;

let seq = 0;
/** Stable-ish id helper for seeded plans/rules. */
function rid(prefix: string): string {
  seq += 1;
  return `${prefix}_seed_${seq}_${makeId('x').slice(-4)}`;
}

/** English fallbacks are kept alongside i18n keys so the plan reads sensibly
 *  even before translation resolves. `slug` maps to `plansDefault.<slug>.*`. */
interface Seed {
  slug: string;
  supplierSlug: keyof typeof COLORS;
  name: string;
  supplier: string;
  description: string;
  percent: number;
  bundleOnly?: boolean;
}

function base(seed: Seed): Omit<TariffPlan, 'rules'> {
  return {
    id: rid('plan'),
    name: seed.name,
    supplier: seed.supplier,
    description: seed.description,
    color: COLORS[seed.supplierSlug],
    bundleOnly: seed.bundleOnly,
    nameKey: `plansDefault.${seed.slug}.name`,
    descriptionKey: `plansDefault.${seed.slug}.desc`,
    supplierKey: `plansDefault.supplier.${seed.supplierSlug}`,
  };
}

/** All-day, every-day flat-discount plan. Rule label is intentionally omitted so
 *  the UI renders a translated fallback. */
function flatPlan(seed: Seed): TariffPlan {
  return {
    ...base(seed),
    rules: [{
      id: rid('rule'),
      daysOfWeek: ALL_DAYS,
      startMinutes: timeToMinutes('00:00'),
      endMinutes: timeToMinutes('24:00'),
      discountPercent: seed.percent,
    }],
  };
}

/** Single time-window plan (one rule, no label -> translated fallback). */
function windowPlan(seed: Seed, days: number[], start: string, end: string): TariffPlan {
  return {
    ...base(seed),
    rules: [{
      id: rid('rule'),
      daysOfWeek: days,
      startMinutes: timeToMinutes(start),
      endMinutes: timeToMinutes(end),
      discountPercent: seed.percent,
    }],
  };
}

/**
 * Real Israeli electricity supplier discount tracks (2025–2026). Percentages and
 * hours come from public supplier pages — ALWAYS confirm current terms before
 * switching. Each plan carries i18n keys (`plansDefault.*`) so its name,
 * supplier and description follow the active language.
 */
export function defaultPlans(): TariffPlan[] {
  seq = 0;
  return [
    // ---- Electra Power (אלקטרה פאוור) ----
    flatPlan({ slug: 'anytime', supplierSlug: 'electra', name: 'Anytime 6.5%', supplier: 'Electra Power', description: 'Fixed 6.5% discount, 24/7, any meter.', percent: 6.5 }),
    windowPlan({ slug: 'electraDay', supplierSlug: 'electra', name: 'Day 21%', supplier: 'Electra Power', description: '21% off Sun–Thu 07:00–17:00 (smart meter required).', percent: 21 }, WORK_WEEK, '07:00', '17:00'),
    windowPlan({ slug: 'electraNight', supplierSlug: 'electra', name: 'Night 21%', supplier: 'Electra Power', description: '21% off Sun–Thu 23:00–07:00 (smart meter required).', percent: 21 }, WORK_WEEK, '23:00', '07:00'),
    windowPlan({ slug: 'tenXten', supplierSlug: 'electra', name: '10×10', supplier: 'Electra Power', description: '10% off Sun–Thu 10:00–22:00 (smart meter required).', percent: 10 }, WORK_WEEK, '10:00', '22:00'),

    // ---- Cellcom Energy (סלקום אנרג'י) ----
    flatPlan({ slug: 'cellcomFixed', supplierSlug: 'cellcom', name: 'Fixed 6%', supplier: 'Cellcom Energy', description: 'Fixed 6% discount, 24/7, any meter.', percent: 6 }),
    windowPlan({ slug: 'cellcomDay', supplierSlug: 'cellcom', name: 'Day 20%', supplier: 'Cellcom Energy', description: '20% off Sun–Thu 07:00–17:00 (smart meter required).', percent: 20 }, WORK_WEEK, '07:00', '17:00'),
    windowPlan({ slug: 'cellcomFamily', supplierSlug: 'cellcom', name: 'Family 18%', supplier: 'Cellcom Energy', description: '18% off Sun–Thu 14:00–20:00 (smart meter required).', percent: 18 }, WORK_WEEK, '14:00', '20:00'),
    windowPlan({ slug: 'cellcomNight', supplierSlug: 'cellcom', name: 'Night 15%', supplier: 'Cellcom Energy', description: '15% off every day 23:00–07:00 (smart meter required).', percent: 15 }, ALL_DAYS, '23:00', '07:00'),

    // ---- Amisragas (אמישראגז) ----
    flatPlan({ slug: 'amisragasGas', supplierSlug: 'amisragas', name: 'Gas-customer 7%', supplier: 'Amisragas', description: 'Fixed 7% discount, 24/7 — requires an Amisragas gas subscription (bundle deal).', percent: 7, bundleOnly: true }),

    // ---- Pazgas (פזגז) ----
    flatPlan({ slug: 'pazgasFixed', supplierSlug: 'pazgas', name: 'Fixed 5%', supplier: 'Pazgas', description: 'Fixed 5% discount, 24/7 (5–7% depending on the current joining promo). Optional 10% Yellow-app cashback instead.', percent: 5 }),
    windowPlan({ slug: 'pazgasDay', supplierSlug: 'pazgas', name: 'Day 15%', supplier: 'Pazgas', description: '15% off Sun–Thu 07:00–17:00 (smart meter required).', percent: 15 }, WORK_WEEK, '07:00', '17:00'),
    windowPlan({ slug: 'pazgasNight', supplierSlug: 'pazgas', name: 'Night 20%', supplier: 'Pazgas', description: '20% off every day 23:00–07:00 (smart meter required).', percent: 20 }, ALL_DAYS, '23:00', '07:00'),

    // ---- Bezeq Energy (בזק אנרג'י) ----
    flatPlan({ slug: 'bezeqFixed', supplierSlug: 'bezeq', name: 'Fixed 6%', supplier: 'Bezeq Energy', description: 'Fixed 6% discount, 24/7, any meter.', percent: 6 }),
    windowPlan({ slug: 'bezeqDay', supplierSlug: 'bezeq', name: 'Day 15%', supplier: 'Bezeq Energy', description: '15% off Sun–Thu 07:00–17:00 (smart meter required).', percent: 15 }, WORK_WEEK, '07:00', '17:00'),
    windowPlan({ slug: 'bezeqNight', supplierSlug: 'bezeq', name: 'Night 20%', supplier: 'Bezeq Energy', description: '20% off Sun–Thu 23:00–07:00 (smart meter required).', percent: 20 }, WORK_WEEK, '23:00', '07:00'),

    // ---- Partner (פרטנר) ----
    flatPlan({ slug: 'partnerFixed', supplierSlug: 'partner', name: 'Fixed 5%', supplier: 'Partner', description: 'Fixed 5% discount, 24/7 (rises to 6–7% in later years).', percent: 5 }),
    windowPlan({ slug: 'partnerDay', supplierSlug: 'partner', name: 'Day 15%', supplier: 'Partner', description: '15% off Sun–Thu 07:00–17:00 (smart meter required).', percent: 15 }, WORK_WEEK, '07:00', '17:00'),
    windowPlan({ slug: 'partnerNight', supplierSlug: 'partner', name: 'Night 20%', supplier: 'Partner', description: '20% off Sun–Thu 23:00–07:00 (smart meter required).', percent: 20 }, WORK_WEEK, '23:00', '07:00'),

    // ---- HOT Energy (HOT אנרג'י) — no fixed 24/7 track confirmed ----
    windowPlan({ slug: 'hotDay', supplierSlug: 'hot', name: 'Day 15%', supplier: 'HOT Energy', description: '15% off Sun–Thu 07:00–17:00 (smart meter required).', percent: 15 }, WORK_WEEK, '07:00', '17:00'),
    windowPlan({ slug: 'hotNight', supplierSlug: 'hot', name: 'Night 20%', supplier: 'HOT Energy', description: '20% off Sun–Thu 23:00–07:00 (smart meter required).', percent: 20 }, WORK_WEEK, '23:00', '07:00'),
  ];
}

/** Default base price per kWh in NIS (IEC residential tariff). */
export const DEFAULT_BASE_PRICE = 0.6432;
