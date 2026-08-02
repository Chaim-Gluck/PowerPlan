import { useState } from 'react';
import { useMediaQuery } from '@mui/material';
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
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  // With many plans the legend can grow taller than the plot on a phone. Cap it
  // to a scrollable strip on mobile and give the plot extra height so it's never
  // squeezed out; desktop keeps the normal auto-height legend.
  const chartHeight = isMobile ? Math.max(height, 360) : height;

  // Series the user has hidden by clicking the legend (keyed by plan name, which
  // is the chart dataKey). Toggling just flips Recharts' `hide` on each series.
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const toggleSeries = (key: string) => setHidden((prev) => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });
  const legendProps = {
    onClick: (e: { dataKey?: unknown; value?: unknown }) =>
      toggleSeries(String(e.dataKey ?? labelToId.get(String(e.value)) ?? e.value)),
    formatter: (value: string) => {
      const id = labelToId.get(value) ?? value;
      return (
        <span
          style={{
            color: hidden.has(id) ? theme.palette.text.disabled : theme.palette.text.primary,
            textDecoration: hidden.has(id) ? 'line-through' : 'none',
          }}
        >
          {value}
        </span>
      );
    },
    wrapperStyle: isMobile
      ? { cursor: 'pointer', maxHeight: 92, overflowY: 'auto' as const, fontSize: 11 }
      : { cursor: 'pointer' },
  };

  // Display label — includes the supplier so plans that share a name (e.g. two
  // "Day 15%" tracks from different suppliers) stay distinguishable.
  const seriesLabel = (c: { planName: string; supplier?: string }) =>
    c.supplier ? `${c.planName} (${c.supplier})` : c.planName;
  // Map the visible label back to the unique planId (the series' hidden key).
  const labelToId = new Map(comparison.comparisons.map((c) => [seriesLabel(c), c.planId]));

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
      // Key rows by the unique planId (not the name) so same-named plans don't collide.
      row[c.planId] = metric === 'cost' ? round2(cost) : round2((baseByMonth[m] ?? cost) - cost);
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
    <ResponsiveContainer width="100%" height={chartHeight}>
      {metric === 'cost' ? (
        <BarChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={grid} />
          <XAxis {...xAxisProps} />
          <YAxis tick={{ fill: axis, fontSize: 12 }} width={52} />
          <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => `₪${v}`} labelFormatter={monthTick} cursor={{ fill: theme.palette.action.hover }} />
          <Legend {...legendProps} />
          {comparison.comparisons.map((c, i) => (
            <Bar key={c.planId} dataKey={c.planId} name={seriesLabel(c)} hide={hidden.has(c.planId)} fill={c.color ?? SERIES_COLORS[i % SERIES_COLORS.length]} radius={[3, 3, 0, 0]} />
          ))}
        </BarChart>
      ) : (
        <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={grid} />
          <XAxis {...xAxisProps} />
          <YAxis tick={{ fill: axis, fontSize: 12 }} width={52} />
          <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => `₪${v}`} labelFormatter={monthTick} />
          <Legend {...legendProps} />
          {comparison.comparisons.map((c, i) => (
            <Line key={c.planId} type="monotone" dataKey={c.planId} name={seriesLabel(c)} hide={hidden.has(c.planId)} stroke={c.color ?? SERIES_COLORS[i % SERIES_COLORS.length]} strokeWidth={2} dot={false} />
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
