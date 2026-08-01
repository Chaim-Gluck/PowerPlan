import { useMemo, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Stack,
  ToggleButton, ToggleButtonGroup, IconButton, Typography, Alert, Box, Divider, MenuItem,
  FormControlLabel, Checkbox,
} from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import AddIcon from '@mui/icons-material/Add';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import {
  makeId, minutesToTime, timeToMinutes, timeInWindow, MINUTES_PER_DAY,
  type TariffPlan, type TariffRule,
} from '../pricing';
import { WEEKDAY_KEYS } from '../utils/analytics';
import { SERIES_COLORS } from '../theme/theme';

interface Props {
  open: boolean;
  plan: TariffPlan | null;
  onClose: () => void;
  onSave: (plan: TariffPlan) => void;
}

/** Modal editor for creating / editing a tariff plan and its rules. */
export default function PlanEditorDialog({ open, plan, onClose, onSave }: Props) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<TariffPlan>(() => cloneOrNew(plan));

  // Re-seed the draft whenever a different plan is opened.
  const seedKey = plan?.id ?? 'new';
  const [lastSeed, setLastSeed] = useState(seedKey);
  if (open && lastSeed !== seedKey) {
    setDraft(cloneOrNew(plan));
    setLastSeed(seedKey);
  }

  const warnings = useMemo(() => validatePlan(draft, t), [draft, t]);
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
      <DialogTitle>{plan ? t('editor.editTitle') : t('editor.newTitle')}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label={t('editor.name')}
              value={draft.name}
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value, nameKey: undefined }))}
              fullWidth
              error={!draft.name.trim()}
              helperText={!draft.name.trim() ? t('editor.nameRequired') : ' '}
            />
            <TextField
              label={t('editor.supplier')}
              value={draft.supplier ?? ''}
              onChange={(e) => setDraft((d) => ({ ...d, supplier: e.target.value, supplierKey: undefined }))}
              fullWidth
              placeholder={t('editor.supplierPlaceholder')}
              helperText=" "
            />
            <TextField
              select label={t('editor.color')} value={draft.color ?? SERIES_COLORS[0]}
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
            label={t('editor.description')}
            value={draft.description ?? ''}
            onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value, descriptionKey: undefined }))}
            fullWidth multiline minRows={1}
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={!!draft.bundleOnly}
                onChange={(e) => setDraft((d) => ({ ...d, bundleOnly: e.target.checked }))}
              />
            }
            label={t('editor.bundleOnly')}
          />

          <Divider textAlign="left">
            <Typography variant="overline">{t('editor.rules')}</Typography>
          </Divider>

          {warnings.map((w, i) => (
            <Alert key={i} severity={w.severity}>{w.message}</Alert>
          ))}

          {draft.rules.map((rule) => (
            <Box key={rule.id} sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
              <Stack spacing={1.5}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <TextField
                    label={t('editor.ruleLabel')} size="small" variant="standard"
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
                  {WEEKDAY_KEYS.map((key, i) => (
                    <ToggleButton key={i} value={i}>{t(`charts.weekday.${key}`)}</ToggleButton>
                  ))}
                </ToggleButtonGroup>

                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                  <TextField
                    label={t('editor.start')} type="time" size="small"
                    value={minutesToTime(rule.startMinutes === MINUTES_PER_DAY ? 0 : rule.startMinutes)}
                    onChange={(e) => updateRule(rule.id, { startMinutes: timeToMinutes(e.target.value) })}
                    InputLabelProps={{ shrink: true }} inputProps={{ step: 900 }}
                  />
                  <TextField
                    label={t('editor.end')} type="time" size="small"
                    value={minutesToTime(rule.endMinutes >= MINUTES_PER_DAY ? 0 : rule.endMinutes)}
                    onChange={(e) => {
                      const v = timeToMinutes(e.target.value);
                      updateRule(rule.id, { endMinutes: v === 0 ? MINUTES_PER_DAY : v });
                    }}
                    InputLabelProps={{ shrink: true }} inputProps={{ step: 900 }}
                    helperText={t('editor.endHelp')}
                  />
                  <TextField
                    label={t('editor.discount')} type="number" size="small"
                    value={rule.discountPercent}
                    onChange={(e) => updateRule(rule.id, { discountPercent: Number(e.target.value) })}
                    error={rule.discountPercent < 0 || rule.discountPercent > 100}
                    inputProps={{ min: 0, max: 100, step: 0.5 }}
                  />
                </Stack>
                <Typography variant="caption" color="text.secondary">
                  {rule.endMinutes <= rule.startMinutes && rule.endMinutes !== MINUTES_PER_DAY
                    ? t('editor.overnight')
                    : ' '}
                </Typography>
              </Stack>
            </Box>
          ))}

          <Button startIcon={<AddIcon />} onClick={addRule} variant="outlined">
            {t('editor.addRule')}
          </Button>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('editor.cancel')}</Button>
        <Button
          variant="contained"
          disabled={hasErrors || !draft.name.trim()}
          onClick={() => onSave(draft)}
        >
          {t('editor.savePlan')}
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
function validatePlan(plan: TariffPlan, t: TFunction): Warning[] {
  const out: Warning[] = [];
  if (plan.rules.length === 0) {
    out.push({ severity: 'warning', message: t('editor.warnNoRules') });
  }
  for (const r of plan.rules) {
    if (r.discountPercent < 0 || r.discountPercent > 100) {
      out.push({ severity: 'error', message: t('editor.warnInvalidDiscount', { percent: r.discountPercent }) });
    }
    if (r.daysOfWeek.length === 0) {
      out.push({ severity: 'warning', message: t('editor.warnNoDays') });
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
          message: t('editor.warnOverlap', {
            a: a.label || t('editor.ruleN', { n: i + 1 }),
            b: b.label || t('editor.ruleN', { n: j + 1 }),
          }),
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
