import { useMemo, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Stack,
  ToggleButton, ToggleButtonGroup, IconButton, Typography, Alert, Box, Divider, MenuItem,
  FormControlLabel, Checkbox,
} from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import AddIcon from '@mui/icons-material/Add';
import {
  makeId, minutesToTime, timeToMinutes, timeInWindow, MINUTES_PER_DAY,
  type TariffPlan, type TariffRule,
} from '../pricing';
import { SERIES_COLORS } from '../theme/theme';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface Props {
  open: boolean;
  plan: TariffPlan | null;
  onClose: () => void;
  onSave: (plan: TariffPlan) => void;
}

/** Modal editor for creating / editing a tariff plan and its rules. */
export default function PlanEditorDialog({ open, plan, onClose, onSave }: Props) {
  const [draft, setDraft] = useState<TariffPlan>(() => cloneOrNew(plan));

  // Re-seed the draft whenever a different plan is opened.
  const seedKey = plan?.id ?? 'new';
  const [lastSeed, setLastSeed] = useState(seedKey);
  if (open && lastSeed !== seedKey) {
    setDraft(cloneOrNew(plan));
    setLastSeed(seedKey);
  }

  const warnings = useMemo(() => validatePlan(draft), [draft]);
  const hasErrors = warnings.some((w) => w.severity === 'error');

  const updateRule = (id: string, patch: Partial<TariffRule>) => {
    setDraft((d) => ({ ...d, rules: d.rules.map((r) => (r.id === id ? { ...r, ...patch } : r)) }));
  };
  const addRule = () => {
    setDraft((d) => ({
      ...d,
      rules: [
        ...d.rules,
        { id: makeId('rule'), daysOfWeek: [0, 1, 2, 3, 4, 5, 6], startMinutes: 0, endMinutes: MINUTES_PER_DAY, discountPercent: 10 },
      ],
    }));
  };
  const deleteRule = (id: string) => setDraft((d) => ({ ...d, rules: d.rules.filter((r) => r.id !== id) }));

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{plan ? 'Edit plan' : 'New plan'}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="Plan name"
              value={draft.name}
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
              fullWidth
              error={!draft.name.trim()}
              helperText={!draft.name.trim() ? 'Name is required' : ' '}
            />
            <TextField
              label="Supplier"
              value={draft.supplier ?? ''}
              onChange={(e) => setDraft((d) => ({ ...d, supplier: e.target.value }))}
              fullWidth
              placeholder="e.g. Electra Power"
              helperText=" "
            />
            <TextField
              select label="Color" value={draft.color ?? SERIES_COLORS[0]}
              onChange={(e) => setDraft((d) => ({ ...d, color: e.target.value }))}
              sx={{ minWidth: 140 }}
            >
              {SERIES_COLORS.map((c) => (
                <MenuItem key={c} value={c}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ width: 14, height: 14, borderRadius: '50%', bgcolor: c }} /> {c}
                  </Box>
                </MenuItem>
              ))}
            </TextField>
          </Stack>
          <TextField
            label="Description (optional)"
            value={draft.description ?? ''}
            onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
            fullWidth multiline minRows={1}
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={!!draft.bundleOnly}
                onChange={(e) => setDraft((d) => ({ ...d, bundleOnly: e.target.checked }))}
              />
            }
            label="Only available as a bundle (e.g. requires a gas subscription)"
          />

          <Divider textAlign="left">
            <Typography variant="overline">Pricing rules</Typography>
          </Divider>

          {warnings.map((w, i) => (
            <Alert key={i} severity={w.severity}>{w.message}</Alert>
          ))}

          {draft.rules.map((rule) => (
            <Box key={rule.id} sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
              <Stack spacing={1.5}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <TextField
                    label="Rule label (optional)" size="small" variant="standard"
                    value={rule.label ?? ''}
                    onChange={(e) => updateRule(rule.id, { label: e.target.value })}
                    sx={{ flexGrow: 1, mr: 2 }}
                  />
                  <IconButton color="error" onClick={() => deleteRule(rule.id)} aria-label="delete rule">
                    <DeleteOutlineIcon />
                  </IconButton>
                </Stack>

                <ToggleButtonGroup
                  size="small" value={rule.daysOfWeek}
                  onChange={(_, days: number[]) => updateRule(rule.id, { daysOfWeek: days })}
                  aria-label="days of week"
                >
                  {DAY_LABELS.map((label, i) => (
                    <ToggleButton key={i} value={i}>{label}</ToggleButton>
                  ))}
                </ToggleButtonGroup>

                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                  <TextField
                    label="Start" type="time" size="small"
                    value={minutesToTime(rule.startMinutes === MINUTES_PER_DAY ? 0 : rule.startMinutes)}
                    onChange={(e) => updateRule(rule.id, { startMinutes: timeToMinutes(e.target.value) })}
                    InputLabelProps={{ shrink: true }} inputProps={{ step: 900 }}
                  />
                  <TextField
                    label="End" type="time" size="small"
                    value={minutesToTime(rule.endMinutes >= MINUTES_PER_DAY ? 0 : rule.endMinutes)}
                    onChange={(e) => {
                      const v = timeToMinutes(e.target.value);
                      updateRule(rule.id, { endMinutes: v === 0 ? MINUTES_PER_DAY : v });
                    }}
                    InputLabelProps={{ shrink: true }} inputProps={{ step: 900 }}
                    helperText="00:00 as end = midnight (24:00)"
                  />
                  <TextField
                    label="Discount %" type="number" size="small"
                    value={rule.discountPercent}
                    onChange={(e) => updateRule(rule.id, { discountPercent: Number(e.target.value) })}
                    error={rule.discountPercent < 0 || rule.discountPercent > 100}
                    inputProps={{ min: 0, max: 100, step: 0.5 }}
                  />
                </Stack>
                <Typography variant="caption" color="text.secondary">
                  {rule.endMinutes <= rule.startMinutes && rule.endMinutes !== MINUTES_PER_DAY
                    ? 'Overnight window (wraps past midnight).'
                    : ' '}
                </Typography>
              </Stack>
            </Box>
          ))}

          <Button startIcon={<AddIcon />} onClick={addRule} variant="outlined">
            Add rule
          </Button>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          disabled={hasErrors || !draft.name.trim()}
          onClick={() => onSave(draft)}
        >
          Save plan
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function cloneOrNew(plan: TariffPlan | null): TariffPlan {
  if (plan) return JSON.parse(JSON.stringify(plan)) as TariffPlan;
  return {
    id: makeId('plan'),
    name: '',
    description: '',
    color: SERIES_COLORS[Math.floor(Math.random() * SERIES_COLORS.length)],
    rules: [
      { id: makeId('rule'), daysOfWeek: [0, 1, 2, 3, 4, 5, 6], startMinutes: 0, endMinutes: MINUTES_PER_DAY, discountPercent: 7 },
    ],
  };
}

interface Warning {
  severity: 'error' | 'warning';
  message: string;
}

/** Validate discounts and detect ambiguous / overlapping rules. */
function validatePlan(plan: TariffPlan): Warning[] {
  const out: Warning[] = [];
  if (plan.rules.length === 0) {
    out.push({ severity: 'warning', message: 'This plan has no rules — every interval will be charged at the full base price.' });
  }
  for (const r of plan.rules) {
    if (r.discountPercent < 0 || r.discountPercent > 100) {
      out.push({ severity: 'error', message: `A rule has an invalid discount (${r.discountPercent}%). Must be between 0 and 100.` });
    }
    if (r.daysOfWeek.length === 0) {
      out.push({ severity: 'warning', message: 'A rule has no days selected and will never apply. Select at least one day.' });
    }
  }
  // Overlap detection: same day + overlapping time window with different discount.
  for (let i = 0; i < plan.rules.length; i++) {
    for (let j = i + 1; j < plan.rules.length; j++) {
      const a = plan.rules[i];
      const b = plan.rules[j];
      const sharedDay = a.daysOfWeek.some((d) => b.daysOfWeek.includes(d));
      if (sharedDay && windowsOverlap(a, b) && a.discountPercent !== b.discountPercent) {
        out.push({
          severity: 'warning',
          message: `Rules "${a.label || 'rule ' + (i + 1)}" and "${b.label || 'rule ' + (j + 1)}" overlap in time — the more specific (narrower) rule will win.`,
        });
      }
    }
  }
  return out;
}

/** Approximate overlap test by sampling the day at 15-minute resolution. */
function windowsOverlap(a: TariffRule, b: TariffRule): boolean {
  for (let m = 0; m < MINUTES_PER_DAY; m += 15) {
    if (timeInWindow(m, a.startMinutes, a.endMinutes) && timeInWindow(m, b.startMinutes, b.endMinutes)) {
      return true;
    }
  }
  return false;
}
