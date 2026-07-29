import { useMemo, useState } from 'react';
import {
  Box, Typography, Stack, Button, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, Chip, MenuItem, TextField, Slider, Alert, Card, CardContent,
} from '@mui/material';
import GridOnIcon from '@mui/icons-material/GridOn';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import TuneIcon from '@mui/icons-material/Tune';
import { useApp } from '../state/AppContext';
import FiltersBar from '../components/FiltersBar';
import ChartCard from '../components/ChartCard';
import MonthlyPlanChart from '../charts/MonthlyPlanChart';
import DistributionPieChart from '../charts/DistributionPieChart';
import { BillCalculator } from '../pricing';
import { shiftConsumption, type Bucket } from '../utils/whatIf';
import { exportComparisonExcel, exportComparisonPdf } from '../utils/exporters';
import { formatNIS, formatKWh, formatPercent } from '../utils/format';

const gridCharts = { display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } };

export default function ComparisonPage() {
  const { records, comparison, plans, activePlans, basePrice, timeBoundaries } = useApp();
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');

  // What-if simulator state.
  const [fromBucket, setFromBucket] = useState<Bucket>('day');
  const [toBucket, setToBucket] = useState<Bucket>('night');
  const [shiftPct, setShiftPct] = useState(20);

  const whatIf = useMemo(() => {
    if (records.length === 0 || shiftPct === 0 || fromBucket === toBucket) return null;
    const shifted = shiftConsumption(records, fromBucket, toBucket, shiftPct / 100, timeBoundaries);
    return BillCalculator.compareAll(shifted, activePlans, basePrice);
  }, [records, activePlans, basePrice, fromBucket, toBucket, shiftPct, timeBoundaries]);

  const bucketLabels = {
    day: `Day (${hh(timeBoundaries.dayStart)}–${hh(timeBoundaries.eveningStart)})`,
    evening: `Evening (${hh(timeBoundaries.eveningStart)}–${hh(timeBoundaries.nightStart)})`,
    night: `Night (${hh(timeBoundaries.nightStart)}–${hh(timeBoundaries.dayStart)})`,
  };

  if (!comparison || records.length === 0) {
    return <Alert severity="info">Import data and define plans to see the comparison.</Alert>;
  }

  const selected = comparison.comparisons.find((c) => c.planId === selectedPlanId) ?? comparison.comparisons[0];
  const bundleIds = new Set(plans.filter((p) => p.bundleOnly).map((p) => p.id));
  // Secondary columns hidden on phones so the key ones (Plan, Total, Savings %) fit without scrolling.
  const hideSm = { display: { xs: 'none', md: 'table-cell' } } as const;

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} spacing={2}>
        <Typography variant="h4">Plan comparison</Typography>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" startIcon={<GridOnIcon />} onClick={() => exportComparisonExcel(comparison)}>Excel</Button>
          <Button variant="outlined" startIcon={<PictureAsPdfIcon />} onClick={() => exportComparisonPdf(comparison)}>PDF</Button>
        </Stack>
      </Stack>

      <FiltersBar />

      {/* Comparison table */}
      <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>#</TableCell>
              <TableCell>Plan</TableCell>
              <TableCell align="right">Total cost</TableCell>
              <TableCell align="right" sx={hideSm}>Savings vs base</TableCell>
              <TableCell align="right">Savings %</TableCell>
              <TableCell align="right" sx={hideSm}>Avg monthly</TableCell>
              <TableCell align="right" sx={hideSm}>Est. yearly</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            <TableRow sx={{ bgcolor: 'action.hover' }}>
              <TableCell>—</TableCell>
              <TableCell><b>IEC — full tariff</b> (stay with the default supplier, no discount)</TableCell>
              <TableCell align="right">{formatNIS(comparison.baseCost)}</TableCell>
              <TableCell align="right" sx={hideSm}>—</TableCell>
              <TableCell align="right">—</TableCell>
              <TableCell align="right" sx={hideSm}>{formatNIS(comparison.baseCost / Math.max(comparison.monthCount, 1))}</TableCell>
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
                          {c.isCheapest && <Chip size="small" color="success" label="Cheapest" />}
                          {bundleIds.has(c.planId) && <Chip size="small" color="warning" variant="outlined" label="Bundle" />}
                        </Stack>
                      )}
                    </Box>
                  </Stack>
                </TableCell>
                <TableCell align="right">{formatNIS(c.totalCost)}</TableCell>
                <TableCell align="right" sx={{ color: 'success.main', ...hideSm }}>{formatNIS(c.savings)}</TableCell>
                <TableCell align="right">{formatPercent(c.savingsPercent)}</TableCell>
                <TableCell align="right" sx={hideSm}>{formatNIS(c.averageMonthlyCost)}</TableCell>
                <TableCell align="right" sx={hideSm}>{formatNIS(c.estimatedYearlyCost)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Monthly charts */}
      <Box sx={gridCharts}>
        <ChartCard title="Monthly bill comparison" subtitle="Cost per month under each plan">
          <MonthlyPlanChart comparison={comparison} metric="cost" />
        </ChartCard>
        <ChartCard title="Monthly savings vs base" subtitle="₪ saved each month">
          <MonthlyPlanChart comparison={comparison} metric="savings" />
        </ChartCard>
      </Box>

      {/* Per-plan breakdown */}
      <ChartCard
        title="Where the bill comes from"
        subtitle="Cost split by pricing rule"
        action={
          <TextField select size="small" label="Plan" value={selected.planId}
            onChange={(e) => setSelectedPlanId(e.target.value)} sx={{ minWidth: 200 }}>
            {comparison.comparisons.map((c) => (
              <MenuItem key={c.planId} value={c.planId}>{c.planName}</MenuItem>
            ))}
          </TextField>
        }
      >
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
          <DistributionPieChart
            data={selected.appliedRules.map((r) => ({ name: r.label, value: r.cost }))}
            unit="₪"
          />
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Rule</TableCell>
                  <TableCell align="right">Discount</TableCell>
                  <TableCell align="right">kWh</TableCell>
                  <TableCell align="right">Cost</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {selected.appliedRules.map((r) => (
                  <TableRow key={r.ruleId}>
                    <TableCell>{r.label}</TableCell>
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
            <Typography variant="h6">What-if simulator</Typography>
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Shift part of your consumption between times of day and see how the optimal plan changes.
          </Typography>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }}>
            <TextField select size="small" label="Shift from" value={fromBucket} onChange={(e) => setFromBucket(e.target.value as Bucket)}>
              <MenuItem value="day">{bucketLabels.day}</MenuItem>
              <MenuItem value="evening">{bucketLabels.evening}</MenuItem>
              <MenuItem value="night">{bucketLabels.night}</MenuItem>
            </TextField>
            <TextField select size="small" label="To" value={toBucket} onChange={(e) => setToBucket(e.target.value as Bucket)}>
              <MenuItem value="day">{bucketLabels.day}</MenuItem>
              <MenuItem value="evening">{bucketLabels.evening}</MenuItem>
              <MenuItem value="night">{bucketLabels.night}</MenuItem>
            </TextField>
            <Box sx={{ minWidth: 220, px: 2 }}>
              <Typography variant="caption">Shift {shiftPct}%</Typography>
              <Slider value={shiftPct} onChange={(_, v) => setShiftPct(v as number)} min={0} max={100} step={5} valueLabelDisplay="auto" />
            </Box>
          </Stack>

          {whatIf?.cheapest && (
            <Alert severity="success" sx={{ mt: 2 }}>
              After shifting {shiftPct}% of {fromBucket} usage to {toBucket}, the best plan would be{' '}
              <b>{whatIf.cheapest.planName}</b> at {formatNIS(whatIf.cheapest.totalCost)} (
              {formatPercent(whatIf.cheapest.savingsPercent)} saved).
              {comparison.cheapest && whatIf.cheapest.planId !== comparison.cheapest.planId
                ? ` That's a change from your current best, ${comparison.cheapest.planName}.`
                : ' (Same plan as today.)'}
            </Alert>
          )}
        </CardContent>
      </Card>
    </Stack>
  );
}

/** `HH:00` label for an hour. */
function hh(h: number): string {
  return `${String(h).padStart(2, '0')}:00`;
}
