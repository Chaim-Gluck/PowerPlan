# Decisions — PowerPlan

A lightweight **decision log**: what we chose and, more importantly, **why**. Read the
"Rationale" section before "fixing" anything that looks odd — several choices are
deliberate and easy to break by accident.

Origin tags: **📋 spec** (in the original brief) · **🗣️ raised** (a request/concern during
the build) · **⚙️ default** (chosen for you, unobjected).

---

## Rationale for the non-obvious choices (read this first)

These are the things most likely to be "corrected" by a future contributor or AI agent —
each is intentional.

- **Dependency majors are pinned** (`@mui/material` 6, `@mui/x-date-pickers` 7, `recharts` 2,
  `jspdf` 2, `jspdf-autotable` 3, `react` 18). The registry available during the build served
  much newer majors (MUI 9, Recharts 3, jsPDF 4) whose APIs had breaking changes — e.g. MUI
  dropped direct system props on `Stack`, and Recharts/jsPDF changed signatures. Pinning to
  these known-good versions is deliberate; **bumping a major requires code changes**, not just
  a version bump.

- **Layout uses MUI `Box` with CSS grid, not MUI `Grid`.** Chosen to avoid `Grid`'s
  version-specific prop API (which differs across MUI majors). `sx={{ display: 'grid',
  gridTemplateColumns: {...} }}` is stable across versions.

- **Day/evening/night boundaries are cosmetic only.** They live in `utils/analytics.ts`
  (`timeBucket`) and drive *only* the distribution donut, the insights text, and the what-if
  simulator. They **never** affect a bill — pricing always comes from each plan's own rule
  time-windows. So changing the boundaries (Settings) must not be wired into `PricingEngine`.

- **Mobile navigation is a bottom nav bar, not the top tabs.** Five tabs don't fit between the
  logo and the action icons on a phone, so `App.tsx` swaps to a `BottomNavigation` at ≤600px.
  Don't "simplify" it back to a single scrollable tab strip on mobile.

- **Charts keep numeric axes LTR; date axes are angled + auto-thinned.** Date x-axes use
  `interval="preserveStartEnd"` + `minTickGap` + `angle` so labels never overlap regardless of
  point count — do not switch back to showing every tick. If Hebrew/RTL is added later, keep
  the numeric plot LTR and only translate labels (Recharts is not RTL-aware).

- **The comparison table is responsive by hiding columns, not by shrinking.** On phones the
  secondary columns (Savings ₪, Avg monthly, Est. yearly) are hidden via `sx={{ display: {
  xs: 'none', md: 'table-cell' } }}`, and the Cheapest/Bundle chips render *under* the plan
  name so the money columns fit without horizontal scroll. Full data is still in desktop view
  and in the Excel/PDF export.

- **`package-lock.json` must resolve from public npm** (`registry.npmjs.org`). If it's ever
  regenerated behind a corporate/private registry, its `resolved` URLs point at an internal
  mirror, which (a) leaks internal hostnames and (b) breaks CI `npm ci`. Re-point to public
  before committing.

- **PDF export is ASCII-only.** jsPDF's built-in fonts are WinAnsi/Latin-1; the New Sheqel
  sign `₪` (U+20AA) corrupts the whole table's text rendering. So the PDF shows plain numbers
  with **"NIS"** in the column headers (Excel keeps `₪` — it handles Unicode fine). Adding a
  proper `₪`/Hebrew PDF later requires embedding a Unicode TTF font.

- **Dates are day-before-month (`DD/MM/YYYY`)** everywhere, and the MUI date pickers are
  explicitly given `format="DD/MM/YYYY"` (they default to en-US `MM/DD/YYYY`). Chart tick/tooltip
  formatting and the summary dates follow the same convention.

- **`xlsx` (SheetJS) has published advisories** but is kept: it only ever parses the user's own
  local files in-browser and is never sent anywhere. Swap for the SheetJS CDN build if desired.

- **Default supplier plans are illustrative and time-sensitive.** They're real 2025–26 Israeli
  supplier tracks (Electra Power, Cellcom, Amisragas, Pazgas) but **offers change** — re-verify
  before relying on them. The **`bundleOnly`** flag (e.g. Amisragas requires a gas subscription)
  exists so such plans can be excluded from the comparison via the Plans-page toggle; the
  what-if simulator uses the same filtered ("active") plan set.

- **localStorage keys are versioned** (`iec.plans.v2`, `iec.data.v1`, `iec.settings.v1`). The
  `iec.` prefix is legacy/internal and intentionally left unchanged to avoid wiping existing
  users' data on rename. Bump the version suffix when the stored shape changes.

- **Generated export files are git-ignored.** Running the exporters in Node writes
  `powerplan-comparison.pdf/.xlsx` to the repo root; these are ignored so they never get
  committed.

---

## Full UI/GUI decision list (by area)

### Platform & libraries
- React + TypeScript — 📋 · Vite — 📋
- Material UI (MUI) component + styling system — 📋 (pinned v6 — ⚙️)
- Emotion (MUI's styling engine) — ⚙️
- Recharts — 📋 (pinned v2 — ⚙️)
- Day.js — 📋 · `@mui/x-date-pickers` for date pickers — ⚙️
- `@mui/icons-material` — ⚙️
- PapaParse (CSV), SheetJS `xlsx` (Excel), jsPDF + jspdf-autotable (PDF) — ⚙️
- Layout via `Box` CSS-grid rather than `Grid` — ⚙️

### Theme & visual style
- Custom light + dark MUI theme; palette primary blue `#1976d2`, secondary purple, success
  green, warning orange — ⚙️ (dark mode itself was a 📋 bonus)
- Dark-mode toggle in the app bar, persisted to localStorage — 📋 / ⚙️
- Flat "dashboard" aesthetic: cards, radius 12, 1px divider borders, no shadows, Inter/Roboto — ⚙️
- Shared `SERIES_COLORS` palette for consistent per-plan coloring — ⚙️

### Layout & navigation
- Tabbed navigation in a sticky AppBar (desktop) — ⚙️
- Settings gear → Settings dialog — 🗣️
- Bottom navigation bar on phones (≤600px) — 🗣️
- KPI cards row (Total Consumption, Base Cost, Cheapest Plan, Potential Savings) — 📋
- Cheapest-plan highlight banner — 📋

### Charts / visualizations
- Daily (line), Monthly (bar), hour-of-day (bar), weekday (bar) — 📋
- Weekday × hour heatmap (CSS-grid Box; horizontally scrollable on mobile) — ⚙️ (heatmap 📋)
- Distribution donuts (weekday/weekend; day/evening/night) — 📋
- Monthly bill comparison (grouped bars) + monthly savings (lines) — 📋
- Per-plan "where the bill comes from" pie — 📋

### Editors, dialogs & controls
- Plan editor dialog — days toggle group, time pickers, discount field, validation +
  overlap/ambiguity warnings, color picker, supplier field, bundle checkbox — 📋
- What-if simulator (shift usage day/evening/night) — 📋
- Filters bar — date-range pickers + All/Weekdays/Weekend toggle — 📋
- Import UI — drag-and-drop + file picker + "Load sample data" + "Open IEC portal" guide — ⚙️
- Excel + PDF export buttons on Comparison — 📋

### Formatting & localization
- Currency ₪ (NIS), energy kWh — 📋
- Weekday convention 0=Sun…6=Sat; weekend = Fri/Sat — ⚙️
- Dates day-before-month (`DD/MM/YYYY`) — 🗣️

### State & persistence
- React Context with memoized selectors — ⚙️
- localStorage for data, plans, settings; auto-restore on reload — 📋

### Decisions driven by mid-build concerns (🗣️)
1. Day/evening/night boundaries made configurable in Settings; default day-start 06:00 → 07:00.
2. Weekday chart + heatmap hide filtered-out days (instead of misleading empty bars).
3. Pie % labels moved inside the donut ring (were clipped by the banner).
4. Real supplier plans replaced placeholders; each shows name + supplier; base price 0.6432 ₪/kWh.
5. Pazgas corrected to 5% (+ day/night); IEC baseline relabeled "IEC — full tariff".
6. Bundle-only flag + Plans-page toggle; excluded from comparison & cheapest; toggle always
   visible; what-if simulator respects it too.
7. All dates → day-before-month; date pickers forced to `DD/MM/YYYY`.
8. Chart date-axis labels shortened, angled, auto-thinned (no overlap).
9. Import guidance: "Open IEC portal" + step-by-step (a static app can't fetch for the user).
10. App renamed "IEC Tariff Analyzer" → "PowerPlan" (title, app bar, package, folder).
11. Mobile pass: bottom nav; responsive comparison table; scrollable import summary table.
12. PDF export fixed (ASCII-safe, "NIS") and export filenames rebranded.
