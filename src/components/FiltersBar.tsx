import { Stack, ToggleButton, ToggleButtonGroup, Button, ButtonGroup, Box } from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import { useApp } from '../state/AppContext';

/** Date-range + weekday/weekend filter bar (bonus feature). */
export default function FiltersBar() {
  const { t } = useTranslation();
  const { dateRange, setDateRange, filterMode, setFilterMode, allRecords } = useApp();

  if (allRecords.length === 0) return null;
  const min = dayjs(allRecords[0].tsMs);
  const max = dayjs(allRecords[allRecords.length - 1].tsMs);

  // Quick presets are anchored to the latest record (data is historical), and the
  // start is clamped to the earliest record so we never point before the data.
  const applyPreset = (preset: '3m' | '6m' | '1y' | 'ytd' | 'all') => {
    if (preset === 'all') { setDateRange([null, null]); return; }
    let from =
      preset === 'ytd' ? max.startOf('year')
      : preset === '1y' ? max.subtract(1, 'year')
      : preset === '6m' ? max.subtract(6, 'month')
      : max.subtract(3, 'month');
    if (from.isBefore(min)) from = min;
    setDateRange([from, max]);
  };

  return (
    <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }} sx={{ mb: 1 }} flexWrap="wrap" useFlexGap>
      <DatePicker
        label={t('filters.from')} value={dateRange[0]} minDate={min} maxDate={max}
        format="DD/MM/YYYY"
        onChange={(v) => setDateRange([v, dateRange[1]])}
        slotProps={{ textField: { size: 'small' } }}
      />
      <DatePicker
        label={t('filters.to')} value={dateRange[1]} minDate={min} maxDate={max}
        format="DD/MM/YYYY"
        onChange={(v) => setDateRange([dateRange[0], v])}
        slotProps={{ textField: { size: 'small' } }}
      />
      <ButtonGroup size="small" variant="outlined" sx={{ flexWrap: 'wrap' }}>
        <Button onClick={() => applyPreset('3m')}>{t('filters.preset.3m')}</Button>
        <Button onClick={() => applyPreset('6m')}>{t('filters.preset.6m')}</Button>
        <Button onClick={() => applyPreset('1y')}>{t('filters.preset.1y')}</Button>
        <Button onClick={() => applyPreset('ytd')}>{t('filters.preset.ytd')}</Button>
        <Button onClick={() => applyPreset('all')}>{t('filters.preset.all')}</Button>
      </ButtonGroup>
      <ToggleButtonGroup
        size="small" exclusive value={filterMode}
        onChange={(_, v) => v && setFilterMode(v)}
      >
        <ToggleButton value="all">{t('filters.allDays')}</ToggleButton>
        <ToggleButton value="weekday">{t('filters.weekdays')}</ToggleButton>
        <ToggleButton value="weekend">{t('filters.weekend')}</ToggleButton>
      </ToggleButtonGroup>
      <Box sx={{ flexGrow: 1 }} />
      <Button
        size="small" startIcon={<RestartAltIcon />}
        onClick={() => { setDateRange([null, null]); setFilterMode('all'); }}
      >
        {t('filters.reset')}
      </Button>
    </Stack>
  );
}
