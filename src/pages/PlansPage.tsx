import { useState } from 'react';
import {
  Box, Typography, Stack, Button, Card, CardContent, CardActions, IconButton,
  Chip, Divider, Tooltip, FormControlLabel, Switch, Alert,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import LinkIcon from '@mui/icons-material/Link';
import { useApp } from '../state/AppContext';
import PlanEditorDialog from '../components/PlanEditorDialog';
import { makeId, minutesToTime, describeRule, MINUTES_PER_DAY, type TariffPlan, type TariffRule } from '../pricing';
import { formatNIS, formatPercent } from '../utils/format';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const gridPlans = { display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr', xl: 'repeat(3, 1fr)' } };

export default function PlansPage() {
  const { plans, addPlan, updatePlan, deletePlan, resetPlans, comparison, includeBundlePlans, setIncludeBundlePlans } = useApp();
  const [editing, setEditing] = useState<TariffPlan | null>(null);
  const [open, setOpen] = useState(false);

  const openNew = () => { setEditing(null); setOpen(true); };
  const openEdit = (plan: TariffPlan) => { setEditing(plan); setOpen(true); };
  const duplicate = (plan: TariffPlan) => {
    const copy: TariffPlan = {
      ...JSON.parse(JSON.stringify(plan)),
      id: makeId('plan'),
      name: `${plan.name} (copy)`,
      rules: plan.rules.map((r) => ({ ...r, id: makeId('rule') })),
    };
    addPlan(copy);
  };

  const handleSave = (plan: TariffPlan) => {
    if (plans.some((p) => p.id === plan.id)) updatePlan(plan);
    else addPlan(plan);
    setOpen(false);
  };

  const costById = new Map(comparison?.comparisons.map((c) => [c.planId, c]) ?? []);
  const bundleCount = plans.filter((p) => p.bundleOnly).length;
  const visiblePlans = includeBundlePlans ? plans : plans.filter((p) => !p.bundleOnly);

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} spacing={2}>
        <Typography variant="h4">Tariff plans</Typography>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
          <FormControlLabel
            sx={{ mr: 1 }}
            control={<Switch checked={includeBundlePlans} onChange={(e) => setIncludeBundlePlans(e.target.checked)} />}
            label="Show bundle-only"
          />
          <Tooltip title="Reset to the built-in default plans (loads the current supplier plans)">
            <Button color="inherit" startIcon={<RestartAltIcon />} onClick={resetPlans}>Reset</Button>
          </Tooltip>
          <Button variant="contained" startIcon={<AddIcon />} onClick={openNew}>New plan</Button>
        </Stack>
      </Stack>

      {bundleCount > 0 && (
        <Alert severity={includeBundlePlans ? 'info' : 'warning'} icon={<LinkIcon />}>
          {includeBundlePlans
            ? `${bundleCount} plan(s) require a bundle (e.g. a gas subscription) and are included in the comparison.`
            : `${bundleCount} bundle-only plan(s) are hidden and excluded from the comparison and "cheapest" result.`}
        </Alert>
      )}

      <Box sx={gridPlans}>
        {visiblePlans.map((plan) => {
          const result = costById.get(plan.id);
          return (
            <Card key={plan.id} elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderLeft: '4px solid', borderLeftColor: plan.color ?? 'primary.main' }}>
              <CardContent>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                  <Box>
                    <Typography variant="h6">{plan.name}</Typography>
                    {plan.supplier && (
                      <Typography variant="caption" sx={{ color: plan.color ?? 'primary.main', fontWeight: 700, letterSpacing: 0.3 }}>
                        {plan.supplier}
                      </Typography>
                    )}
                    {plan.description && (
                      <Typography variant="body2" color="text.secondary">{plan.description}</Typography>
                    )}
                  </Box>
                  {result?.isCheapest && <Chip color="success" size="small" label="Cheapest" />}
                </Stack>

                {plan.bundleOnly && (
                  <Chip size="small" color="warning" variant="outlined" icon={<LinkIcon />} label="Bundle only" sx={{ mt: 1 }} />
                )}

                {result && (
                  <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
                    <Chip size="small" variant="outlined" label={`${formatNIS(result.totalCost)} total`} />
                    <Chip size="small" variant="outlined" color="success" label={`${formatPercent(result.savingsPercent)} saved`} />
                  </Stack>
                )}

                <Divider sx={{ my: 1.5 }} />
                <Stack spacing={1}>
                  {plan.rules.length === 0 && (
                    <Typography variant="caption" color="text.secondary">No rules — full base price.</Typography>
                  )}
                  {plan.rules.map((rule) => (
                    <Box key={rule.id} sx={{ fontSize: 13 }}>
                      <Chip size="small" label={`${rule.discountPercent}%`} color="primary" sx={{ mr: 1 }} />
                      {rule.label || describeRule(rule)}
                      <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                        {formatDays(rule)} · {formatWindow(rule)}
                      </Typography>
                    </Box>
                  ))}
                </Stack>
              </CardContent>
              <CardActions>
                <Button size="small" startIcon={<EditIcon />} onClick={() => openEdit(plan)}>Edit</Button>
                <IconButton size="small" onClick={() => duplicate(plan)} aria-label="duplicate"><ContentCopyIcon fontSize="small" /></IconButton>
                <Box sx={{ flexGrow: 1 }} />
                <IconButton size="small" color="error" onClick={() => deletePlan(plan.id)} aria-label="delete"><DeleteIcon fontSize="small" /></IconButton>
              </CardActions>
            </Card>
          );
        })}
      </Box>

      <PlanEditorDialog open={open} plan={editing} onClose={() => setOpen(false)} onSave={handleSave} />
    </Stack>
  );
}

function formatDays(rule: TariffRule): string {
  if (rule.daysOfWeek.length === 0 || rule.daysOfWeek.length === 7) return 'Every day';
  return rule.daysOfWeek.map((d) => DAY_LABELS[d]).join(', ');
}
function formatWindow(rule: TariffRule): string {
  const start = minutesToTime(rule.startMinutes === MINUTES_PER_DAY ? 0 : rule.startMinutes);
  const end = minutesToTime(rule.endMinutes >= MINUTES_PER_DAY ? MINUTES_PER_DAY : rule.endMinutes);
  return `${start}–${end}`;
}
