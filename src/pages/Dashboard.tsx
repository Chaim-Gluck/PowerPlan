import { Box, Typography, Stack, TextField, InputAdornment, Button, Card, CardContent, Chip } from '@mui/material';
import BoltIcon from '@mui/icons-material/Bolt';
import PaidIcon from '@mui/icons-material/Paid';
import SavingsIcon from '@mui/icons-material/Savings';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import { useMemo } from 'react';
import { useApp } from '../state/AppContext';
import StatCard from '../components/StatCard';
import ChartCard from '../components/ChartCard';
import FiltersBar from '../components/FiltersBar';
import TimeSeriesChart from '../charts/TimeSeriesChart';
import HourWeekdayHeatmap from '../charts/HourWeekdayHeatmap';
import DistributionPieChart from '../charts/DistributionPieChart';
import {
  dailyConsumption, monthlyConsumption, consumptionByHour, consumptionByWeekday,
  hourWeekdayHeatmap, weekdayWeekendSplit, timeOfDaySplit,
} from '../utils/analytics';
import { formatKWh, formatNIS, formatPercent } from '../utils/format';

const gridCards = { display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: 'repeat(4, 1fr)' } };
const gridCharts = { display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } };

export default function Dashboard({ onNavigate }: { onNavigate: (tab: string) => void }) {
  const { records, summary, comparison, basePrice, setBasePrice, timeBoundaries } = useApp();

  const charts = useMemo(() => ({
    daily: dailyConsumption(records),
    monthly: monthlyConsumption(records),
    byHour: consumptionByHour(records),
    byWeekday: consumptionByWeekday(records),
    heat: hourWeekdayHeatmap(records),
    weekend: weekdayWeekendSplit(records),
    tod: timeOfDaySplit(records, timeBoundaries),
  }), [records, timeBoundaries]);

  if (records.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 10 }}>
        <BoltIcon sx={{ fontSize: 64, color: 'primary.main', mb: 2 }} />
        <Typography variant="h5" gutterBottom>No data yet</Typography>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          Import your IEC meter export (or load the sample) to see your personalized tariff analysis.
        </Typography>
        <Button variant="contained" size="large" startIcon={<UploadFileIcon />} onClick={() => onNavigate('import')}>
          Import data
        </Button>
      </Box>
    );
  }

  const cheapest = comparison?.cheapest;

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} spacing={2}>
        <Typography variant="h4">Dashboard</Typography>
        <TextField
          label="Base price" type="number" size="small" value={basePrice}
          onChange={(e) => setBasePrice(Math.max(0, Number(e.target.value)))}
          inputProps={{ step: 0.01, min: 0 }}
          InputProps={{ endAdornment: <InputAdornment position="end">₪/kWh</InputAdornment> }}
          sx={{ maxWidth: 200 }}
        />
      </Stack>

      <FiltersBar />

      {/* KPI cards */}
      <Box sx={gridCards}>
        <StatCard title="Total consumption" value={formatKWh(summary.totalConsumption)}
          subtitle={`${summary.startDate} → ${summary.endDate}`} icon={<BoltIcon />} color="#1976d2" />
        <StatCard title="Current base cost" value={formatNIS(comparison?.baseCost ?? 0)}
          subtitle={`at ${formatNIS(basePrice, 4)}/kWh, no discount`} icon={<PaidIcon />} color="#ed6c02" />
        <StatCard title="Cheapest plan" value={cheapest ? cheapest.planName : '—'}
          subtitle={cheapest ? `${formatNIS(cheapest.totalCost)} total` : 'Add plans to compare'}
          icon={<EmojiEventsIcon />} color="#2e7d32" accent />
        <StatCard title="Potential savings" value={cheapest ? formatNIS(cheapest.savings) : '—'}
          subtitle={cheapest ? `${formatPercent(cheapest.savingsPercent)} vs base` : ''}
          icon={<SavingsIcon />} color="#7b1fa2" accent />
      </Box>

      {cheapest && (
        <Card elevation={0} sx={{ border: '1px solid', borderColor: 'success.main', bgcolor: 'success.main', color: 'success.contrastText', opacity: 0.95 }}>
          <CardContent>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }} justifyContent="space-between">
              <Box>
                <Typography variant="h6">🏆 {cheapest.planName} is your best match</Typography>
                <Typography variant="body2">
                  Saves {formatNIS(cheapest.savings)} ({formatPercent(cheapest.savingsPercent)}) over {summary.startDate}–{summary.endDate},
                  about {formatNIS(cheapest.averageMonthlyCost)}/month.
                </Typography>
              </Box>
              <Button variant="contained" color="inherit" sx={{ color: 'success.main' }} onClick={() => onNavigate('comparison')}>
                See full comparison
              </Button>
            </Stack>
          </CardContent>
        </Card>
      )}

      {/* Usage charts */}
      <Box sx={gridCharts}>
        <ChartCard title="Daily usage" subtitle="Total kWh per day">
          <TimeSeriesChart data={charts.daily} type="line" dateAxis />
        </ChartCard>
        <ChartCard title="Monthly usage" subtitle="Total kWh per calendar month">
          <TimeSeriesChart data={charts.monthly} type="bar" color="#2e7d32" dateAxis />
        </ChartCard>
        <ChartCard title="Consumption by hour of day" subtitle="Summed across the whole period">
          <TimeSeriesChart data={charts.byHour} type="bar" color="#ed6c02" tickInterval={2} />
        </ChartCard>
        <ChartCard title="Consumption by weekday" subtitle="Sun–Sat totals">
          <TimeSeriesChart data={charts.byWeekday} type="bar" color="#7b1fa2" tickInterval={0} />
        </ChartCard>
      </Box>

      <ChartCard title="Weekday × hour heatmap" subtitle="Where your energy goes across the week">
        <HourWeekdayHeatmap cells={charts.heat} />
      </ChartCard>

      <Box sx={gridCharts}>
        <ChartCard title="Weekdays vs weekend" subtitle="Consumption distribution">
          <DistributionPieChart data={charts.weekend} colors={['#1976d2', '#ed6c02']} />
        </ChartCard>
        <ChartCard title="Day / evening / night" subtitle="Consumption distribution">
          <DistributionPieChart data={charts.tod} colors={['#f9a825', '#7b1fa2', '#0288d1']} />
        </ChartCard>
      </Box>

      <Box>
        <Chip label={`${summary.recordCount.toLocaleString()} records`} sx={{ mr: 1 }} />
        <Chip label={`${summary.intervalMinutes}-min interval`} sx={{ mr: 1 }} />
        <Chip label={`${summary.monthCount} months`} />
      </Box>
    </Stack>
  );
}
