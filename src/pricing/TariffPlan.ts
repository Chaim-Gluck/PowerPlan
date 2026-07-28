import type { TariffRule } from './TariffRule';
import { ruleMatches, ruleSpecificityCoverage, type RuleContext } from './TariffRule';

/**
 * A named tariff plan: a collection of {@link TariffRule}s applied on top of a
 * single configurable base price.
 */
export interface TariffPlan {
  id: string;
  name: string;
  /** Electricity supplier offering this plan (e.g. "Electra Power"). */
  supplier?: string;
  /** True if the plan is only available as a bundle (e.g. requires a gas subscription). */
  bundleOnly?: boolean;
  /** Optional description shown in the UI. */
  description?: string;
  /** Optional accent color for charts/tables. */
  color?: string;
  rules: TariffRule[];
}

/**
 * Resolve the effective discount for a consumption interval under a plan.
 *
 * Overlap resolution: among all matching rules, the *most specific* rule wins
 * (smallest day×time coverage). Ties are broken by the larger discount, giving
 * the customer the benefit of the doubt. Returns `null` when no rule matches so
 * callers can distinguish "0% rule" from "no rule".
 */
export function resolveRule(
  plan: TariffPlan,
  ctx: RuleContext,
): TariffRule | null {
  let best: TariffRule | null = null;
  let bestCoverage = Number.POSITIVE_INFINITY;

  for (const rule of plan.rules) {
    if (!ruleMatches(rule, ctx)) continue;
    const coverage = ruleSpecificityCoverage(rule);
    if (
      coverage < bestCoverage ||
      (coverage === bestCoverage && best !== null && rule.discountPercent > best.discountPercent)
    ) {
      best = rule;
      bestCoverage = coverage;
    }
  }
  return best;
}

/** Effective discount fraction (0..1) for a context under a plan. */
export function resolveDiscountFraction(plan: TariffPlan, ctx: RuleContext): number {
  const rule = resolveRule(plan, ctx);
  if (!rule) return 0;
  return Math.min(Math.max(rule.discountPercent, 0), 100) / 100;
}

/** Generate a reasonably unique id for plans/rules created in the browser. */
export function makeId(prefix = 'id'): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
