import { Stack, ToggleButton, ToggleButtonGroup, Button, Box } from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import dayjs from 'dayjs';
import { useApp } from '../state/AppContext';

/** Date-range + weekday/weekend filter bar (bonus feature). */
export default function FiltersBar() {
  const { dateRange, setDateRange, filterMode, setFilterMode, allRecords } = useApp();

  if (allRecords.length === 0) return null;
  const min = dayjs(allRecords[0].tsMs);
  const max = dayjs(allRecords[allRecords.length - 1].tsMs);

  return (
    <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }} sx={{ mb: 1 }}>
      <DatePicker
        label="From" value={dateRange[0]} minDate={min} maxDate={max}
        format="DD/MM/YYYY"
        onChange={(v) => setDateRange([v, dateRange[1]])}
        slotProps={{ textField: { size: 'small' } }}
      />
      <DatePicker
        label="To" value={dateRange[1]} minDate={min} maxDate={max}
        format="DD/MM/YYYY"
        onChange={(v) => setDateRange([dateRange[0], v])}
        slotProps={{ textField: { size: 'small' } }}
      />
      <ToggleButtonGroup
        size="small" exclusive value={filterMode}
        onChange={(_, v) => v && setFilterMode(v)}
      >
        <ToggleButton value="all">All days</ToggleButton>
        <ToggleButton value="weekday">Weekdays</ToggleButton>
        <ToggleButton value="weekend">Weekend</ToggleButton>
      </ToggleButtonGroup>
      <Box sx={{ flexGrow: 1 }} />
      <Button
        size="small" startIcon={<RestartAltIcon />}
        onClick={() => { setDateRange([null, null]); setFilterMode('all'); }}
      >
        Reset filters
      </Button>
    </Stack>
  );
}
