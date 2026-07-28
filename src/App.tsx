import { useMemo, useState } from 'react';
import {
  AppBar, Toolbar, Typography, Box, Tabs, Tab, IconButton, Container, CssBaseline, Tooltip,
} from '@mui/material';
import { ThemeProvider } from '@mui/material/styles';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
import SettingsIcon from '@mui/icons-material/Settings';
import BoltIcon from '@mui/icons-material/Bolt';
import { useApp } from './state/AppContext';
import { buildTheme } from './theme/theme';
import SettingsDialog from './components/SettingsDialog';
import Dashboard from './pages/Dashboard';
import ImportPage from './pages/ImportPage';
import PlansPage from './pages/PlansPage';
import ComparisonPage from './pages/ComparisonPage';
import InsightsPage from './pages/InsightsPage';

const TABS = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'import', label: 'Import' },
  { key: 'plans', label: 'Plans' },
  { key: 'comparison', label: 'Comparison' },
  { key: 'insights', label: 'Insights' },
];

export default function App() {
  const { darkMode, toggleDarkMode } = useApp();
  const [tab, setTab] = useState('dashboard');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const theme = useMemo(() => buildTheme(darkMode ? 'dark' : 'light'), [darkMode]);

  return (
    <ThemeProvider theme={theme}>
      <LocalizationProvider dateAdapter={AdapterDayjs}>
        <CssBaseline />
        <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
          <AppBar position="sticky" elevation={0} color="default" sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>
            <Toolbar>
              <BoltIcon color="primary" sx={{ mr: 1 }} />
              <Typography variant="h6" sx={{ fontWeight: 700, mr: 3 }}>
                PowerPlan
              </Typography>
              <Tabs
                value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons="auto"
                sx={{ flexGrow: 1 }}
              >
                {TABS.map((t) => <Tab key={t.key} value={t.key} label={t.label} />)}
              </Tabs>
              <Tooltip title={darkMode ? 'Light mode' : 'Dark mode'}>
                <IconButton onClick={toggleDarkMode} color="inherit">
                  {darkMode ? <LightModeIcon /> : <DarkModeIcon />}
                </IconButton>
              </Tooltip>
              <Tooltip title="Settings">
                <IconButton onClick={() => setSettingsOpen(true)} color="inherit">
                  <SettingsIcon />
                </IconButton>
              </Tooltip>
            </Toolbar>
          </AppBar>

          <Container maxWidth="xl" sx={{ py: 3 }}>
            {tab === 'dashboard' && <Dashboard onNavigate={setTab} />}
            {tab === 'import' && <ImportPage />}
            {tab === 'plans' && <PlansPage />}
            {tab === 'comparison' && <ComparisonPage />}
            {tab === 'insights' && <InsightsPage />}
          </Container>
          <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
        </Box>
      </LocalizationProvider>
    </ThemeProvider>
  );
}
