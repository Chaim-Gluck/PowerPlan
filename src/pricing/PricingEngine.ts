import type { EnrichedRecord } from './ConsumptionRecord';
import type { TariffPlan } from './TariffPlan';
import { resolveRule } from './TariffPlan';
import type { RuleContext, TariffRule } from './TariffRule';

/** Per-rule usage/cost breakdown, keyed by rule id. */
export interface AppliedRuleStat {
  ruleId: string;
  label: string;
  discountPercent: number;
  /** kWh that matched this rule. */
  consumption: number;
  /** Cost attributed to intervals matching this rule. */
  cost: number;
  /** Number of intervals matched. */
  intervals: number;
}

/** Result of a bill calculation for a single plan. */
export interface BillResult {
  planId: string;
  planName: string;
  /** Supplier that offers this plan (for display). */
  supplier?: string;
  /** Accent color inherited from the plan (for charts/tables). */
  color?: string;
  /** Total cost across the whole imported period (NIS). */
  totalCost: number;
  /** Total kWh across the whole imported period. */
  totalConsumption: number;
  /** What the same consumption would cost at the raw base price (no discount). */
  baseCost: number;
  /** baseCost - totalCost (NIS saved by this plan vs. the flat base price). */
  savings: number;
  /** savings / baseCost * 100. */
  savingsPercent: number;
  /** Cost by `YYYY-MM-DD`. */
  dailyCosts: Record<string, number>;
  /** Cost by `YYYY-MM`. */
  monthlyCosts: Record<string, number>;
  /** Cost by `YYYY`. */
  yearlyCosts: Record<string, number>;
  /** Usage/cost split per rule (plus a synthetic "No discount" bucket). */
  appliedRules: AppliedRuleStat[];
  /** Average cost per calendar month present in the data. */
  averageMonthlyCost: number;
  /** Extrapolated yearly cost (averageMonthlyCost * 12). */
  estimatedYearlyCost: number;
  /** Sum of `billedCost` from the source file, if any (for validation). */
  billedTotal?: number;
}

const NO_RULE_ID = '__no_rule__';

/**
 * The pure pricing engine.
 *
 * Everything here is UI-agnostic and deterministic. The single public entry
 * point mirrors the requested signature:
 *
 *   PricingEngine.calculateBill(records, plan, basePrice)
 *
 * Future extensions (seasonal base prices, demand charges, holidays) can be
 * introduced by widening {@link RuleContext} and the cost formula below without
 * changing any callers.
 */
export const PricingEngine = {
  /**
   * Calculate the bill for a set of records under a plan and a base price.
   *
   * @param records  Enriched consumption records (see {@link EnrichedRecord}).
   * @param plan     The tariff plan to apply.
   * @param basePrice Base price per kWh in NIS.
   */
  calculateBill(
    records: EnrichedRecord[],
    plan: TariffPlan,
    basePrice: number,
  ): BillResult {
    const dailyCosts: Record<string, number> = {};
    const monthlyCosts: Record<string, number> = {};
    const yearlyCosts: Record<string, number> = {};
    const ruleStats = new Map<string, AppliedRuleStat>();

    let totalCost = 0;
    let totalConsumption = 0;
    let baseCost = 0;
    let billedTotal = 0;
    let hasBilled = false;
    const monthSet = new Set<string>();

    for (const r of records) {
      const ctx: RuleContext = {
        weekday: r.weekday,
        minuteOfDay: r.minuteOfDay,
        monthDay: r.dayKey.slice(5), // MM-DD
      };
      const rule = resolveRule(plan, ctx);
      const discount = rule ? clampPercent(rule.discountPercent) / 100 : 0;

      const intervalBase = r.consumption * basePrice;
      const intervalCost = intervalBase * (1 - discount);

      totalCost += intervalCost;
      baseCost += intervalBase;
      totalConsumption += r.consumption;

      dailyCosts[r.dayKey] = (dailyCosts[r.dayKey] ?? 0) + intervalCost;
      monthlyCosts[r.monthKey] = (monthlyCosts[r.monthKey] ?? 0) + intervalCost;
      yearlyCosts[r.yearKey] = (yearlyCosts[r.yearKey] ?? 0) + intervalCost;
      monthSet.add(r.monthKey);

      accumulateRuleStat(ruleStats, rule, r.consumption, intervalCost);

      if (r.billedCost != null) {
        hasBilled = true;
        billedTotal += r.billedCost;
      }
    }

    const monthCount = Math.max(monthSet.size, 1);
    const averageMonthlyCost = totalCost / monthCount;

    const savings = baseCost - totalCost;

    return {
      planId: plan.id,
      planName: plan.name,
      supplier: plan.supplier,
      color: plan.color,
      totalCost,
      totalConsumption,
      baseCost,
      savings,
      savingsPercent: baseCost > 0 ? (savings / baseCost) * 100 : 0,
      dailyCosts,
      monthlyCosts,
      yearlyCosts,
      appliedRules: sortRuleStats(ruleStats),
      averageMonthlyCost,
      estimatedYearlyCost: averageMonthlyCost * 12,
      billedTotal: hasBilled ? billedTotal : undefined,
    };
  },

  /**
   * Calculate the flat "base" bill (no plan / no discounts). Useful as the
   * reference every plan is compared against.
   */
  calculateBaseCost(records: EnrichedRecord[], basePrice: number): number {
    let sum = 0;
    for (const r of records) sum += r.consumption * basePrice;
    return sum;
  },
};

function accumulateRuleStat(
  map: Map<string, AppliedRuleStat>,
  rule: TariffRule | null,
  consumption: number,
  cost: number,
): void {
  const id = rule ? rule.id : NO_RULE_ID;
  let stat = map.get(id);
  if (!stat) {
    stat = {
      ruleId: id,
      label: rule ? rule.label || describeRule(rule) : 'No discount',
      discountPercent: rule ? rule.discountPercent : 0,
      consumption: 0,
      cost: 0,
      intervals: 0,
    };
    map.set(id, stat);
  }
  stat.consumption += consumption;
  stat.cost += cost;
  stat.intervals += 1;
}

function sortRuleStats(map: Map<string, AppliedRuleStat>): AppliedRuleStat[] {
  return Array.from(map.values()).sort((a, b) => b.consumption - a.consumption);
}

function clampPercent(p: number): number {
  return Math.min(Math.max(p, 0), 100);
}

/** Short human description of a rule when it has no explicit label. */
export function describeRule(rule: TariffRule): string {
  const days = rule.daysOfWeek.length === 0 || rule.daysOfWeek.length === 7 ? 'Every day' : rule.daysOfWeek.length + ' days';
  return `${rule.discountPercent}% • ${days}`;
}
