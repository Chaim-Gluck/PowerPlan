import { Stack, ToggleButton, ToggleButtonGroup, Button, Box } from '@mui/material';
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

  return (
    <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }} sx={{ mb: 1 }}>
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
