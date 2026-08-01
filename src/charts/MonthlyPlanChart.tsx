import { ResponsiveContainer, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { useTheme } from '@mui/material/styles';
import dayjs from 'dayjs';
import type { ComparisonResult } from '../pricing';
import { SERIES_COLORS } from '../theme/theme';

interface Props {
  comparison: ComparisonResult;
  height?: number;
  /** 'cost' = monthly bill per plan; 'savings' = monthly savings vs base. */
  metric?: 'cost' | 'savings';
}

/**
 * Multi-series monthly chart across all plans. Renders grouped bars for monthly
 * bills, or lines for monthly savings vs. the flat base price.
 */
export default function MonthlyPlanChart({ comparison, height = 320, metric = 'cost' }: Props) {
  const theme = useTheme();
  const grid = theme.palette.divider;
  const axis = theme.palette.text.secondary;

  // Union of all month keys, sorted.
  const months = Array.from(
    new Set(comparison.comparisons.flatMap((c) => Object.keys(c.monthlyCosts))),
  ).sort();

  // Base cost per month (for savings) — accurate flat base per month.
  const baseByMonth: Record<string, number> = comparison.monthlyBaseCosts;

  const data = months.map((m) => {
    const row: Record<string, number | string> = { name: m };
    for (const c of comparison.comparisons) {
      const cost = c.monthlyCosts[m] ?? 0;
      row[c.planName] = metric === 'cost' ? round2(cost) : round2((baseByMonth[m] ?? cost) - cost);
    }
    return row;
  });

  const tooltipStyle = {
    backgroundColor: theme.palette.background.paper,
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 8,
  };
  const monthTick = (v: string) => (/^\d{4}-\d{2}$/.test(v) ? dayjs(v).format('MM/YYYY') : v);
  const xAxisProps = {
    dataKey: 'name',
    tick: { fill: axis, fontSize: 12 },
    interval: 'preserveStartEnd' as const,
    minTickGap: 24,
    angle: -35,
    textAnchor: 'end' as const,
    height: 52,
    tickMargin: 8,
    tickFormatter: monthTick,
  };

  return (
    <div dir="ltr">
    <ResponsiveContainer width="100%" height={height}>
      {metric === 'cost' ? (
        <BarChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={grid} />
          <XAxis {...xAxisProps} />
          <YAxis tick={{ fill: axis, fontSize: 12 }} width={52} />
          <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => `₪${v}`} labelFormatter={monthTick} cursor={{ fill: theme.palette.action.hover }} />
          <Legend />
          {comparison.comparisons.map((c, i) => (
            <Bar key={c.planId} dataKey={c.planName} fill={c.color ?? SERIES_COLORS[i % SERIES_COLORS.length]} radius={[3, 3, 0, 0]} />
          ))}
        </BarChart>
      ) : (
        <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={grid} />
          <XAxis {...xAxisProps} />
          <YAxis tick={{ fill: axis, fontSize: 12 }} width={52} />
          <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => `₪${v}`} labelFormatter={monthTick} />
          <Legend />
          {comparison.comparisons.map((c, i) => (
            <Line key={c.planId} type="monotone" dataKey={c.planName} stroke={c.color ?? SERIES_COLORS[i % SERIES_COLORS.length]} strokeWidth={2} dot={false} />
          ))}
        </LineChart>
      )}
    </ResponsiveContainer>
    </div>
  );
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
