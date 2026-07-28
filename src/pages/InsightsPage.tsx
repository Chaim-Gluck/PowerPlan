import { useMemo } from 'react';
import { Stack, Typography, Card, CardContent, Box, Alert, List, ListItem, ListItemIcon, ListItemText } from '@mui/material';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import FactCheckIcon from '@mui/icons-material/FactCheck';
import { useApp } from '../state/AppContext';
import { generateInsights, weekdayWeekendSplit, timeOfDaySplit } from '../utils/analytics';
import ChartCard from '../components/ChartCard';
import DistributionPieChart from '../charts/DistributionPieChart';
import { formatNIS } from '../utils/format';

const gridCharts = { display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } };

export default function InsightsPage() {
  const { records, comparison, timeBoundaries } = useApp();

  const insights = useMemo(() => generateInsights(records, comparison, timeBoundaries), [records, comparison, timeBoundaries]);
  const weekend = useMemo(() => weekdayWeekendSplit(records), [records]);
  const tod = useMemo(() => timeOfDaySplit(records, timeBoundaries), [records, timeBoundaries]);

  if (records.length === 0) {
    return <Alert severity="info">Import data to generate insights.</Alert>;
  }

  const billed = comparison?.comparisons.find((c) => c.billedTotal != null);

  return (
    <Stack spacing={3}>
      <Typography variant="h4">Insights</Typography>

      <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
        <CardContent>
          <List>
            {insights.map((text, i) => (
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
          Engine validation — your file included a real billed cost. For “{billed.planName}” the engine computed{' '}
          <b>{formatNIS(billed.totalCost)}</b> vs. the billed <b>{formatNIS(billed.billedTotal)}</b>{' '}
          (difference {formatNIS(Math.abs(billed.totalCost - billed.billedTotal))}).
        </Alert>
      )}

      <Box sx={gridCharts}>
        <ChartCard title="Weekdays vs weekend" subtitle="Where your consumption falls">
          <DistributionPieChart data={weekend} colors={['#1976d2', '#ed6c02']} />
        </ChartCard>
        <ChartCard title="Day / evening / night" subtitle="Time-of-day distribution">
          <DistributionPieChart data={tod} colors={['#f9a825', '#7b1fa2', '#0288d1']} />
        </ChartCard>
      </Box>
    </Stack>
  );
}
