import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import dayjs, { type Dayjs } from 'dayjs';
import { useTranslation } from 'react-i18next';
import {
  enrichRecords,
  defaultPlans,
  DEFAULT_BASE_PRICE,
  BillCalculator,
  type ConsumptionRecord,
  type EnrichedRecord,
  type TariffPlan,
  type ComparisonResult,
} from '../pricing';
import {
  loadData,
  loadPlans,
  loadSettings,
  saveData,
  savePlans,
  saveSettings,
  clearData as clearStoredData,
} from '../utils/storage';
import { summarize, DEFAULT_TIME_BOUNDARIES, type DataSummary, type TimeBoundaries } from '../utils/analytics';
import { resolvePlan } from '../utils/planDisplay';
import type { Language } from '../i18n/config';

export type FilterMode = 'all' | 'weekday' | 'weekend';

interface AppState {
  // Raw imported data.
  rawRecords: ConsumptionRecord[];
  intervalMinutes: number;
  fileName?: string;
  // Configuration.
  plans: TariffPlan[];
  basePrice: number;
  darkMode: boolean;
  /** Active UI language. */
  language: Language;
  /** Configurable day/evening/night boundaries used by distribution analytics. */
  timeBoundaries: TimeBoundaries;
  /** Whether bundle-only plans are included in the comparison and plan list. */
  includeBundlePlans: boolean;
  // Filters (bonus).
  dateRange: [Dayjs | null, Dayjs | null];
  filterMode: FilterMode;
}

interface AppContextValue extends AppState {
  /** All records (enriched), unfiltered. */
  allRecords: EnrichedRecord[];
  /** Records after date-range + weekday/weekend filters. */
  records: EnrichedRecord[];
  /** Plans actually used in comparisons (bundle-only excluded when toggled off). */
  activePlans: TariffPlan[];
  summary: DataSummary;
  comparison: ComparisonResult | null;

  setData: (records: ConsumptionRecord[], intervalMinutes: number, fileName?: string) => void;
  clearData: () => void;
  setBasePrice: (price: number) => void;
  toggleDarkMode: () => void;
  setLanguage: (lng: Language) => void;
  setTimeBoundaries: (b: TimeBoundaries) => void;
  setIncludeBundlePlans: (v: boolean) => void;
  setDateRange: (range: [Dayjs | null, Dayjs | null]) => void;
  setFilterMode: (mode: FilterMode) => void;

  addPlan: (plan: TariffPlan) => void;
  updatePlan: (plan: TariffPlan) => void;
  deletePlan: (planId: string) => void;
  resetPlans: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const { i18n } = useTranslation();
  // Read persisted state ONCE, synchronously, so initial state already reflects
  // localStorage. This avoids the "default -> hydrate" race (which, under
  // StrictMode, could persist a default value over a just-loaded one).
  const initialRef = useRef<{
    data: ReturnType<typeof loadData>;
    plans: ReturnType<typeof loadPlans>;
    settings: ReturnType<typeof loadSettings>;
  } | null>(null);
  if (!initialRef.current) {
    initialRef.current = { data: loadData(), plans: loadPlans(), settings: loadSettings() };
  }
  const init = initialRef.current;
  const s = init.settings;

  const [rawRecords, setRawRecords] = useState<ConsumptionRecord[]>(init.data?.records ?? []);
  const [intervalMinutes, setIntervalMinutes] = useState(init.data?.intervalMinutes ?? 60);
  const [fileName, setFileName] = useState<string | undefined>(init.data?.fileName);
  const [plans, setPlans] = useState<TariffPlan[]>(
    init.plans && init.plans.length > 0 ? init.plans : defaultPlans(),
  );
  const [basePrice, setBasePriceState] = useState(s?.basePrice ?? DEFAULT_BASE_PRICE);
  const [darkMode, setDarkMode] = useState(s?.darkMode ?? false);
  const [language, setLanguageState] = useState<Language>(
    s?.language === 'he' || s?.language === 'en' ? s.language : 'en',
  );
  const [timeBoundaries, setTimeBoundariesState] = useState<TimeBoundaries>(
    s && typeof s.dayStartHour === 'number' && typeof s.eveningStartHour === 'number' && typeof s.nightStartHour === 'number'
      ? { dayStart: s.dayStartHour, eveningStart: s.eveningStartHour, nightStart: s.nightStartHour }
      : DEFAULT_TIME_BOUNDARIES,
  );
  const [includeBundlePlans, setIncludeBundlePlansState] = useState(
    typeof s?.includeBundlePlans === 'boolean' ? s.includeBundlePlans : true,
  );
  const [dateRange, setDateRangeState] = useState<[Dayjs | null, Dayjs | null]>([null, null]);
  const [filterMode, setFilterModeState] = useState<FilterMode>('all');

  // Skip persisting on the very first render (values just came from storage).
  const firstRun = useRef(true);

  // --- Persist configuration when it changes (not on the initial load). ---
  useEffect(() => {
    if (firstRun.current) return;
    savePlans(plans);
  }, [plans]);
  useEffect(() => {
    if (firstRun.current) return;
    saveSettings({
      basePrice,
      darkMode,
      language,
      dayStartHour: timeBoundaries.dayStart,
      eveningStartHour: timeBoundaries.eveningStart,
      nightStartHour: timeBoundaries.nightStart,
      includeBundlePlans,
    });
  }, [basePrice, darkMode, language, timeBoundaries, includeBundlePlans]);
  // Flip the flag AFTER the persist effects have run once on mount.
  useEffect(() => {
    firstRun.current = false;
  }, []);

  // --- Derived: enriched records (memoized on raw data). ---
  const allRecords = useMemo(() => enrichRecords(rawRecords), [rawRecords]);

  // --- Derived: filtered records. ---
  const records = useMemo(() => {
    const [start, end] = dateRange;
    return allRecords.filter((r) => {
      if (start && dayjs(r.tsMs).isBefore(start.startOf('day'))) return false;
      if (end && dayjs(r.tsMs).isAfter(end.endOf('day'))) return false;
      if (filterMode === 'weekday' && (r.weekday === 5 || r.weekday === 6)) return false;
      if (filterMode === 'weekend' && !(r.weekday === 5 || r.weekday === 6)) return false;
      return true;
    });
  }, [allRecords, dateRange, filterMode]);

  const summary = useMemo(
    () => summarize(records, intervalMinutes),
    [records, intervalMinutes],
  );

  // Plans actually considered: default-plan i18n keys are resolved to the active
  // language so the comparison shows localised names, and bundle-only plans are
  // dropped when the toggle is off.
  const resolvedPlans = useMemo(
    () => {
      const tt = i18n.getFixedT(language);
      return plans.map((p) => resolvePlan(p, tt));
    },
    [plans, language, i18n],
  );
  const activePlans = useMemo(
    () => (includeBundlePlans ? resolvedPlans : resolvedPlans.filter((p) => !p.bundleOnly)),
    [resolvedPlans, includeBundlePlans],
  );

  const comparison = useMemo<ComparisonResult | null>(() => {
    if (records.length === 0 || activePlans.length === 0) return null;
    return BillCalculator.compareAll(records, activePlans, basePrice);
  }, [records, activePlans, basePrice]);

  // --- Actions ---
  const setData = (recs: ConsumptionRecord[], interval: number, name?: string) => {
    setRawRecords(recs);
    setIntervalMinutes(interval);
    setFileName(name);
    setDateRangeState([null, null]);
    saveData(recs, interval, name);
  };

  const clearData = () => {
    setRawRecords([]);
    setFileName(undefined);
    setDateRangeState([null, null]);
    clearStoredData();
  };

  const value: AppContextValue = {
    rawRecords,
    intervalMinutes,
    fileName,
    plans,
    basePrice,
    darkMode,
    language,
    timeBoundaries,
    includeBundlePlans,
    dateRange,
    filterMode,
    allRecords,
    records,
    activePlans,
    summary,
    comparison,
    setData,
    clearData,
    setBasePrice: setBasePriceState,
    toggleDarkMode: () => setDarkMode((d) => !d),
    setLanguage: setLanguageState,
    setTimeBoundaries: setTimeBoundariesState,
    setIncludeBundlePlans: setIncludeBundlePlansState,
    setDateRange: setDateRangeState,
    setFilterMode: setFilterModeState,
    addPlan: (plan) => setPlans((p) => [...p, plan]),
    updatePlan: (plan) => setPlans((p) => p.map((x) => (x.id === plan.id ? plan : x))),
    deletePlan: (planId) => setPlans((p) => p.filter((x) => x.id !== planId)),
    resetPlans: () => setPlans(defaultPlans()),
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
