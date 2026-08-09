import { useRef, useState } from 'react';
import {
  Button, Card, CardContent, Typography, Stack, Alert, Chip, LinearProgress,
  Table, TableBody, TableCell, TableHead, TableRow, TableContainer, Link,
  Accordion, AccordionSummary, AccordionDetails, Step, Stepper, StepLabel, StepContent, Box,
} from '@mui/material';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import ScienceIcon from '@mui/icons-material/Science';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import { useTranslation } from 'react-i18next';
import { useApp } from '../state/AppContext';
import { importFile, importCsvText, type ImportResult } from '../utils/dataImport';
import { formatKWh, formatNumber } from '../utils/format';

const IEC_URL = 'https://www.iec.co.il/consumption-info-menu/remote-reading-info';

export default function ImportPage() {
  const { t } = useTranslation();
  const { setData, clearData, summary, fileName, intervalMinutes, rawRecords } = useApp();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<ImportResult | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const guideSteps = [1, 2, 3, 4, 5, 6].map((n) => ({
    label: t(`import.guide.step${n}Label`),
    detail: t(`import.guide.step${n}Detail`),
    note: t(`import.guide.step${n}Note`, { defaultValue: '' }),
  }));

  const handleFile = async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      const result = await importFile(file);
      if (result.records.length === 0) { setError(t('import.noRecords')); return; }
      setData(result.records, result.intervalMinutes, file.name);
      setLastResult(result);
    } catch {
      setError(t('import.importFailed'));
    } finally {
      setBusy(false);
    }
  };

  const loadSample = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}sample-data.csv`);
      const text = await res.text();
      const result = importCsvText(text);
      setData(result.records, result.intervalMinutes, 'sample-data.csv');
      setLastResult(result);
    } catch {
      setError(t('import.sampleFailed'));
    } finally {
      setBusy(false);
    }
  };

  const intervalLabel =
    intervalMinutes === 15 ? t('import.interval.quarter')
      : intervalMinutes === 30 ? t('import.interval.half')
      : intervalMinutes === 60 ? t('import.interval.hourly')
      : t('import.interval.other', { minutes: intervalMinutes });

  return (
    <Stack spacing={3}>
      <Typography variant="h4">{t('import.title')}</Typography>

      <Card
        elevation={0}
        sx={{
          border: '2px dashed',
          borderColor: dragOver ? 'primary.main' : 'divider',
          bgcolor: dragOver ? 'action.hover' : 'transparent',
          transition: 'all .15s',
        }}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files?.[0]) handleFile(e.dataTransfer.files[0]);
        }}
      >
        <CardContent sx={{ textAlign: 'center', py: 6 }}>
          <UploadFileIcon sx={{ fontSize: 48, color: 'primary.main', mb: 1 }} />
          <Typography variant="h6">{t('import.dropTitle')}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {t('import.dropSub')}
          </Typography>
          <input
            ref={inputRef} type="file" accept=".csv,.xlsx,.xls" hidden
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
          <Stack direction="row" spacing={2} justifyContent="center" sx={{ mt: 1 }}>
            <Button variant="contained" startIcon={<UploadFileIcon />} onClick={() => inputRef.current?.click()}>
              {t('import.chooseFile')}
            </Button>
            <Button variant="outlined" startIcon={<ScienceIcon />} onClick={loadSample}>
              {t('import.loadSample')}
            </Button>
          </Stack>
        </CardContent>
      </Card>

      {busy && <LinearProgress />}
      {error && <Alert severity="error">{error}</Alert>}

      <Alert severity="success" icon={<LockOutlinedIcon fontSize="inherit" />} variant="outlined">
        {t('import.privacy')}
      </Alert>

      {lastResult && lastResult.warnings.map((w, i) => (
        <Alert key={i} severity="info">{w}</Alert>
      ))}

      <Alert severity="info" icon={<HelpOutlineIcon />}>
        <Stack spacing={1.5}>
          <Typography variant="body2">{t('import.guide.intro')}</Typography>
          <Box>
            <Button
              variant="contained" size="small" startIcon={<OpenInNewIcon />}
              onClick={() => window.open(IEC_URL, '_blank', 'noopener,noreferrer')}
            >
              {t('import.guide.openPortal')}
            </Button>
          </Box>
          <Alert severity="warning" icon={<WarningAmberIcon />} sx={{ py: 0.5 }}>
            <Typography variant="caption" fontWeight={700} display="block">{t('import.guide.tipTitle')}</Typography>
            <Typography variant="caption" component="div" sx={{ mt: 0.25 }}>• {t('import.guide.tip1')}</Typography>
            <Typography variant="caption" component="div" sx={{ mt: 0.25 }}>• {t('import.guide.tip2')}</Typography>
          </Alert>
          <Accordion elevation={0} disableGutters sx={{ bgcolor: 'transparent', '&:before': { display: 'none' } }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ px: 0, minHeight: 0 }}>
              <Typography variant="body2" fontWeight={600}>{t('import.guide.steps')}</Typography>
            </AccordionSummary>
            <AccordionDetails sx={{ px: 0 }}>
              <Stepper orientation="vertical" nonLinear>
                {guideSteps.map((s, i) => (
                  <Step key={i} active expanded>
                    <StepLabel>{s.label}</StepLabel>
                    <StepContent>
                      <Typography variant="caption" color="text.secondary">{s.detail}</Typography>
                      {s.note && (
                        <Typography variant="caption" fontWeight={700} display="block" sx={{ mt: 0.5 }}>{s.note}</Typography>
                      )}
                    </StepContent>
                  </Step>
                ))}
              </Stepper>
              <Typography variant="caption" color="text.secondary">
                {t('import.guide.directLink')}{' '}
                <Link href={IEC_URL} target="_blank" rel="noopener">{IEC_URL}</Link>
              </Typography>
            </AccordionDetails>
          </Accordion>
        </Stack>
      </Alert>

      {rawRecords.length > 0 && (
        <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
          <CardContent>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
              <Typography variant="h6">{t('import.dataset.title')}</Typography>
              <Button color="error" startIcon={<DeleteSweepIcon />} onClick={clearData}>
                {t('import.dataset.clear')}
              </Button>
            </Stack>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
              <Chip label={fileName ?? t('import.dataset.dataset')} color="primary" variant="outlined" />
              <Chip label={intervalLabel} />
              {lastResult && <Chip label={t('import.dataset.format', { format: lastResult.format.toUpperCase() })} />}
              {lastResult?.hasBilledCost && <Chip color="success" label={t('import.dataset.includesBilled')} />}
            </Stack>
            <TableContainer sx={{ overflowX: 'auto' }}>
              <Table size="small" sx={{ minWidth: 440 }}>
                <TableHead>
                  <TableRow>
                    <TableCell>{t('import.dataset.records')}</TableCell>
                    <TableCell>{t('import.dataset.totalConsumption')}</TableCell>
                    <TableCell>{t('import.dataset.dateRange')}</TableCell>
                    <TableCell>{t('import.dataset.avgDaily')}</TableCell>
                    <TableCell>{t('import.dataset.avgMonthly')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  <TableRow>
                    <TableCell>{formatNumber(summary.recordCount)}</TableCell>
                    <TableCell>{formatKWh(summary.totalConsumption)}</TableCell>
                    <TableCell>{summary.startDate} → {summary.endDate}</TableCell>
                    <TableCell>{formatKWh(summary.averageDailyConsumption, 1)}</TableCell>
                    <TableCell>{formatKWh(summary.averageMonthlyConsumption)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}
    </Stack>
  );
}
