# AGENTS.md — PowerPlan

Public-safe context for humans and AI agents working on this repo. **No secrets, no
cloud resource names, no personal data here** — operational specifics live in the
git-ignored `NOTES.local.md`.

> 📓 **Design & decision rationale** (why versions are pinned, why boundaries are
> cosmetic, why the mobile bottom nav, etc.) lives in **[docs/DECISIONS.md](./docs/DECISIONS.md)**.

## What this app is
**PowerPlan** is a fully local, browser-only analytics dashboard that tells you **which
electricity tariff plan would have been cheapest** given your **real historical
consumption**. You import your smart-meter data (CSV/Excel), define or pick discount
plans, and compare what each would have cost — with charts, insights, a what-if
simulator, and Excel/PDF export.

It was built around the Israel Electric Company (IEC) 15-minute smart-meter export
format and Israeli supplier plans, but the pricing engine is **supplier- and
country-agnostic**: give it any interval consumption series and any set of plans.

- **No backend. No database. No server.** Everything runs client-side in the browser.
- **No runtime secrets or environment variables.** Nothing to configure to run it.
- Persistence is the browser's `localStorage` only. Data never leaves the machine.

## Tech stack
- React 18 + TypeScript (strict), Vite 8 (build/dev)
- MUI 6 (`@mui/material`, `@mui/icons-material`, `@mui/x-date-pickers`) + Emotion
- Recharts 2 (charts), Day.js (dates)
- PapaParse (CSV), SheetJS `xlsx` (Excel), jsPDF + jspdf-autotable (PDF/Excel export)
- oxlint (lint). No test runner is configured yet (see follow-ups).

## Repo layout
```
public/                 static assets served as-is (sample-data.csv, favicon, SWA config)
scripts/                dev-only helpers (sample generator, engine smoke test)
src/
  pricing/              PURE, UI-agnostic pricing engine (unit-testable)
    ConsumptionRecord.ts  record model + calendar enrichment
    TariffRule.ts         rule model: time windows, wrap-past-midnight, specificity
    TariffPlan.ts         plan model + overlap / most-specific resolution
    PricingEngine.ts      calculateBill(records, plan, basePrice) -> BillResult
    BillCalculator.ts     compareAll(records, plans, basePrice) -> ranked comparison
    defaultPlans.ts       seed supplier plans + default base price
  utils/                dataImport, analytics, whatIf, storage, exporters, format
  state/AppContext.tsx  app state, memoized selectors, localStorage hydrate/persist
  charts/               reusable Recharts wrappers + CSS-grid heatmap
  components/           StatCard, ChartCard, PlanEditorDialog, SettingsDialog, FiltersBar
  pages/                Dashboard, Import, Plans, Comparison, Insights
  theme/                light/dark MUI theme + series palette
```

## Architecture & key invariants
- **Pricing logic is completely decoupled from the UI.** No pricing rules live in
  components. The engine entry point is:
  `PricingEngine.calculateBill(records, plan, basePrice) -> { totalCost, monthlyCosts,
  dailyCosts, yearlyCosts, totalConsumption, appliedRules, savings, ... }`.
- **Cost model:** per interval, `cost = consumption × basePrice × (1 − discount)`, where
  `discount` is the most-specific matching rule's discount (else 0). Aggregated to
  daily / monthly / yearly / whole-period.
- **Overlap resolution:** when several rules match an interval, the **most specific**
  (smallest day×time coverage) wins; ties break toward the larger discount.
- **Weekday convention:** Day.js `0=Sun … 6=Sat`. Weekend = Fri & Sat (Israel).
- **Time windows** are stored as minute-of-day and may wrap past midnight
  (`end <= start` means overnight).
- **Day/evening/night boundaries** (Settings) are **cosmetic only** — they drive the
  distribution donut, insights text, and the what-if simulator. They **never** affect a
  bill; each plan carries its own rule time-windows.
- **Bundle-only plans** (e.g. a discount that requires a gas subscription) carry a
  `bundleOnly` flag and are excluded from the comparison + "cheapest" when the Plans-page
  toggle is off. The what-if simulator uses the same filtered ("active") plan set.

## Data model (imported records)
- Raw: `{ tsMs, consumption, billedCost? }` (epoch ms + kWh + optional real billed cost).
- Enriched (once, at import): adds `weekday, hour, minuteOfDay, dayKey (YYYY-MM-DD),
  monthKey (YYYY-MM), yearKey`. Chart/aggregation keys stay ISO for sorting; display is
  formatted as day-before-month `DD/MM/YYYY`.
- Import auto-detects the interval (15/30/60 min) and the file layout: the IEC Hebrew
  meter export (metadata header + `date,time,consumption`) vs. a generic file with
  `Timestamp`/`Date`+`Time` and `Consumption`/`kWh` columns. An optional billed-cost
  column is used to validate the engine.

## How to run locally
```bash
npm install        # first time
npm run dev        # http://localhost:5173
npm run build      # strict type-check + production bundle -> dist/
npm run preview    # serve the built dist/
npm run lint       # oxlint
npm run generate-sample   # regenerate public/sample-data.csv
npm run smoke <path-to-csv>   # headless engine sanity check (needs: npx tsx)
```
To try it instantly: **Import → Load sample data**.

## Environment variables / secrets
- **None.** The app needs no env vars or secrets to build or run.
- The only deployment secret is a **CI-only** Azure Static Web Apps deploy token, stored
  as a **GitHub Actions repo secret** named `AZURE_STATIC_WEB_APPS_API_TOKEN`. It is never
  committed and never needed to run locally.

## Deployment approach (generic)
- Hosted as a **static SPA on Azure Static Web Apps (Free SKU)**.
- Deploy is **manual-only**: a GitHub Actions workflow (`.github/workflows/deploy.yml`)
  triggered by **`workflow_dispatch` only** (never on push/PR). It installs from public
  npm, runs `npm run build`, and uploads `dist/` using the deploy token from the GitHub
  secret above.
- SPA fallback routing is configured in `public/staticwebapp.config.json`.
- Exact resource names, region, live URL, and the redeploy procedure are recorded in the
  git-ignored `NOTES.local.md`.

## Known gotchas / lessons
- **Lockfile registry:** `package-lock.json` must resolve from **public npm**
  (`registry.npmjs.org`). If you regenerate it behind a corporate/private registry, its
  `resolved` URLs will point at an internal mirror and CI `npm ci` will fail (and leak
  internal hostnames). Re-point to public before committing.
- **Dependency majors are pinned** (MUI 6, Recharts 2, jsPDF 2, X-pickers 7, React 18)
  because newer majors changed APIs (e.g. MUI dropped direct system props on `Stack`,
  Recharts/JS-PDF signature changes). Bumping majors needs code updates.
- **`xlsx` (SheetJS)** has published advisories; it only ever parses the user's own local
  files in-browser and is never sent anywhere. Swap for the SheetJS CDN build if desired.
- Charts over long ranges: date x-axes auto-thin + angle labels; never render every tick.
- IEC has **no public API**, so import is file-based (a guided "Open IEC portal" flow +
  drag-and-drop). A static browser app cannot log in / scrape the portal for the user.

## Conventions
- Strict TypeScript; keep pricing logic out of components.
- Prefer editing existing modules; keep the engine pure and framework-free.
- Money in NIS (`₪`), energy in kWh. Dates displayed day-before-month.

## Outstanding follow-ups
- Add automated tests (a Vitest suite for `src/pricing/*` would be high-value).
- Verify/refresh supplier plan numbers periodically (they change; see `defaultPlans.ts`).
- Optional: seasonal/holiday pricing, time-varying base price, demand charges — the
  engine's `RuleContext` and reserved rule fields were designed to allow these.
- Optional: PWA/offline, multi-year year-over-year comparison view.
