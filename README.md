# ⚡ PowerPlan

A polished, fully local (no backend) personal analytics dashboard that tells you **which electricity tariff plan would have been the cheapest** based on your **actual historical electricity consumption**.

Built around the Israel Electric Company (IEC) smart-meter export format and Israeli supplier plans, but the pricing engine is supplier- and country-agnostic — point it at any interval consumption data and any set of plans.

> 🧠 **Working on this repo (human or AI agent)?** Start with **[AGENTS.md](./AGENTS.md)** for the
> architecture, domain rules/invariants, conventions, gotchas, and follow-ups.

---

## Quick start

```bash
npm install
npm run dev       # http://localhost:5173
```

Then open the app and either:

1. Click **Import → Load sample data** to explore immediately, or
2. Drag-and-drop your own IEC meter export (`meter_LP_….csv`) or any CSV/XLSX with a timestamp + consumption column.

Other scripts:

```bash
npm run build            # strict type-check + production bundle
npm run preview          # serve the production build
npm run generate-sample  # regenerate public/sample-data.csv
npm run smoke <csv>      # headless engine check against a CSV (needs tsx)
```

---

## Where to get your data

Download your own 2-year, 15-minute meter report from the IEC
[**Remote Reading Info**](https://www.iec.co.il/consumption-info-menu/remote-reading-info)
portal (log in → request the report → it is emailed to you as a CSV). The app parses that
Hebrew export format directly, including the metadata header rows.

> There is currently no public IEC API, so the import is file-based. The pricing engine is
> designed so a direct-import adapter can be added later without touching the UI or the engine.

---

## Features

- **Import** CSV & Excel (`.xlsx`). Auto-detects hourly / half-hour / quarter-hour intervals and the
  IEC Hebrew layout vs. generic `Timestamp,Consumption` files. An optional real **billed-cost** column
  is used to validate the engine.
- **Dashboard** — KPI cards (total consumption, base cost, cheapest plan, potential savings),
  daily/weekly/monthly usage, hour-of-day, weekday, a weekday×hour **heatmap**, and distribution donuts.
- **Tariff plans** — create unlimited plans, each with any number of rules (days of week, time window,
  discount %). Overlaps are resolved by the **most specific** matching rule. Full editor with validation
  and ambiguity warnings.
- **Comparison** — ranked table (total, savings, savings %, avg monthly, est. yearly) with the cheapest
  plan highlighted, monthly bill & savings charts, per-rule **kWh & cost breakdown**, and a **what-if
  simulator** (shift usage between day/evening/night and watch the optimal plan change).
- **Insights** — plain-language observations ("You consume 20% of your electricity during weekday
  evenings", "Your best plan saves ₪1,431…").
- **Persistence** — data, plans and settings are saved to `localStorage` and restored on reload.
- **Bonus** — dark mode, date-range + weekday/weekend filters, and **Excel / PDF export** of the comparison.

---

## Architecture

The pricing logic is **completely independent of the UI** — no pricing rules live in components.

```
src/
  pricing/                 # Pure, UI-agnostic engine (fully unit-testable)
    ConsumptionRecord.ts   #   record model + calendar enrichment
    TariffRule.ts          #   rule model, time-window & specificity logic
    TariffPlan.ts          #   plan model + overlap/most-specific resolution
    PricingEngine.ts       #   calculateBill(records, plan, basePrice) -> BillResult
    BillCalculator.ts      #   compareAll(records, plans, basePrice) -> ranked comparison
    defaultPlans.ts        #   seed plans + default base price
  utils/                   # dataImport, analytics, whatIf, storage, exporters, format
  state/AppContext.tsx     # app state, memoized selectors, localStorage hydration
  charts/                  # reusable Recharts wrappers + the CSS-grid heatmap
  components/              # StatCard, ChartCard, PlanEditorDialog, FiltersBar
  pages/                   # Dashboard, Import, Plans, Comparison, Insights
  theme/                   # light/dark MUI theme + series palette
```

The engine entry point mirrors the requested contract:

```ts
PricingEngine.calculateBill(consumptionRecords, tariffPlan, basePrice)
// -> { totalCost, monthlyCosts, dailyCosts, yearlyCosts,
//      totalConsumption, appliedRules, savings, ... }
```

### Cost model

For every interval:

```
discount      = most-specific matching rule's discount (else 0)
interval cost = consumption × basePrice × (1 − discount)
```

aggregated into daily / monthly / yearly / whole-period totals, plus a per-rule usage breakdown.

### Future-proofing

`TariffRule` already carries reserved fields (`seasonStart`/`seasonEnd`, `holidaysOnly`) and matching is
done against a `RuleContext`, so **seasonal pricing, holidays, time-varying base prices, demand charges,
multiple tariffs per season, PDF reports and a future IEC import** can be added without changing callers.

---

## Deployment

Hosted as a **static SPA on Azure Static Web Apps (Free SKU)**. Deployment is **manual-only**:

- The workflow `.github/workflows/deploy.yml` is triggered by **`workflow_dispatch` only** — a plain
  `git push` deploys nothing. To deploy: GitHub → **Actions** → *Deploy to Azure Static Web Apps (manual)*
  → **Run workflow**.
- CI installs from **public npm**, runs `npm run build`, and uploads `dist/` using a deploy token stored
  as the GitHub Actions secret **`AZURE_STATIC_WEB_APPS_API_TOKEN`** (never committed).
- SPA fallback routing is configured in `public/staticwebapp.config.json`.
- Exact resource names / live URL / redeploy steps are kept in the git-ignored `NOTES.local.md`.

The app has **no runtime environment variables or secrets** — it builds and runs entirely client-side.

---

## License

Released under the **MIT License** — see [LICENSE](./LICENSE). (A public repo with *no* license means
"all rights reserved", so MIT is included to allow reuse.)

---

## Notes

- The `xlsx` (SheetJS) package has published advisories; it is only ever used to parse **your own local
  files** in the browser and is never sent anywhere. Swap for the SheetJS CDN build if you prefer.
- Weekday convention follows Day.js: `0 = Sunday … 6 = Saturday`; weekend = Friday & Saturday (Israel).
- Dates are displayed day-before-month (`DD/MM/YYYY`).
