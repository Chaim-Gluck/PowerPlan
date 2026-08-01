import { useMemo } from 'react';
import { Stack, Typography, Card, CardContent, Box, Alert, List, ListItem, ListItemIcon, ListItemText } from '@mui/material';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import FactCheckIcon from '@mui/icons-material/FactCheck';
import { useTranslation } from 'react-i18next';
import { useApp } from '../state/AppContext';
import { generateInsights, weekdayWeekendSplit, timeOfDaySplit } from '../utils/analytics';
import ChartCard from '../components/ChartCard';
import DistributionPieChart from '../charts/DistributionPieChart';
import { formatNIS } from '../utils/format';

const gridCharts = { display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } };

export default function InsightsPage() {
  const { t, i18n } = useTranslation();
  const { records, comparison, timeBoundaries } = useApp();

  const insightTexts = useMemo(() => {
    return generateInsights(records, comparison, timeBoundaries).map((ins) => {
      const params = { ...(ins.params ?? {}) };
      if (typeof params.direction === 'string') params.direction = t(`insights.${params.direction}`);
      return t(ins.key, params);
    });
  }, [records, comparison, timeBoundaries, t, i18n.language]);

  const weekend = useMemo(
    () => weekdayWeekendSplit(records, { weekdays: t('charts.split.weekdays'), weekend: t('charts.split.weekend') }),
    [records, t, i18n.language],
  );
  const tod = useMemo(
    () => timeOfDaySplit(records, timeBoundaries, (bucket, start, end) => t(`charts.bucket.${bucket}`, { start, end })),
    [records, timeBoundaries, t, i18n.language],
  );

  if (records.length === 0) {
    return <Alert severity="info">{t('insights.needData')}</Alert>;
  }

  const billed = comparison?.comparisons.find((c) => c.billedTotal != null);

  return (
    <Stack spacing={3}>
      <Typography variant="h4">{t('insights.title')}</Typography>

      <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
        <CardContent>
          <List>
            {insightTexts.map((text, i) => (
              <ListItem key={i} alignItems="flex-start">
                <ListItemIcon sx={{ minWidth: 40 }}><LightbulbIcon color="warning" /></ListItemIcon>
                <ListItemText primary={text} />
              </ListItem>
            ))}
          </List>
        </CardContent>
      </Card>

      {billed && billed.billedTotal != null && (
        <Alert icon={<FactCheckIcon />} severity={Math.abs(billed.totalCost - billed.billedTotal) / billed.billedTotal < 0.02 ? 'success' : 'warning'}>
          {t('insights.validation.text', {
            plan: billed.planName,
            computed: formatNIS(billed.totalCost),
            billed: formatNIS(billed.billedTotal),
            diff: formatNIS(Math.abs(billed.totalCost - billed.billedTotal)),
          })}
        </Alert>
      )}

      <Box sx={gridCharts}>
        <ChartCard title={t('dashboard.charts.weekendSplit')} subtitle={t('insights.validation.whereWeekend')}>
          <DistributionPieChart data={weekend} colors={['#1976d2', '#ed6c02']} />
        </ChartCard>
        <ChartCard title={t('dashboard.charts.todSplit')} subtitle={t('insights.validation.todSub')}>
          <DistributionPieChart data={tod} colors={['#f9a825', '#7b1fa2', '#0288d1']} />
        </ChartCard>
      </Box>
    </Stack>
  );
}
