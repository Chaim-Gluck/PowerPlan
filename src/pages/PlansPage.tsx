import { useState } from 'react';
import {
  Box, Typography, Stack, Button, Card, CardContent, CardActions, IconButton,
  Chip, Divider, Tooltip, FormControlLabel, Switch, Alert, Popover, Badge,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import CheckIcon from '@mui/icons-material/Check';
import FilterListIcon from '@mui/icons-material/FilterList';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import LinkIcon from '@mui/icons-material/Link';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { useApp } from '../state/AppContext';
import PlanEditorDialog from '../components/PlanEditorDialog';
import { makeId, minutesToTime, MINUTES_PER_DAY, type TariffPlan, type TariffRule } from '../pricing';
import { WEEKDAY_KEYS } from '../utils/analytics';
import { formatNIS, formatPercent } from '../utils/format';

const gridPlans = { display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr', xl: 'repeat(3, 1fr)' } };

export default function PlansPage() {
  const { t } = useTranslation();
  const { plans, addPlan, updatePlan, deletePlan, resetPlans, comparison, includeBundlePlans, setIncludeBundlePlans } = useApp();
  const [editing, setEditing] = useState<TariffPlan | null>(null);
  const [open, setOpen] = useState(false);
  const [hiddenSuppliers, setHiddenSuppliers] = useState<Set<string>>(new Set());
  const [filterAnchor, setFilterAnchor] = useState<HTMLElement | null>(null);

  const openNew = () => { setEditing(null); setOpen(true); };
  const openEdit = (plan: TariffPlan) => {
    // Show resolved (translated) text in the editor while keeping the i18n keys,
    // so an unedited default stays translatable; editing a field clears its key.
    setEditing({
      ...plan,
      name: plan.nameKey ? t(plan.nameKey) : plan.name,
      supplier: plan.supplierKey ? t(plan.supplierKey) : plan.supplier,
      description: plan.descriptionKey ? t(plan.descriptionKey) : plan.description,
    });
    setOpen(true);
  };
  const duplicate = (plan: TariffPlan) => {
    const copy: TariffPlan = {
      ...JSON.parse(JSON.stringify(plan)),
      id: makeId('plan'),
      name: `${plan.nameKey ? t(plan.nameKey) : plan.name}${t('plans.copy')}`,
      nameKey: undefined, supplierKey: undefined, descriptionKey: undefined,
      supplier: plan.supplierKey ? t(plan.supplierKey) : plan.supplier,
      description: plan.descriptionKey ? t(plan.descriptionKey) : plan.description,
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
  const bundleFiltered = includeBundlePlans ? plans : plans.filter((p) => !p.bundleOnly);

  // Distinct supplier list (order preserved) for the supplier filter. Custom plans
  // without a supplier are grouped under a synthetic "__none__" entry.
  const supplierIdOf = (p: TariffPlan) => p.supplierKey ?? p.supplier ?? '__none__';
  const supplierLabelOf = (p: TariffPlan) =>
    (p.supplierKey ? t(p.supplierKey) : p.supplier) || t('plans.otherSupplier');
  const suppliers: { id: string; label: string }[] = [];
  const seenSuppliers = new Set<string>();
  for (const p of bundleFiltered) {
    const id = supplierIdOf(p);
    if (!seenSuppliers.has(id)) { seenSuppliers.add(id); suppliers.push({ id, label: supplierLabelOf(p) }); }
  }
  const toggleSupplier = (id: string) => setHiddenSuppliers((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const allSuppliersShown = hiddenSuppliers.size === 0;
  const showAllSuppliers = () => setHiddenSuppliers(new Set());
  const hideAllSuppliers = () => setHiddenSuppliers(new Set(suppliers.map((s) => s.id)));

  // A filter is "active" whenever bundle plans are hidden or any supplier is
  // unchecked. The badge/summary use this count and Reset clears everything.
  const bundleFilterActive = bundleCount > 0 && !includeBundlePlans;
  const activeFilterCount = hiddenSuppliers.size + (bundleFilterActive ? 1 : 0);
  const anyFilterApplied = activeFilterCount > 0;
  const resetFilters = () => { setHiddenSuppliers(new Set()); setIncludeBundlePlans(true); };

  const visiblePlans = bundleFiltered.filter((p) => !hiddenSuppliers.has(supplierIdOf(p)));

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} spacing={2}>
        <Typography variant="h4">{t('plans.title')}</Typography>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
          <Badge badgeContent={activeFilterCount} color="primary" overlap="rectangular">
            <Button
              variant="outlined"
              startIcon={<FilterListIcon />}
              onClick={(e) => setFilterAnchor(e.currentTarget)}
            >
              {t('plans.filters')}
            </Button>
          </Badge>
          <Tooltip title={t('plans.resetTip')}>
            <Button color="inherit" startIcon={<RestartAltIcon />} onClick={resetPlans}>{t('plans.reset')}</Button>
          </Tooltip>
          <Button variant="contained" startIcon={<AddIcon />} onClick={openNew}>{t('plans.newPlan')}</Button>
        </Stack>
      </Stack>

      {/* Slim "filters applied" notice — no details, just a way in and a reset. */}
      {anyFilterApplied && (
        <Alert
          severity="info"
          icon={<FilterListIcon fontSize="inherit" />}
          action={<Button color="inherit" size="small" onClick={resetFilters}>{t('plans.resetFilters')}</Button>}
        >
          {t('plans.filtersApplied')}
        </Alert>
      )}

      {bundleFiltered.length > 0 && visiblePlans.length === 0 && (
        <Alert severity="info">{t('plans.noSuppliersSelected')}</Alert>
      )}

      {/* Filters popover: bundle-only, supplier checkboxes, and reset. */}
      <Popover
        open={Boolean(filterAnchor)}
        anchorEl={filterAnchor}
        onClose={() => setFilterAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Box sx={{ p: 2, width: { xs: 280, sm: 340 } }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
            <Typography variant="subtitle1" fontWeight={700}>{t('plans.filters')}</Typography>
            <Typography variant="caption" color="text.secondary">
              {anyFilterApplied ? t('plans.filtersActiveCount', { count: activeFilterCount }) : t('plans.noFiltersActive')}
            </Typography>
          </Stack>

          {bundleCount > 0 && (
            <>
              <FormControlLabel
                control={<Switch checked={includeBundlePlans} onChange={(e) => setIncludeBundlePlans(e.target.checked)} />}
                label={t('plans.showBundle')}
              />
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                {includeBundlePlans
                  ? t('plans.bundleIncluded', { count: bundleCount })
                  : t('plans.bundleHidden', { count: bundleCount })}
              </Typography>
              <Divider sx={{ my: 1.5 }} />
            </>
          )}

          {suppliers.length > 1 && (
            <>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                <Typography variant="body2" color="text.secondary">{t('plans.filterBySupplier')}</Typography>
                <Stack direction="row" spacing={0.5}>
                  <Button size="small" onClick={showAllSuppliers} disabled={allSuppliersShown}>{t('plans.showAllSuppliers')}</Button>
                  <Button size="small" onClick={hideAllSuppliers} disabled={hiddenSuppliers.size === suppliers.length}>{t('plans.hideAllSuppliers')}</Button>
                </Stack>
              </Stack>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {suppliers.map((s) => {
                  const shown = !hiddenSuppliers.has(s.id);
                  return (
                    <Chip
                      key={s.id}
                      label={s.label}
                      clickable
                      onClick={() => toggleSupplier(s.id)}
                      color={shown ? 'primary' : 'default'}
                      variant={shown ? 'filled' : 'outlined'}
                      icon={shown ? <CheckIcon /> : undefined}
                    />
                  );
                })}
              </Box>
            </>
          )}

          <Divider sx={{ my: 1.5 }} />
          <Button fullWidth startIcon={<RestartAltIcon />} onClick={resetFilters} disabled={!anyFilterApplied}>
            {t('plans.resetFilters')}
          </Button>
        </Box>
      </Popover>

      <Box sx={gridPlans}>
        {visiblePlans.map((plan) => {
          const result = costById.get(plan.id);
          return (
            <Card key={plan.id} elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderLeft: '4px solid', borderLeftColor: plan.color ?? 'primary.main' }}>
              <CardContent>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                  <Box>
                    <Typography variant="h6">{plan.nameKey ? t(plan.nameKey) : plan.name}</Typography>
                    {(plan.supplierKey || plan.supplier) && (
                      <Typography variant="caption" sx={{ color: plan.color ?? 'primary.main', fontWeight: 700, letterSpacing: 0.3 }}>
                        {plan.supplierKey ? t(plan.supplierKey) : plan.supplier}
                      </Typography>
                    )}
                    {(plan.descriptionKey || plan.description) && (
                      <Typography variant="body2" color="text.secondary">{plan.descriptionKey ? t(plan.descriptionKey) : plan.description}</Typography>
                    )}
                  </Box>
                  {result?.isCheapest && <Chip color="success" size="small" label={t('plans.cheapest')} />}
                </Stack>

                {plan.bundleOnly && (
                  <Chip size="small" color="warning" variant="outlined" icon={<LinkIcon />} label={t('plans.bundleOnly')} sx={{ mt: 1 }} />
                )}

                {result && (
                  <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
                    <Chip size="small" variant="outlined" label={t('plans.totalChip', { value: formatNIS(result.totalCost) })} />
                    <Chip size="small" variant="outlined" color="success" label={t('plans.savedChip', { percent: formatPercent(result.savingsPercent) })} />
                  </Stack>
                )}

                <Divider sx={{ my: 1.5 }} />
                <Stack spacing={1}>
                  {plan.rules.length === 0 && (
                    <Typography variant="caption" color="text.secondary">{t('plans.noRules')}</Typography>
                  )}
                  {plan.rules.map((rule) => (
                    <Box key={rule.id} sx={{ fontSize: 13 }}>
                      <Chip size="small" label={`${rule.discountPercent}%`} color="primary" sx={{ mr: 1 }} />
                      {rule.label || `${rule.discountPercent}% • ${formatDays(rule, t)}`}
                      <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                        {formatDays(rule, t)} · {formatWindow(rule)}
                      </Typography>
                    </Box>
                  ))}
                </Stack>
              </CardContent>
              <CardActions>
                <Button size="small" startIcon={<EditIcon />} onClick={() => openEdit(plan)}>{t('plans.edit')}</Button>
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

function formatDays(rule: TariffRule, t: TFunction): string {
  if (rule.daysOfWeek.length === 0 || rule.daysOfWeek.length === 7) return t('plans.everyDay');
  return rule.daysOfWeek.map((d) => t(`charts.weekday.${WEEKDAY_KEYS[d]}`)).join(', ');
}
function formatWindow(rule: TariffRule): string {
  const start = minutesToTime(rule.startMinutes === MINUTES_PER_DAY ? 0 : rule.startMinutes);
  const end = minutesToTime(rule.endMinutes >= MINUTES_PER_DAY ? MINUTES_PER_DAY : rule.endMinutes);
  return `${start}–${end}`;
}
