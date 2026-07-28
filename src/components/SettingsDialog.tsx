import { useMemo, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Stack, TextField,
  MenuItem, InputAdornment, Alert, Typography, Divider, Box,
} from '@mui/material';
import { useApp } from '../state/AppContext';
import type { TimeBoundaries } from '../utils/analytics';

interface Props {
  open: boolean;
  onClose: () => void;
}

const hh = (h: number) => `${String(h).padStart(2, '0')}:00`;
const HOURS = Array.from({ length: 24 }, (_, h) => h);

/**
 * Settings dialog: base electricity price + the day/evening/night boundaries
 * that drive the distribution charts, insights and what-if simulator.
 * These boundaries are cosmetic — they never affect bill calculations, which
 * always use each plan's own rule time-windows.
 */
export default function SettingsDialog({ open, onClose }: Props) {
  const { basePrice, setBasePrice, timeBoundaries, setTimeBoundaries } = useApp();

  const [price, setPrice] = useState(basePrice);
  const [b, setB] = useState<TimeBoundaries>(timeBoundaries);

  // Re-seed local draft when the dialog is (re)opened.
  const [wasOpen, setWasOpen] = useState(false);
  if (open && !wasOpen) {
    setPrice(basePrice);
    setB(timeBoundaries);
    setWasOpen(true);
  } else if (!open && wasOpen) {
    setWasOpen(false);
  }

  const error = useMemo(() => {
    if (!(b.dayStart < b.eveningStart && b.eveningStart < b.nightStart)) {
      return 'Hours must be increasing: day start < evening start < night start.';
    }
    if (price < 0) return 'Base price cannot be negative.';
    return null;
  }, [b, price]);

  const save = () => {
    if (error) return;
    setBasePrice(price);
    setTimeBoundaries(b);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Settings</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={3}>
          <Box>
            <Typography variant="overline" color="text.secondary">Base electricity price</Typography>
            <TextField
              type="number" fullWidth size="small" sx={{ mt: 1 }} value={price}
              onChange={(e) => setPrice(Number(e.target.value))}
              inputProps={{ step: 0.0001, min: 0 }}
              InputProps={{ endAdornment: <InputAdornment position="end">₪/kWh</InputAdornment> }}
              helperText="All plan prices are derived from this base per-kWh price."
            />
          </Box>

          <Divider />

          <Box>
            <Typography variant="overline" color="text.secondary">Day / evening / night boundaries</Typography>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1.5 }}>
              Used only for the distribution charts, insights and what-if simulator — they never change any bill calculation.
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                select size="small" fullWidth label="Day starts at" value={b.dayStart}
                onChange={(e) => setB({ ...b, dayStart: Number(e.target.value) })}
              >
                {HOURS.map((h) => <MenuItem key={h} value={h}>{hh(h)}</MenuItem>)}
              </TextField>
              <TextField
                select size="small" fullWidth label="Evening starts at" value={b.eveningStart}
                onChange={(e) => setB({ ...b, eveningStart: Number(e.target.value) })}
              >
                {HOURS.map((h) => <MenuItem key={h} value={h}>{hh(h)}</MenuItem>)}
              </TextField>
              <TextField
                select size="small" fullWidth label="Night starts at" value={b.nightStart}
                onChange={(e) => setB({ ...b, nightStart: Number(e.target.value) })}
              >
                {HOURS.map((h) => <MenuItem key={h} value={h}>{hh(h)}</MenuItem>)}
              </TextField>
            </Stack>
            {!error && (
              <Alert severity="info" sx={{ mt: 2 }}>
                Day {hh(b.dayStart)}–{hh(b.eveningStart)} · Evening {hh(b.eveningStart)}–{hh(b.nightStart)} · Night {hh(b.nightStart)}–{hh(b.dayStart)}
              </Alert>
            )}
          </Box>

          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" disabled={!!error} onClick={save}>Save</Button>
      </DialogActions>
    </Dialog>
  );
}
