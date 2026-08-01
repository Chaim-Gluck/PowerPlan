import type { ConsumptionRecord, TariffPlan } from '../pricing';

/**
 * localStorage persistence.
 *
 * Consumption records are stored in a compact columnar shape (parallel arrays)
 * to keep large 2-year, 15-minute datasets well under the ~5 MB quota.
 */

const KEYS = {
  data: 'iec.data.v1',
  plans: 'iec.plans.v2',
  settings: 'iec.settings.v1',
} as const;

export interface StoredSettings {
  basePrice: number;
  darkMode: boolean;
  /** Active UI language code ('en' | 'he'). */
  language?: string;
  /** Hour (0–23) at which "day" begins. */
  dayStartHour: number;
  /** Hour (0–23) at which "evening" begins. */
  eveningStartHour: number;
  /** Hour (0–23) at which "night" begins. */
  nightStartHour: number;
  /** Whether bundle-only plans are included in the comparison / plan list. */
  includeBundlePlans: boolean;
}

interface CompactData {
  t: number[]; // timestamps (epoch ms)
  c: number[]; // consumption
  b?: (number | null)[]; // optional billed cost
  intervalMinutes: number;
  fileName?: string;
}

export function saveData(
  records: ConsumptionRecord[],
  intervalMinutes: number,
  fileName?: string,
): boolean {
  try {
    const compact: CompactData = {
      t: records.map((r) => r.tsMs),
      c: records.map((r) => round4(r.consumption)),
      intervalMinutes,
      fileName,
    };
    if (records.some((r) => r.billedCost != null)) {
      compact.b = records.map((r) => (r.billedCost != null ? round4(r.billedCost) : null));
    }
    localStorage.setItem(KEYS.data, JSON.stringify(compact));
    return true;
  } catch (e) {
    console.warn('Failed to persist data (quota?)', e);
    return false;
  }
}

export function loadData(): { records: ConsumptionRecord[]; intervalMinutes: number; fileName?: string } | null {
  const raw = localStorage.getItem(KEYS.data);
  if (!raw) return null;
  try {
    const c = JSON.parse(raw) as CompactData;
    const records: ConsumptionRecord[] = c.t.map((tsMs, i) => {
      const rec: ConsumptionRecord = { tsMs, consumption: c.c[i] };
      if (c.b && c.b[i] != null) rec.billedCost = c.b[i] as number;
      return rec;
    });
    return { records, intervalMinutes: c.intervalMinutes, fileName: c.fileName };
  } catch {
    return null;
  }
}

export function clearData(): void {
  localStorage.removeItem(KEYS.data);
}

export function savePlans(plans: TariffPlan[]): void {
  localStorage.setItem(KEYS.plans, JSON.stringify(plans));
}

export function loadPlans(): TariffPlan[] | null {
  const raw = localStorage.getItem(KEYS.plans);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as TariffPlan[];
  } catch {
    return null;
  }
}

export function saveSettings(settings: StoredSettings): void {
  localStorage.setItem(KEYS.settings, JSON.stringify(settings));
}

export function loadSettings(): StoredSettings | null {
  const raw = localStorage.getItem(KEYS.settings);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredSettings;
  } catch {
    return null;
  }
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
