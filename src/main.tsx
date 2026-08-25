import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './features/auth/AuthContext'
import type { AuthApi } from './features/auth/authApi'
import { AppDataProvider } from './features/app-data/AppDataContext'
import { SyncProvider } from './features/sync/SyncContext'
import './index.css'

if (import.meta.env.VITE_E2E_SYNC_HARNESS === 'true') {
  void import('./test/browserSyncHarness').then(({ installBrowserSyncHarness }) => {
    installBrowserSyncHarness()
  })
}

async function bootstrap() {
  const root = document.getElementById('root')
  if (!root) throw new Error('Sovelluksen juurielementti puuttuu.')
  if (
    import.meta.env.VITE_E2E_APP_HARNESS === 'true' &&
    new URLSearchParams(window.location.search).has('today-state')
  ) {
    const { VisualTodayHarness } = await import('./test/visualTodayHarness')
    createRoot(root).render(<VisualTodayHarness />)
    return
  }
  let api: AuthApi | undefined
  if (import.meta.env.VITE_E2E_APP_HARNESS === 'true') {
    api = (await import('./test/appAuthHarness')).appHarnessAuthApi
  }
  createRoot(root).render(
    <StrictMode>
      <BrowserRouter>
        <AuthProvider api={api}>
          <SyncProvider>
            <AppDataProvider>
              <App />
            </AppDataProvider>
          </SyncProvider>
        </AuthProvider>
      </BrowserRouter>
    </StrictMode>,
  )
}

void bootstrap()
