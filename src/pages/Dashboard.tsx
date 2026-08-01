import { Box, Typography, Stack, TextField, InputAdornment, Button, Card, CardContent, Chip } from '@mui/material';
import BoltIcon from '@mui/icons-material/Bolt';
import PaidIcon from '@mui/icons-material/Paid';
import SavingsIcon from '@mui/icons-material/Savings';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useApp } from '../state/AppContext';
import StatCard from '../components/StatCard';
import ChartCard from '../components/ChartCard';
import FiltersBar from '../components/FiltersBar';
import TimeSeriesChart from '../charts/TimeSeriesChart';
import HourWeekdayHeatmap from '../charts/HourWeekdayHeatmap';
import DistributionPieChart from '../charts/DistributionPieChart';
import {
  dailyConsumption, monthlyConsumption, consumptionByHour, consumptionByWeekday,
  hourWeekdayHeatmap, weekdayWeekendSplit, timeOfDaySplit, WEEKDAY_KEYS,
} from '../utils/analytics';
import { formatKWh, formatNIS, formatPercent } from '../utils/format';

const gridCards = { display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: 'repeat(4, 1fr)' } };
const gridCharts = { display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } };

export default function Dashboard({ onNavigate }: { onNavigate: (tab: string) => void }) {
  const { t, i18n } = useTranslation();
  const { records, summary, comparison, basePrice, setBasePrice, timeBoundaries } = useApp();

  const charts = useMemo(() => {
    const weekdayLabel = (i: number) => t(`charts.weekday.${WEEKDAY_KEYS[i]}`);
    const weekendLabels = { weekdays: t('charts.split.weekdays'), weekend: t('charts.split.weekend') };
    const bucketLabel = (bucket: 'day' | 'evening' | 'night', start: string, end: string) =>
      t(`charts.bucket.${bucket}`, { start, end });
    return {
      daily: dailyConsumption(records),
      monthly: monthlyConsumption(records),
      byHour: consumptionByHour(records),
      byWeekday: consumptionByWeekday(records, weekdayLabel),
      heat: hourWeekdayHeatmap(records),
      weekend: weekdayWeekendSplit(records, weekendLabels),
      tod: timeOfDaySplit(records, timeBoundaries, bucketLabel),
    };
  }, [records, timeBoundaries, t, i18n.language]);

  if (records.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 10 }}>
        <BoltIcon sx={{ fontSize: 64, color: 'primary.main', mb: 2 }} />
        <Typography variant="h5" gutterBottom>{t('dashboard.empty.title')}</Typography>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          {t('dashboard.empty.body')}
        </Typography>
        <Button variant="contained" size="large" startIcon={<UploadFileIcon />} onClick={() => onNavigate('import')}>
          {t('dashboard.empty.button')}
        </Button>
      </Box>
    );
  }

  const cheapest = comparison?.cheapest;

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} spacing={2}>
        <Typography variant="h4">{t('dashboard.title')}</Typography>
        <TextField
          label={t('dashboard.basePrice')} type="number" size="small" value={basePrice}
          onChange={(e) => setBasePrice(Math.max(0, Number(e.target.value)))}
          inputProps={{ step: 0.01, min: 0 }}
          InputProps={{ endAdornment: <InputAdornment position="end">{t('settings.perKwh')}</InputAdornment> }}
          sx={{ maxWidth: 200 }}
        />
      </Stack>

      <FiltersBar />

      {/* KPI cards */}
      <Box sx={gridCards}>
        <StatCard title={t('dashboard.cards.totalConsumption')} value={formatKWh(summary.totalConsumption)}
          subtitle={`${summary.startDate} → ${summary.endDate}`} icon={<BoltIcon />} color="#1976d2" />
        <StatCard title={t('dashboard.cards.baseCost')} value={formatNIS(comparison?.baseCost ?? 0)}
          subtitle={t('dashboard.cards.baseCostSub', { price: formatNIS(basePrice, 4) })} icon={<PaidIcon />} color="#ed6c02" />
        <StatCard title={t('dashboard.cards.cheapestPlan')} value={cheapest ? cheapest.planName : t('common.dash')}
          subtitle={cheapest ? t('dashboard.cards.totalSuffix', { value: formatNIS(cheapest.totalCost) }) : t('dashboard.cards.addPlans')}
          icon={<EmojiEventsIcon />} color="#2e7d32" accent />
        <StatCard title={t('dashboard.cards.potentialSavings')} value={cheapest ? formatNIS(cheapest.savings) : t('common.dash')}
          subtitle={cheapest ? t('dashboard.cards.vsBase', { percent: formatPercent(cheapest.savingsPercent) }) : ''}
          icon={<SavingsIcon />} color="#7b1fa2" accent />
      </Box>

      {cheapest && (
        <Card elevation={0} sx={{ border: '1px solid', borderColor: 'success.main', bgcolor: 'success.main', color: 'success.contrastText', opacity: 0.95 }}>
          <CardContent>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }} justifyContent="space-between">
              <Box>
                <Typography variant="h6">{t('dashboard.banner.title', { plan: cheapest.planName })}</Typography>
                <Typography variant="body2">
                  {t('dashboard.banner.body', {
                    savings: formatNIS(cheapest.savings),
                    percent: formatPercent(cheapest.savingsPercent),
                    start: summary.startDate, end: summary.endDate,
                    monthly: formatNIS(cheapest.averageMonthlyCost),
                    monthlySavings: formatNIS(cheapest.savings / Math.max(comparison.monthCount, 1)),
                  })}
                </Typography>
              </Box>
              <Button variant="contained" color="inherit" sx={{ color: 'success.main' }} onClick={() => onNavigate('comparison')}>
                {t('dashboard.banner.cta')}
              </Button>
            </Stack>
          </CardContent>
        </Card>
      )}

      {/* Usage charts */}
      <Box sx={gridCharts}>
        <ChartCard title={t('dashboard.charts.daily')} subtitle={t('dashboard.charts.dailySub')}>
          <TimeSeriesChart data={charts.daily} type="line" dateAxis />
        </ChartCard>
        <ChartCard title={t('dashboard.charts.monthly')} subtitle={t('dashboard.charts.monthlySub')}>
          <TimeSeriesChart data={charts.monthly} type="bar" color="#2e7d32" dateAxis />
        </ChartCard>
        <ChartCard title={t('dashboard.charts.byHour')} subtitle={t('dashboard.charts.byHourSub')}>
          <TimeSeriesChart data={charts.byHour} type="bar" color="#ed6c02" tickInterval={2} />
        </ChartCard>
        <ChartCard title={t('dashboard.charts.byWeekday')} subtitle={t('dashboard.charts.byWeekdaySub')}>
          <TimeSeriesChart data={charts.byWeekday} type="bar" color="#7b1fa2" tickInterval={0} />
        </ChartCard>
      </Box>

      <ChartCard title={t('dashboard.charts.heatmap')} subtitle={t('dashboard.charts.heatmapSub')}>
        <HourWeekdayHeatmap cells={charts.heat} />
      </ChartCard>

      <Box sx={gridCharts}>
        <ChartCard title={t('dashboard.charts.weekendSplit')} subtitle={t('dashboard.charts.distributionSub')}>
          <DistributionPieChart data={charts.weekend} colors={['#1976d2', '#ed6c02']} />
        </ChartCard>
        <ChartCard title={t('dashboard.charts.todSplit')} subtitle={t('dashboard.charts.distributionSub')}>
          <DistributionPieChart data={charts.tod} colors={['#f9a825', '#7b1fa2', '#0288d1']} />
        </ChartCard>
      </Box>

      <Box>
        <Chip label={t('common.records', { count: summary.recordCount })} sx={{ mr: 1 }} />
        <Chip label={t('common.interval', { minutes: summary.intervalMinutes })} sx={{ mr: 1 }} />
        <Chip label={t('common.months', { count: summary.monthCount })} />
      </Box>
    </Stack>
  );
}
