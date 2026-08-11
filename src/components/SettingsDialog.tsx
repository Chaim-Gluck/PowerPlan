import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Stack, TextField,
  MenuItem, InputAdornment, Alert, Typography, Divider, Box,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useApp } from '../state/AppContext';
import type { TimeBoundaries } from '../utils/analytics';
import { LANGUAGES, type Language } from '../i18n/config';

interface Props {
  open: boolean;
  onClose: () => void;
  /** When 'price', open with the base-price field focused and highlighted. */
  focus?: 'price';
}

const hh = (h: number) => `${String(h).padStart(2, '0')}:00`;
const HOURS = Array.from({ length: 24 }, (_, h) => h);

/**
 * Settings dialog: UI language, base electricity price, and the day/evening/night
 * boundaries that drive the distribution charts, insights and what-if simulator.
 * Those boundaries are cosmetic — they never affect bill calculations, which
 * always use each plan's own rule time-windows.
 */
export default function SettingsDialog({ open, onClose, focus }: Props) {
  const { t } = useTranslation();
  const { basePrice, setBasePrice, timeBoundaries, setTimeBoundaries, language, setLanguage } = useApp();

  const [price, setPrice] = useState(basePrice);
  const [b, setB] = useState<TimeBoundaries>(timeBoundaries);
  const [lang, setLang] = useState<Language>(language);
  const priceRef = useRef<HTMLInputElement>(null);
  const [highlightPrice, setHighlightPrice] = useState(false);

  // Re-seed local draft when the dialog is (re)opened.
  const [wasOpen, setWasOpen] = useState(false);
  if (open && !wasOpen) {
    setPrice(basePrice);
    setB(timeBoundaries);
    setLang(language);
    setWasOpen(true);
  } else if (!open && wasOpen) {
    setWasOpen(false);
  }

  // When opened via the Dashboard pencil, focus + highlight the price field.
  useEffect(() => {
    if (open && focus === 'price') {
      setHighlightPrice(true);
      const f = setTimeout(() => { priceRef.current?.focus(); priceRef.current?.select(); }, 150);
      const h = setTimeout(() => setHighlightPrice(false), 1800);
      return () => { clearTimeout(f); clearTimeout(h); };
    }
    setHighlightPrice(false);
    return undefined;
  }, [open, focus]);

  const error = useMemo(() => {
    if (!(b.dayStart < b.eveningStart && b.eveningStart < b.nightStart)) {
      return t('settings.orderError');
    }
    if (price < 0) return t('settings.priceError');
    return null;
  }, [b, price, t]);

  const save = () => {
    if (error) return;
    setBasePrice(price);
    setTimeBoundaries(b);
    setLanguage(lang);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{t('settings.title')}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={3}>
          {/* Language selector — applied when you press Save. */}
          <TextField
            select fullWidth size="small" label={t('settings.language')} value={lang}
            onChange={(e) => setLang(e.target.value as Language)}
          >
            {(Object.keys(LANGUAGES) as Language[]).map((lng) => (
              <MenuItem key={lng} value={lng}>{LANGUAGES[lng]}</MenuItem>
            ))}
          </TextField>

          <Divider />

          <Box>
            <Typography variant="overline" color="text.secondary">{t('settings.basePriceSection')}</Typography>
            <TextField
              type="number" fullWidth size="small" sx={{ mt: 1 }} value={price}
              inputRef={priceRef}
              onChange={(e) => setPrice(Number(e.target.value))}
              inputProps={{ step: 0.0001, min: 0 }}
              InputProps={{
                endAdornment: <InputAdornment position="end">{t('settings.perKwh')}</InputAdornment>,
                sx: highlightPrice ? { boxShadow: (th) => `0 0 0 2px ${th.palette.primary.main}`, transition: 'box-shadow .3s' } : { transition: 'box-shadow .3s' },
              }}
              helperText={t('settings.basePriceHelp')}
            />
          </Box>

          <Divider />

          <Box>
            <Typography variant="overline" color="text.secondary">{t('settings.boundariesSection')}</Typography>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1.5 }}>
              {t('settings.boundariesHelp')}
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                select size="small" fullWidth label={t('settings.dayStart')} value={b.dayStart}
                onChange={(e) => setB({ ...b, dayStart: Number(e.target.value) })}
              >
                {HOURS.map((h) => <MenuItem key={h} value={h}>{hh(h)}</MenuItem>)}
              </TextField>
              <TextField
                select size="small" fullWidth label={t('settings.eveningStart')} value={b.eveningStart}
                onChange={(e) => setB({ ...b, eveningStart: Number(e.target.value) })}
              >
                {HOURS.map((h) => <MenuItem key={h} value={h}>{hh(h)}</MenuItem>)}
              </TextField>
              <TextField
                select size="small" fullWidth label={t('settings.nightStart')} value={b.nightStart}
                onChange={(e) => setB({ ...b, nightStart: Number(e.target.value) })}
              >
                {HOURS.map((h) => <MenuItem key={h} value={h}>{hh(h)}</MenuItem>)}
              </TextField>
            </Stack>
            {!error && (
              <Alert severity="info" sx={{ mt: 2 }}>
                {t('settings.rangeSummary', {
                  day: hh(b.dayStart), evening: hh(b.eveningStart), night: hh(b.nightStart),
                })}
              </Alert>
            )}
          </Box>

          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('settings.cancel')}</Button>
        <Button variant="contained" disabled={!!error} onClick={save}>{t('settings.save')}</Button>
      </DialogActions>
    </Dialog>
  );
}
