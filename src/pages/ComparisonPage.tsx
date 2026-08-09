import { useMemo, useState } from 'react';
import {
  Box, Typography, Stack, Button, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, Chip, MenuItem, TextField, Slider, Alert, Card, CardContent,
  ToggleButton, ToggleButtonGroup,
} from '@mui/material';
import GridOnIcon from '@mui/icons-material/GridOn';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import TuneIcon from '@mui/icons-material/Tune';
import { useTranslation } from 'react-i18next';
import { useApp } from '../state/AppContext';
import FiltersBar from '../components/FiltersBar';
import ChartCard from '../components/ChartCard';
import MonthlyPlanChart from '../charts/MonthlyPlanChart';
import DistributionPieChart from '../charts/DistributionPieChart';
import { BillCalculator } from '../pricing';
import { shiftConsumption, shiftByDayType, type Bucket, type DayType } from '../utils/whatIf';
import { exportComparisonExcel, exportComparisonPdf } from '../utils/exporters';
import { formatNIS, formatKWh, formatPercent } from '../utils/format';

const gridCharts = { display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } };
const hh = (h: number) => `${String(h).padStart(2, '0')}:00`;

export default function ComparisonPage() {
  const { t } = useTranslation();
  const { records, comparison, plans, activePlans, basePrice, timeBoundaries } = useApp();
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');

  // What-if simulator state.
  const [shiftType, setShiftType] = useState<'timeOfDay' | 'dayType'>('timeOfDay');
  const [fromBucket, setFromBucket] = useState<Bucket>('day');
  const [toBucket, setToBucket] = useState<Bucket>('night');
  const [fromDay, setFromDay] = useState<DayType>('weekend');
  const [toDay, setToDay] = useState<DayType>('weekday');
  const [shiftPct, setShiftPct] = useState(20);

  const whatIf = useMemo(() => {
    if (records.length === 0 || shiftPct === 0) return null;
    let shifted;
    if (shiftType === 'dayType') {
      if (fromDay === toDay) return null;
      shifted = shiftByDayType(records, fromDay, toDay, shiftPct / 100);
    } else {
      if (fromBucket === toBucket) return null;
      shifted = shiftConsumption(records, fromBucket, toBucket, shiftPct / 100, timeBoundaries);
    }
    return BillCalculator.compareAll(shifted, activePlans, basePrice);
  }, [records, activePlans, basePrice, shiftType, fromBucket, toBucket, fromDay, toDay, shiftPct, timeBoundaries]);

  const bucketLabels: Record<Bucket, string> = {
    day: t('charts.bucket.day', { start: hh(timeBoundaries.dayStart), end: hh(timeBoundaries.eveningStart) }),
    evening: t('charts.bucket.evening', { start: hh(timeBoundaries.eveningStart), end: hh(timeBoundaries.nightStart) }),
    night: t('charts.bucket.night', { start: hh(timeBoundaries.nightStart), end: hh(timeBoundaries.dayStart) }),
  };
  const dayLabels: Record<DayType, string> = {
    weekday: t('filters.weekdays'),
    weekend: t('filters.weekend'),
  };
  const shiftFromLabel = shiftType === 'dayType' ? dayLabels[fromDay] : bucketLabels[fromBucket];
  const shiftToLabel = shiftType === 'dayType' ? dayLabels[toDay] : bucketLabels[toBucket];

  if (!comparison || records.length === 0) {
    return <Alert severity="info">{t('comparison.needData')}</Alert>;
  }

  const selected = comparison.comparisons.find((c) => c.planId === selectedPlanId) ?? comparison.comparisons[0];
  const bundleIds = new Set(plans.filter((p) => p.bundleOnly).map((p) => p.id));
  const hideSm = { display: { xs: 'none', md: 'table-cell' } } as const;
  const ruleLabel = (label: string) => (label === 'No discount' ? t('comparison.breakdown.noDiscount') : label);

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} spacing={2}>
        <Typography variant="h4">{t('comparison.title')}</Typography>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" startIcon={<GridOnIcon />} onClick={() => exportComparisonExcel(comparison)}>{t('comparison.excel')}</Button>
          <Button variant="outlined" startIcon={<PictureAsPdfIcon />} onClick={() => exportComparisonPdf(comparison)}>{t('comparison.pdf')}</Button>
        </Stack>
      </Stack>

      <FiltersBar />

      {/* Comparison table */}
      <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>{t('comparison.table.rank')}</TableCell>
              <TableCell>{t('comparison.table.plan')}</TableCell>
              <TableCell align="right" sx={hideSm}>{t('comparison.table.totalCost')}</TableCell>
              <TableCell align="right" sx={hideSm}>{t('comparison.table.savingsVsBase')}</TableCell>
              <TableCell align="right">{t('comparison.table.savingsPercent')}</TableCell>
              <TableCell align="right" sx={hideSm}>{t('comparison.table.avgMonthly')}</TableCell>
              <TableCell align="right">{t('comparison.table.avgMonthlySavings')}</TableCell>
              <TableCell align="right" sx={hideSm}>{t('comparison.table.estYearly')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            <TableRow sx={{ bgcolor: 'action.hover' }}>
              <TableCell>{t('common.dash')}</TableCell>
              <TableCell><b>{t('comparison.table.iecBaseline')}</b>{t('comparison.table.iecBaselineSub')}</TableCell>
              <TableCell align="right" sx={hideSm}>{formatNIS(comparison.baseCost)}</TableCell>
              <TableCell align="right" sx={hideSm}>{t('common.dash')}</TableCell>
              <TableCell align="right">{t('common.dash')}</TableCell>
              <TableCell align="right" sx={hideSm}>{formatNIS(comparison.baseCost / Math.max(comparison.monthCount, 1))}</TableCell>
              <TableCell align="right">{t('common.dash')}</TableCell>
              <TableCell align="right" sx={hideSm}>{formatNIS((comparison.baseCost / Math.max(comparison.monthCount, 1)) * 12)}</TableCell>
            </TableRow>
            {comparison.comparisons.map((c) => (
              <TableRow
                key={c.planId}
                selected={c.isCheapest}
                sx={{ cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}
                onClick={() => setSelectedPlanId(c.planId)}
              >
                <TableCell>{c.rank}</TableCell>
                <TableCell>
                  <Stack direction="row" spacing={1} alignItems="flex-start">
                    <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: c.color ?? 'primary.main', mt: 0.6, flexShrink: 0 }} />
                    <Box>
                      {c.planName}
                      {c.supplier && (
                        <Typography variant="caption" display="block" color="text.secondary" sx={{ lineHeight: 1.1 }}>
                          {c.supplier}
                        </Typography>
                      )}
                      {(c.isCheapest || bundleIds.has(c.planId)) && (
                        <Stack direction="row" spacing={0.5} sx={{ mt: 0.5, flexWrap: 'wrap', gap: 0.5 }}>
                          {c.isCheapest && <Chip size="small" color="success" label={t('comparison.table.cheapest')} />}
                          {bundleIds.has(c.planId) && <Chip size="small" color="warning" variant="outlined" label={t('comparison.table.bundle')} />}
                        </Stack>
                      )}
                    </Box>
                  </Stack>
                </TableCell>
                <TableCell align="right" sx={hideSm}>{formatNIS(c.totalCost)}</TableCell>
                <TableCell align="right" sx={{ color: 'success.main', ...hideSm }}>{formatNIS(c.savings)}</TableCell>
                <TableCell align="right">{formatPercent(c.savingsPercent)}</TableCell>
                <TableCell align="right" sx={hideSm}>{formatNIS(c.averageMonthlyCost)}</TableCell>
                <TableCell align="right" sx={{ color: 'success.main' }}>{formatNIS(c.savings / Math.max(comparison.monthCount, 1))}</TableCell>
                <TableCell align="right" sx={hideSm}>{formatNIS(c.estimatedYearlyCost)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Monthly charts */}
      <Box sx={gridCharts}>
        <ChartCard title={t('comparison.charts.monthlyBill')} subtitle={t('comparison.charts.monthlyBillSub')}>
          <MonthlyPlanChart comparison={comparison} metric="cost" />
        </ChartCard>
        <ChartCard title={t('comparison.charts.monthlySavings')} subtitle={t('comparison.charts.monthlySavingsSub')}>
          <MonthlyPlanChart comparison={comparison} metric="savings" />
        </ChartCard>
      </Box>

      {/* Per-plan breakdown */}
      <ChartCard
        title={t('comparison.breakdown.title')}
        subtitle={t('comparison.breakdown.sub')}
        action={
          <TextField select size="small" label={t('comparison.breakdown.plan')} value={selected.planId}
            onChange={(e) => setSelectedPlanId(e.target.value)} sx={{ minWidth: 200 }}>
            {comparison.comparisons.map((c) => (
              <MenuItem key={c.planId} value={c.planId}>{c.planName}</MenuItem>
            ))}
          </TextField>
        }
      >
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
          <DistributionPieChart
            data={selected.appliedRules.map((r) => ({ name: ruleLabel(r.label), value: r.cost }))}
            unit="₪"
          />
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{t('comparison.breakdown.rule')}</TableCell>
                  <TableCell align="right">{t('comparison.breakdown.discount')}</TableCell>
                  <TableCell align="right">{t('comparison.breakdown.kwh')}</TableCell>
                  <TableCell align="right">{t('comparison.breakdown.cost')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {selected.appliedRules.map((r) => (
                  <TableRow key={r.ruleId}>
                    <TableCell>{ruleLabel(r.label)}</TableCell>
                    <TableCell align="right">{r.discountPercent}%</TableCell>
                    <TableCell align="right">{formatKWh(r.consumption)}</TableCell>
                    <TableCell align="right">{formatNIS(r.cost)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      </ChartCard>

      {/* What-if simulator */}
      <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
        <CardContent>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
            <TuneIcon color="primary" />
            <Typography variant="h6">{t('comparison.whatIf.title')}</Typography>
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {t('comparison.whatIf.intro')}
          </Typography>
          <ToggleButtonGroup
            size="small" exclusive value={shiftType}
            onChange={(_, v) => v && setShiftType(v)}
            sx={{ mb: 2 }}
          >
            <ToggleButton value="timeOfDay">{t('comparison.whatIf.timeOfDay')}</ToggleButton>
            <ToggleButton value="dayType">{t('comparison.whatIf.dayType')}</ToggleButton>
          </ToggleButtonGroup>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }}>
            {shiftType === 'timeOfDay' ? (
              <>
                <TextField select size="small" label={t('comparison.whatIf.shiftFrom')} value={fromBucket} onChange={(e) => setFromBucket(e.target.value as Bucket)}>
                  <MenuItem value="day">{bucketLabels.day}</MenuItem>
                  <MenuItem value="evening">{bucketLabels.evening}</MenuItem>
                  <MenuItem value="night">{bucketLabels.night}</MenuItem>
                </TextField>
                <TextField select size="small" label={t('comparison.whatIf.to')} value={toBucket} onChange={(e) => setToBucket(e.target.value as Bucket)}>
                  <MenuItem value="day">{bucketLabels.day}</MenuItem>
                  <MenuItem value="evening">{bucketLabels.evening}</MenuItem>
                  <MenuItem value="night">{bucketLabels.night}</MenuItem>
                </TextField>
              </>
            ) : (
              <>
                <TextField select size="small" label={t('comparison.whatIf.shiftFrom')} value={fromDay} onChange={(e) => setFromDay(e.target.value as DayType)}>
                  <MenuItem value="weekday">{dayLabels.weekday}</MenuItem>
                  <MenuItem value="weekend">{dayLabels.weekend}</MenuItem>
                </TextField>
                <TextField select size="small" label={t('comparison.whatIf.to')} value={toDay} onChange={(e) => setToDay(e.target.value as DayType)}>
                  <MenuItem value="weekday">{dayLabels.weekday}</MenuItem>
                  <MenuItem value="weekend">{dayLabels.weekend}</MenuItem>
                </TextField>
              </>
            )}
            <Box sx={{ minWidth: 220, px: 2 }}>
              <Typography variant="caption">{t('comparison.whatIf.shiftAmount', { percent: shiftPct })}</Typography>
              <Slider value={shiftPct} onChange={(_, v) => setShiftPct(v as number)} min={0} max={100} step={5} valueLabelDisplay="auto" />
            </Box>
          </Stack>

          {whatIf?.cheapest && (() => {
            // Extra monthly saving from changing usage: current best cost minus the
            // best cost after the shift, per month. Positive = the shift helps.
            const monthlyDelta = comparison.cheapest
              ? (comparison.cheapest.totalCost - whatIf.cheapest.totalCost) / Math.max(comparison.monthCount, 1)
              : 0;
            const hasGain = monthlyDelta > 0.5;
            return (
              <Alert severity={hasGain ? 'success' : 'info'} sx={{ mt: 2 }}>
                {hasGain
                  ? t('comparison.whatIf.result', {
                      percent: shiftPct,
                      from: shiftFromLabel,
                      to: shiftToLabel,
                      plan: whatIf.cheapest.planName,
                      monthlySaving: formatNIS(monthlyDelta),
                    })
                  : t('comparison.whatIf.resultNoGain', {
                      percent: shiftPct,
                      from: shiftFromLabel,
                      to: shiftToLabel,
                    })}
                {hasGain && (comparison.cheapest && whatIf.cheapest.planId !== comparison.cheapest.planId
                  ? t('comparison.whatIf.changed', { plan: comparison.cheapest.planName })
                  : t('comparison.whatIf.same'))}
              </Alert>
            );
          })()}
        </CardContent>
      </Card>
    </Stack>
  );
}
