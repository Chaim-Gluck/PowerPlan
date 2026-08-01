import type { TariffPlan, TariffRule } from '../pricing';
import { WEEKDAY_KEYS } from './analytics';

/** Minimal translator shape (matches i18next's `t`). */
export type Translator = (key: string, params?: Record<string, unknown>) => string;

/** Resolve a default rule's label (translated) when it has none of its own. */
function resolveRuleLabel(rule: TariffRule, t: Translator): string {
  if (rule.label) return rule.label;
  const allDays = rule.daysOfWeek.length === 0 || rule.daysOfWeek.length === 7;
  const days = allDays
    ? t('plans.everyDay')
    : rule.daysOfWeek.map((d) => t(`charts.weekday.${WEEKDAY_KEYS[d]}`)).join(', ');
  return `${rule.discountPercent}% • ${days}`;
}

/**
 * Resolve a plan's display strings from its i18n keys (name/supplier/description
 * and default rule labels). Built-in plans carry keys so they follow the active
 * language; user-edited fields (keys cleared) are shown verbatim. Feeding the
 * resolved plans to the pricing engine makes the comparison show localised names.
 */
export function resolvePlan(plan: TariffPlan, t: Translator): TariffPlan {
  return {
    ...plan,
    name: plan.nameKey ? t(plan.nameKey) : plan.name,
    supplier: plan.supplierKey ? t(plan.supplierKey) : plan.supplier,
    description: plan.descriptionKey ? t(plan.descriptionKey) : plan.description,
    rules: plan.rules.map((r) => ({ ...r, label: resolveRuleLabel(r, t) })),
  };
}
