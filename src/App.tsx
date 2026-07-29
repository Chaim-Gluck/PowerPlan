import { useMemo, useState, type ReactElement } from 'react';
import {
  AppBar, Toolbar, Typography, Box, Tabs, Tab, IconButton, Container, CssBaseline, Tooltip,
  useMediaQuery, Paper, BottomNavigation, BottomNavigationAction,
} from '@mui/material';
import { ThemeProvider } from '@mui/material/styles';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
import SettingsIcon from '@mui/icons-material/Settings';
import BoltIcon from '@mui/icons-material/Bolt';
import DashboardIcon from '@mui/icons-material/SpaceDashboard';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import BarChartIcon from '@mui/icons-material/BarChart';
import InsightsIcon from '@mui/icons-material/Insights';
import { useApp } from './state/AppContext';
import { buildTheme } from './theme/theme';
import SettingsDialog from './components/SettingsDialog';
import Dashboard from './pages/Dashboard';
import ImportPage from './pages/ImportPage';
import PlansPage from './pages/PlansPage';
import ComparisonPage from './pages/ComparisonPage';
import InsightsPage from './pages/InsightsPage';

interface TabDef {
  key: string;
  label: string;
  icon: ReactElement;
}

const TABS: TabDef[] = [
  { key: 'dashboard', label: 'Dashboard', icon: <DashboardIcon /> },
  { key: 'import', label: 'Import', icon: <UploadFileIcon /> },
  { key: 'plans', label: 'Plans', icon: <ReceiptLongIcon /> },
  { key: 'comparison', label: 'Compare', icon: <BarChartIcon /> },
  { key: 'insights', label: 'Insights', icon: <InsightsIcon /> },
];

const BOTTOM_NAV_HEIGHT = 56;

export default function App() {
  const { darkMode, toggleDarkMode } = useApp();
  const [tab, setTab] = useState('dashboard');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const theme = useMemo(() => buildTheme(darkMode ? 'dark' : 'light'), [darkMode]);
  // Phones: top tabs don't fit next to the logo + action icons, so use a bottom nav bar instead.
  const isMobile = useMediaQuery('(max-width:600px)');

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
              {isMobile ? (
                <Box sx={{ flexGrow: 1 }} />
              ) : (
                <Tabs
                  value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons="auto"
                  sx={{ flexGrow: 1 }}
                >
                  {TABS.map((t) => <Tab key={t.key} value={t.key} label={t.label} />)}
                </Tabs>
              )}
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

          <Container maxWidth="xl" sx={{ py: 3, pb: isMobile ? `${BOTTOM_NAV_HEIGHT + 24}px` : 3 }}>
            {tab === 'dashboard' && <Dashboard onNavigate={setTab} />}
            {tab === 'import' && <ImportPage />}
            {tab === 'plans' && <PlansPage />}
            {tab === 'comparison' && <ComparisonPage />}
            {tab === 'insights' && <InsightsPage />}
          </Container>

          {isMobile && (
            <Paper
              elevation={8}
              sx={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: (t) => t.zIndex.appBar, borderTop: '1px solid', borderColor: 'divider' }}
            >
              <BottomNavigation
                value={tab}
                onChange={(_, v) => setTab(v)}
                showLabels
                sx={{ height: BOTTOM_NAV_HEIGHT }}
              >
                {TABS.map((t) => (
                  <BottomNavigationAction key={t.key} value={t.key} label={t.label} icon={t.icon} />
                ))}
              </BottomNavigation>
            </Paper>
          )}

          <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
        </Box>
      </LocalizationProvider>
    </ThemeProvider>
  );
}
