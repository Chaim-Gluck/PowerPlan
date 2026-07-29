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
import { useApp } from '../state/AppContext';
import { importFile, importCsvText, type ImportResult } from '../utils/dataImport';
import { formatKWh, formatNumber } from '../utils/format';

const IEC_URL = 'https://www.iec.co.il/consumption-info-menu/remote-reading-info';

const GUIDE_STEPS: { label: string; detail: string }[] = [
  { label: 'Open the IEC “Remote Reading Info” page', detail: 'Use the button above. It opens on the official IEC site in a new tab so you can log in securely — this app never sees your IEC credentials.' },
  { label: 'Log in with your IEC account', detail: 'Sign in (ID number / customer number + the code sent to your phone). If you have more than one meter, pick the electricity consumption meter.' },
  { label: 'Request the consumption report (“דוח צריכה”)', detail: 'Choose the widest date range available (up to ~2 years of 15-minute data) and request the report. IEC either lets you download it directly or emails it to you as a CSV.' },
  { label: 'Save the CSV file', detail: 'Download it (or save the emailed attachment). It looks like meter_LP_…gmail.com.csv — the same format this app expects.' },
  { label: 'Drag it into this app', detail: 'Drop the CSV (or Excel) onto the box above, or use “Choose file”. Everything is parsed locally in your browser — nothing is uploaded anywhere.' },
];


export default function ImportPage() {
  const { setData, clearData, summary, fileName, intervalMinutes, rawRecords } = useApp();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<ImportResult | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      const result = await importFile(file);
      if (result.records.length === 0) throw new Error('No records found in the file.');
      setData(result.records, result.intervalMinutes, file.name);
      setLastResult(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to import file.');
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
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load sample.');
    } finally {
      setBusy(false);
    }
  };

  const intervalLabel =
    intervalMinutes === 15 ? 'Quarter-hour (15 min)'
      : intervalMinutes === 30 ? 'Half-hour (30 min)'
      : intervalMinutes === 60 ? 'Hourly (60 min)'
      : `${intervalMinutes} min`;

  return (
    <Stack spacing={3}>
      <Typography variant="h4">Import electricity data</Typography>

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
          <Typography variant="h6">Drop your CSV or Excel file here</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Supports the IEC meter export (meter_LP_…csv) and generic Timestamp + Consumption files.
            Hourly, half-hour and quarter-hour intervals are detected automatically.
          </Typography>
          <input
            ref={inputRef} type="file" accept=".csv,.xlsx,.xls" hidden
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
          <Stack direction="row" spacing={2} justifyContent="center" sx={{ mt: 1 }}>
            <Button variant="contained" startIcon={<UploadFileIcon />} onClick={() => inputRef.current?.click()}>
              Choose file
            </Button>
            <Button variant="outlined" startIcon={<ScienceIcon />} onClick={loadSample}>
              Load sample data
            </Button>
          </Stack>
        </CardContent>
      </Card>

      {busy && <LinearProgress />}
      {error && <Alert severity="error">{error}</Alert>}

      {lastResult && lastResult.warnings.map((w, i) => (
        <Alert key={i} severity="info">{w}</Alert>
      ))}

      <Alert severity="info" icon={<HelpOutlineIcon />}>
        <Stack spacing={1.5}>
          <Typography variant="body2">
            Don’t have the file yet? Download your own 2-year meter report from IEC. It’s a quick, secure,
            self-service flow — this app can’t log in for you (it has no server and never handles your IEC
            credentials), but here’s exactly how to get it:
          </Typography>
          <Box>
            <Button
              variant="contained" size="small" startIcon={<OpenInNewIcon />}
              onClick={() => window.open(IEC_URL, '_blank', 'noopener,noreferrer')}
            >
              Open IEC portal
            </Button>
          </Box>
          <Accordion elevation={0} disableGutters sx={{ bgcolor: 'transparent', '&:before': { display: 'none' } }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ px: 0, minHeight: 0 }}>
              <Typography variant="body2" fontWeight={600}>Step-by-step guide</Typography>
            </AccordionSummary>
            <AccordionDetails sx={{ px: 0 }}>
              <Stepper orientation="vertical" nonLinear>
                {GUIDE_STEPS.map((s, i) => (
                  <Step key={i} active expanded>
                    <StepLabel>{s.label}</StepLabel>
                    <StepContent>
                      <Typography variant="caption" color="text.secondary">{s.detail}</Typography>
                    </StepContent>
                  </Step>
                ))}
              </Stepper>
              <Typography variant="caption" color="text.secondary">
                Direct link:{' '}
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
              <Typography variant="h6">Imported dataset</Typography>
              <Button color="error" startIcon={<DeleteSweepIcon />} onClick={clearData}>
                Clear data
              </Button>
            </Stack>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
              <Chip label={fileName ?? 'dataset'} color="primary" variant="outlined" />
              <Chip label={intervalLabel} />
              {lastResult && <Chip label={`Format: ${lastResult.format.toUpperCase()}`} />}
              {lastResult?.hasBilledCost && <Chip color="success" label="Includes billed cost" />}
            </Stack>
            <TableContainer sx={{ overflowX: 'auto' }}>
              <Table size="small" sx={{ minWidth: 440 }}>
                <TableHead>
                  <TableRow>
                    <TableCell>Records</TableCell>
                    <TableCell>Total consumption</TableCell>
                    <TableCell>Date range</TableCell>
                    <TableCell>Avg daily</TableCell>
                    <TableCell>Avg monthly</TableCell>
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
