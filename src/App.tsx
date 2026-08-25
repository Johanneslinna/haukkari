import { lazy, Suspense, useEffect, type ReactNode } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AppShell } from './app/AppShell'
import { UpdateNotice } from './app/UpdateNotice'
import { useAppData } from './features/app-data/appDataContextValue'
import { useAuth } from './features/auth/authContextValue'
import { isSupabaseConfigured } from './infrastructure/supabase/client'

const AccountPage = lazy(() =>
  import('./features/auth/pages/AccountPage').then((m) => ({ default: m.AccountPage })),
)
const AuthCallbackPage = lazy(() =>
  import('./features/auth/pages/AuthCallbackPage').then((m) => ({
    default: m.AuthCallbackPage,
  })),
)
const ForgotPasswordPage = lazy(() =>
  import('./features/auth/pages/ForgotPasswordPage').then((m) => ({
    default: m.ForgotPasswordPage,
  })),
)
const LoginPage = lazy(() =>
  import('./features/auth/pages/LoginPage').then((m) => ({ default: m.LoginPage })),
)
const RegisterPage = lazy(() =>
  import('./features/auth/pages/RegisterPage').then((m) => ({ default: m.RegisterPage })),
)
const ResetPasswordPage = lazy(() =>
  import('./features/auth/pages/ResetPasswordPage').then((m) => ({
    default: m.ResetPasswordPage,
  })),
)
const PrivacyPage = lazy(() =>
  import('./features/privacy/PrivacyPage').then((m) => ({ default: m.PrivacyPage })),
)
const OnboardingPage = lazy(() =>
  import('./features/onboarding/OnboardingPage').then((m) => ({
    default: m.OnboardingPage,
  })),
)
const TodayPage = lazy(() =>
  import('./features/today/TodayPage').then((m) => ({ default: m.TodayPage })),
)
const DailyCheckInPage = lazy(() =>
  import('./features/today/DailyCheckInPage').then((m) => ({
    default: m.DailyCheckInPage,
  })),
)
const WeekPage = lazy(() =>
  import('./features/week/WeekPage').then((m) => ({ default: m.WeekPage })),
)
const WeekSessionPreviewPage = lazy(() =>
  import('./features/week/WeekSessionPreviewPage').then((m) => ({
    default: m.WeekSessionPreviewPage,
  })),
)
const WorkoutPage = lazy(() =>
  import('./features/workout/WorkoutPage').then((m) => ({ default: m.WorkoutPage })),
)
const GoalsPage = lazy(() =>
  import('./features/goals/GoalsPage').then((m) => ({ default: m.GoalsPage })),
)
const GoalChangePage = lazy(() =>
  import('./features/goals/GoalChangePage').then((m) => ({ default: m.GoalChangePage })),
)
const GoalPreviewPage = lazy(() =>
  import('./features/goals/GoalPreviewPage').then((m) => ({
    default: m.GoalPreviewPage,
  })),
)
const SportCalendarPage = lazy(() =>
  import('./features/sport/SportCalendarPage').then((m) => ({
    default: m.SportCalendarPage,
  })),
)
const NutritionPage = lazy(() =>
  import('./features/nutrition/NutritionPage').then((m) => ({
    default: m.NutritionPage,
  })),
)
const ProgressPage = lazy(() =>
  import('./features/progress/ProgressPage').then((m) => ({ default: m.ProgressPage })),
)
const ProgressPhotosPage = lazy(() =>
  import('./features/progress/ProgressPhotosPage').then((m) => ({
    default: m.ProgressPhotosPage,
  })),
)
const GoalTimelinePage = lazy(() =>
  import('./features/progress/GoalTimelinePage').then((m) => ({
    default: m.GoalTimelinePage,
  })),
)
const HistoryPage = lazy(() =>
  import('./features/history/HistoryPage').then((m) => ({ default: m.HistoryPage })),
)
const MorePage = lazy(() =>
  import('./features/more/MorePage').then((m) => ({ default: m.MorePage })),
)
const SyncPage = lazy(() =>
  import('./features/sync/SyncPage').then((m) => ({ default: m.SyncPage })),
)
const SettingsPage = lazy(() =>
  import('./features/settings/SettingsPage').then((m) => ({ default: m.SettingsPage })),
)
const InstallPage = lazy(() =>
  import('./features/settings/InstallPage').then((m) => ({ default: m.InstallPage })),
)
const RemindersPage = lazy(() =>
  import('./features/settings/RemindersPage').then((m) => ({ default: m.RemindersPage })),
)
const DataManagementPage = lazy(() =>
  import('./features/settings/DataManagementPage').then((m) => ({
    default: m.DataManagementPage,
  })),
)

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { loading, session } = useAuth()
  const location = useLocation()
  if (loading) return <main className="centered-page">Tarkistetaan istuntoa…</main>
  if (!session) return <Navigate to="/kirjaudu" replace state={{ from: location }} />
  return children
}

function OnboardingGate({
  onboarding = false,
  children,
}: {
  onboarding?: boolean
  children: ReactNode
}) {
  const data = useAppData()
  const location = useLocation()
  if (!data.deviceId || (data.loading && location.pathname !== '/'))
    return (
      <main className="centered-page">
        Valmistellaan paikallista harjoituspäiväkirjaa…
      </main>
    )
  if (data.loading) return children
  const complete = data.latest('profiles')?.data.onboarding_completed === true
  if (onboarding && complete) return <Navigate to="/" replace />
  if (!onboarding && !complete) return <Navigate to="/aloitus" replace />
  return children
}

function protectedElement(children: ReactNode) {
  return <ProtectedRoute>{children}</ProtectedRoute>
}

export default function App() {
  return (
    <>
      <ScrollToTop />
      {!isSupabaseConfigured && import.meta.env.VITE_E2E_APP_HARNESS !== 'true' && (
        <ConfigurationNotice />
      )}
      <Suspense fallback={<main className="centered-page">Avataan näkymää…</main>}>
        <Routes>
          <Route path="/kirjaudu" element={<LoginPage />} />
          <Route path="/rekisteroidy" element={<RegisterPage />} />
          <Route path="/salasana/unohtui" element={<ForgotPasswordPage />} />
          <Route path="/salasana/uusi" element={<ResetPasswordPage />} />
          <Route path="/auth/callback" element={<AuthCallbackPage />} />
          <Route path="/tietosuoja" element={<PrivacyPage />} />
          <Route path="/tili" element={protectedElement(<AccountPage />)} />
          <Route
            path="/aloitus"
            element={protectedElement(
              <OnboardingGate onboarding>
                <OnboardingPage />
              </OnboardingGate>,
            )}
          />
          <Route
            element={protectedElement(
              <OnboardingGate>
                <AppShell />
              </OnboardingGate>,
            )}
          >
            <Route index element={<TodayPage />} />
            <Route path="kuntotarkistus" element={<DailyCheckInPage />} />
            <Route path="harjoitus" element={<WorkoutPage />} />
            <Route path="viikko" element={<WeekPage />} />
            <Route path="viikko/:sessionId" element={<WeekSessionPreviewPage />} />
            <Route path="tavoitteet" element={<GoalsPage />} />
            <Route path="tavoitteet/vaihda" element={<GoalChangePage />} />
            <Route path="tavoitteet/esikatselu" element={<GoalPreviewPage />} />
            <Route path="laji" element={<SportCalendarPage />} />
            <Route path="ravinto" element={<NutritionPage />} />
            <Route path="edistyminen" element={<ProgressPage />} />
            <Route path="kehityskuvat" element={<ProgressPhotosPage />} />
            <Route path="tavoitejaksot" element={<GoalTimelinePage />} />
            <Route path="historia" element={<HistoryPage />} />
            <Route path="historia/:workoutLogId" element={<HistoryPage />} />
            <Route path="lisaa" element={<MorePage />} />
            <Route path="muistutukset" element={<RemindersPage />} />
            <Route path="synkronointi" element={<SyncPage />} />
            <Route path="asetukset" element={<SettingsPage />} />
            <Route path="asenna" element={<InstallPage />} />
            <Route path="tiedot" element={<DataManagementPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      <UpdateNotice />
    </>
  )
}

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0 })
  }, [pathname])
  return null
}

function ConfigurationNotice() {
  return (
    <div className="configuration-notice" role="status">
      Supabase-yhteys puuttuu. Kopioi <code>.env.example</code> tiedostoksi{' '}
      <code>.env.local</code> ja lisää paikalliset tai hosted-projektin julkiset arvot.
    </div>
  )
}
