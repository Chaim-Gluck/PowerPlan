import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import dayjs, { type Dayjs } from 'dayjs';
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
  const [rawRecords, setRawRecords] = useState<ConsumptionRecord[]>([]);
  const [intervalMinutes, setIntervalMinutes] = useState(60);
  const [fileName, setFileName] = useState<string | undefined>(undefined);
  const [plans, setPlans] = useState<TariffPlan[]>([]);
  const [basePrice, setBasePriceState] = useState(DEFAULT_BASE_PRICE);
  const [darkMode, setDarkMode] = useState(false);
  const [timeBoundaries, setTimeBoundariesState] = useState<TimeBoundaries>(DEFAULT_TIME_BOUNDARIES);
  const [includeBundlePlans, setIncludeBundlePlansState] = useState(true);
  const [dateRange, setDateRangeState] = useState<[Dayjs | null, Dayjs | null]>([null, null]);
  const [filterMode, setFilterModeState] = useState<FilterMode>('all');
  const [hydrated, setHydrated] = useState(false);

  // --- Hydrate from localStorage once. ---
  useEffect(() => {
    const storedData = loadData();
    if (storedData) {
      setRawRecords(storedData.records);
      setIntervalMinutes(storedData.intervalMinutes);
      setFileName(storedData.fileName);
    }
    const storedPlans = loadPlans();
    setPlans(storedPlans && storedPlans.length > 0 ? storedPlans : defaultPlans());
    const storedSettings = loadSettings();
    if (storedSettings) {
      setBasePriceState(storedSettings.basePrice);
      setDarkMode(storedSettings.darkMode);
      if (typeof storedSettings.includeBundlePlans === 'boolean') {
        setIncludeBundlePlansState(storedSettings.includeBundlePlans);
      }
      if (
        typeof storedSettings.dayStartHour === 'number' &&
        typeof storedSettings.eveningStartHour === 'number' &&
        typeof storedSettings.nightStartHour === 'number'
      ) {
        setTimeBoundariesState({
          dayStart: storedSettings.dayStartHour,
          eveningStart: storedSettings.eveningStartHour,
          nightStart: storedSettings.nightStartHour,
        });
      }
    }
    setHydrated(true);
  }, []);

  // --- Persist configuration. ---
  useEffect(() => {
    if (hydrated) savePlans(plans);
  }, [plans, hydrated]);
  useEffect(() => {
    if (hydrated) {
      saveSettings({
        basePrice,
        darkMode,
        dayStartHour: timeBoundaries.dayStart,
        eveningStartHour: timeBoundaries.eveningStart,
        nightStartHour: timeBoundaries.nightStart,
        includeBundlePlans,
      });
    }
  }, [basePrice, darkMode, timeBoundaries, includeBundlePlans, hydrated]);

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

  // Plans actually considered: bundle-only plans are dropped when the toggle is off.
  const activePlans = useMemo(
    () => (includeBundlePlans ? plans : plans.filter((p) => !p.bundleOnly)),
    [plans, includeBundlePlans],
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
