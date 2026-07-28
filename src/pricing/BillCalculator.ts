import type { EnrichedRecord } from './ConsumptionRecord';
import type { TariffPlan } from './TariffPlan';
import { PricingEngine, type BillResult } from './PricingEngine';

/** One row of the plan comparison table. */
export interface PlanComparison extends BillResult {
  /** True for the cheapest plan across the comparison set. */
  isCheapest: boolean;
  /** Rank by total cost, 1 = cheapest. */
  rank: number;
}

/** Full comparison output. */
export interface ComparisonResult {
  basePrice: number;
  baseCost: number;
  totalConsumption: number;
  comparisons: PlanComparison[];
  cheapest: PlanComparison | null;
  /** Number of distinct calendar months in the data. */
  monthCount: number;
  /** Flat base cost per `YYYY-MM` (no discounts) — reference for savings charts. */
  monthlyBaseCosts: Record<string, number>;
}

/**
 * High-level orchestration on top of {@link PricingEngine}. Runs every plan
 * over the same records, ranks them by total cost, and flags the cheapest.
 */
export const BillCalculator = {
  compareAll(
    records: EnrichedRecord[],
    plans: TariffPlan[],
    basePrice: number,
  ): ComparisonResult {
    const baseCost = PricingEngine.calculateBaseCost(records, basePrice);
    const totalConsumption = records.reduce((s, r) => s + r.consumption, 0);
    const monthCount = new Set(records.map((r) => r.monthKey)).size;

    const monthlyBaseCosts: Record<string, number> = {};
    for (const r of records) {
      monthlyBaseCosts[r.monthKey] = (monthlyBaseCosts[r.monthKey] ?? 0) + r.consumption * basePrice;
    }

    const results = plans.map((plan) =>
      PricingEngine.calculateBill(records, plan, basePrice),
    );

    // Rank by total cost ascending.
    const ranked = results
      .slice()
      .sort((a, b) => a.totalCost - b.totalCost);
    const rankById = new Map<string, number>();
    ranked.forEach((r, i) => rankById.set(r.planId, i + 1));

    const cheapestId = ranked.length > 0 ? ranked[0].planId : null;

    const comparisons: PlanComparison[] = results.map((r) => ({
      ...r,
      isCheapest: r.planId === cheapestId,
      rank: rankById.get(r.planId) ?? 0,
    }));

    // Keep table order stable by cost.
    comparisons.sort((a, b) => a.rank - b.rank);

    return {
      basePrice,
      baseCost,
      totalConsumption,
      comparisons,
      cheapest: comparisons.find((c) => c.isCheapest) ?? null,
      monthCount,
      monthlyBaseCosts,
    };
  },
};
