import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';
import { useTheme } from '@mui/material/styles';
import type { NamedValue } from '../utils/analytics';
import { SERIES_COLORS } from '../theme/theme';

interface Props {
  data: NamedValue[];
  height?: number;
  colors?: string[];
  unit?: string;
}

/** Reusable donut chart for distribution breakdowns. */
export default function DistributionPieChart({ data, height = 260, colors = SERIES_COLORS, unit = 'kWh' }: Props) {
  const theme = useTheme();
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const tooltipStyle = {
    backgroundColor: theme.palette.background.paper,
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 8,
  };

  // Draw the % label INSIDE the donut ring so it never gets clipped by the
  // card header / surrounding banner. Hidden for very small slices.
  const RAD = Math.PI / 180;
  const renderLabel = (e: {
    cx: number; cy: number; midAngle: number; innerRadius: number; outerRadius: number; percent: number;
  }) => {
    if (e.percent < 0.05) return null;
    const r = e.innerRadius + (e.outerRadius - e.innerRadius) * 0.5;
    const x = e.cx + r * Math.cos(-e.midAngle * RAD);
    const y = e.cy + r * Math.sin(-e.midAngle * RAD);
    return (
      <text x={x} y={y} fill="#fff" textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight={700}>
        {(e.percent * 100).toFixed(0)}%
      </text>
    );
  };

  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          innerRadius="55%"
          outerRadius="80%"
          paddingAngle={2}
          label={renderLabel}
          labelLine={false}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={colors[i % colors.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(v: number, n: string) => [`${v.toLocaleString('en-US', { maximumFractionDigits: 0 })} ${unit} (${((v / total) * 100).toFixed(1)}%)`, n]}
        />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}
