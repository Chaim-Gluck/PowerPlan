import { Box, Tooltip, Typography, useTheme } from '@mui/material';
import { useTranslation } from 'react-i18next';
import type { HeatCell } from '../utils/analytics';
import { WEEKDAY_KEYS } from '../utils/analytics';

interface Props {
  cells: HeatCell[];
}

/**
 * Weekday × hour-of-day consumption heatmap. Built with CSS grid + MUI (rather
 * than Recharts, which has no first-class heatmap) so it stays crisp and
 * responsive. Colour intensity encodes total kWh in that weekday/hour cell.
 */
export default function HourWeekdayHeatmap({ cells }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const max = Math.max(...cells.map((c) => c.value), 0.0001);
  const base = theme.palette.primary.main;
  const dayLabel = (d: number) => t(`charts.weekday.${WEEKDAY_KEYS[d]}`);

  // Only render weekdays that appear in the data (respects weekday/weekend filter).
  const weekdays = Array.from(new Set(cells.map((c) => c.weekday))).sort((a, b) => a - b);
  const grid = new Map<number, (HeatCell | undefined)[]>();
  for (const d of weekdays) grid.set(d, new Array(24));
  for (const c of cells) grid.get(c.weekday)![c.hour] = c;

  return (
    <Box dir="ltr" sx={{ overflowX: 'auto' }}>
      <Box sx={{ minWidth: 640 }}>
        {/* Hour header */}
        <Box sx={{ display: 'grid', gridTemplateColumns: `36px repeat(24, 1fr)`, gap: '2px', mb: '2px' }}>
          <Box />
          {Array.from({ length: 24 }, (_, h) => (
            <Typography key={h} variant="caption" align="center" sx={{ fontSize: 9, color: 'text.secondary' }}>
              {h % 3 === 0 ? h : ''}
            </Typography>
          ))}
        </Box>
        {weekdays.map((d) => {
          const row = grid.get(d)!;
          return (
          <Box key={d} sx={{ display: 'grid', gridTemplateColumns: `36px repeat(24, 1fr)`, gap: '2px', mb: '2px' }}>
            <Typography variant="caption" sx={{ fontSize: 10, color: 'text.secondary', alignSelf: 'center' }}>
              {dayLabel(d)}
            </Typography>
            {row.map((cell, h) => {
              const intensity = cell ? cell.value / max : 0;
              return (
                <Tooltip
                  key={h}
                  title={t('charts.heatmapCell', { day: dayLabel(d), hour: `${String(h).padStart(2, '0')}:00`, value: (cell?.value ?? 0).toFixed(1) })}
                  arrow
                >
                  <Box
                    sx={{
                      height: 18,
                      borderRadius: '3px',
                      backgroundColor: base,
                      opacity: 0.12 + intensity * 0.88,
                    }}
                  />
                </Tooltip>
              );
            })}
          </Box>
          );
        })}
      </Box>
    </Box>
  );
}
