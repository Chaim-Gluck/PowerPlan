import { ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { useTheme } from '@mui/material/styles';
import dayjs from 'dayjs';
import type { NamedValue } from '../utils/analytics';

interface Props {
  data: NamedValue[];
  type?: 'line' | 'bar';
  color?: string;
  height?: number;
  /**
   * When true the x-axis holds date keys (`YYYY-MM-DD` / `YYYY-MM`). Labels are
   * shortened (e.g. `Jul '24`), angled, and auto-thinned so they never overlap
   * regardless of how many data points there are.
   */
  dateAxis?: boolean;
  /** Fixed tick interval for categorical axes (hour/weekday). Ignored for dateAxis. */
  tickInterval?: number;
  valueSuffix?: string;
}

/** Generic single-series time chart used for daily / weekly / monthly usage. */
export default function TimeSeriesChart({
  data,
  type = 'line',
  color,
  height = 260,
  dateAxis = false,
  tickInterval,
  valueSuffix = ' kWh',
}: Props) {
  const theme = useTheme();
  const stroke = color ?? theme.palette.primary.main;
  const grid = theme.palette.divider;
  const axis = theme.palette.text.secondary;

  const tooltipStyle = {
    backgroundColor: theme.palette.background.paper,
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 8,
    color: theme.palette.text.primary,
  };
  const fmtValue = (v: number) => `${v.toLocaleString('en-US', { maximumFractionDigits: 1 })}${valueSuffix}`;
  // Compact axis label: day/month for days (DD/MM/YY), month/year for months (MM/YYYY).
  const fmtDateTick = (v: string) => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return dayjs(v).format('DD/MM/YY');
    if (/^\d{4}-\d{2}$/.test(v)) return dayjs(v).format('MM/YYYY');
    return v;
  };
  // Full tooltip label (day before month).
  const fmtDateLabel = (v: string) => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return dayjs(v).format('DD/MM/YYYY');
    if (/^\d{4}-\d{2}$/.test(v)) return dayjs(v).format('MM/YYYY');
    return v;
  };

  // Axis config: date axes auto-thin + angle labels; categorical axes show fixed ticks.
  const xAxisProps = dateAxis
    ? {
        interval: 'preserveStartEnd' as const,
        minTickGap: 28,
        angle: -35,
        textAnchor: 'end' as const,
        height: 52,
        tickFormatter: fmtDateTick,
        tickMargin: 8,
      }
    : {
        interval: tickInterval ?? Math.max(0, Math.floor(data.length / 12)),
      };
  const bottomMargin = dateAxis ? 8 : 0;
  const labelFormatter = dateAxis ? (l: string) => fmtDateLabel(l) : undefined;

  return (
    <div dir="ltr">
    <ResponsiveContainer width="100%" height={height}>
      {type === 'line' ? (
        <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: bottomMargin }}>
          <CartesianGrid strokeDasharray="3 3" stroke={grid} />
          <XAxis dataKey="name" tick={{ fill: axis, fontSize: 12 }} {...xAxisProps} />
          <YAxis tick={{ fill: axis, fontSize: 12 }} width={48} />
          <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => fmtValue(v)} labelFormatter={labelFormatter} />
          <Line type="monotone" dataKey="value" stroke={stroke} strokeWidth={2} dot={false} />
        </LineChart>
      ) : (
        <BarChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: bottomMargin }}>
          <CartesianGrid strokeDasharray="3 3" stroke={grid} />
          <XAxis dataKey="name" tick={{ fill: axis, fontSize: 12 }} {...xAxisProps} />
          <YAxis tick={{ fill: axis, fontSize: 12 }} width={48} />
          <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => fmtValue(v)} labelFormatter={labelFormatter} cursor={{ fill: theme.palette.action.hover }} />
          <Bar dataKey="value" fill={stroke} radius={[4, 4, 0, 0]} />
        </BarChart>
      )}
    </ResponsiveContainer>
    </div>
  );
}
