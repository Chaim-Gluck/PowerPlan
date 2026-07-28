import { createTheme, type Theme } from '@mui/material/styles';

/** Build a light or dark MUI theme with a consistent energy-analytics palette. */
export function buildTheme(mode: 'light' | 'dark'): Theme {
  return createTheme({
    palette: {
      mode,
      primary: { main: '#1976d2' },
      secondary: { main: '#7b1fa2' },
      success: { main: '#2e7d32' },
      warning: { main: '#ed6c02' },
      background:
        mode === 'dark'
          ? { default: '#0f1419', paper: '#161b22' }
          : { default: '#f4f6f8', paper: '#ffffff' },
    },
    shape: { borderRadius: 12 },
    typography: {
      fontFamily: 'Inter, Roboto, "Segoe UI", Helvetica, Arial, sans-serif',
      h4: { fontWeight: 700 },
      h5: { fontWeight: 700 },
      h6: { fontWeight: 600 },
    },
    components: {
      MuiCard: {
        styleOverrides: {
          root: { backgroundImage: 'none' },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: { backgroundImage: 'none' },
        },
      },
    },
  });
}

/** Palette used to color plans/series consistently across charts. */
export const SERIES_COLORS = [
  '#1976d2',
  '#7b1fa2',
  '#2e7d32',
  '#ed6c02',
  '#0288d1',
  '#c2185b',
  '#5d4037',
  '#455a64',
  '#f9a825',
  '#00838f',
];
