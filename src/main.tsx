import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'dayjs/locale/he'
import './i18n/config'
import App from './App.tsx'
import { AppProvider } from './state/AppContext.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProvider>
      <App />
    </AppProvider>
  </StrictMode>,
)
