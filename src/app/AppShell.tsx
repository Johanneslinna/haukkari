import { NavLink, Outlet } from 'react-router-dom'
import {
  Bell,
  CalendarDays,
  ChartNoAxesColumnIncreasing,
  CheckCircle2,
  CircleAlert,
  Cloud,
  Dumbbell,
  Flag,
  History,
  House,
  MoreHorizontal,
  Settings,
  Target,
  Utensils,
  WifiOff,
  type LucideIcon,
} from 'lucide-react'
import { useSync } from '../features/sync/syncContextValue'
import { ThemeToggle } from './ThemeToggle'
import { InAppReminderBanner } from '../features/settings/InAppReminderBanner'
import { HaukkariLogo } from './HaukkariLogo'

type NavigationItem = {
  to: string
  label: string
  short: string
  icon: LucideIcon
}

const primaryNavigation: NavigationItem[] = [
  { to: '/', label: 'Tänään', short: 'Nyt', icon: House },
  { to: '/viikko', label: 'Viikko', short: 'Vko', icon: CalendarDays },
  { to: '/tavoitteet', label: 'Tavoitteet', short: 'Tavoite', icon: Target },
  {
    to: '/edistyminen',
    label: 'Edistyminen',
    short: 'Kehitys',
    icon: ChartNoAxesColumnIncreasing,
  },
  { to: '/lisaa', label: 'Lisää', short: 'Lisää', icon: MoreHorizontal },
]

const secondaryNavigation = [
  { to: '/laji', label: 'Laji ja kilpailut', icon: Dumbbell },
  { to: '/ravinto', label: 'Ravinto', icon: Utensils },
  { to: '/historia', label: 'Harjoitushistoria', icon: History },
  { to: '/tavoitejaksot', label: 'Tavoitejaksot', icon: Flag },
  { to: '/muistutukset', label: 'Muistutukset', icon: Bell },
  { to: '/synkronointi', label: 'Synkronointi', icon: Cloud },
  { to: '/asetukset', label: 'Asetukset', icon: Settings },
]

function navClass({ isActive }: { isActive: boolean }) {
  return `app-nav-link${isActive ? ' active' : ''}`
}

export function AppShell() {
  const { status } = useSync()
  const SyncIcon =
    status.state === 'OFFLINE'
      ? WifiOff
      : status.state === 'ERROR' || status.state === 'CONFLICT'
        ? CircleAlert
        : CheckCircle2
  const syncLabel =
    status.state === 'OFFLINE'
      ? 'Offline – muutokset tallentuvat laitteelle'
      : status.state === 'ERROR' || status.state === 'CONFLICT'
        ? 'Synkronointi vaatii huomiota'
        : status.state === 'SYNCING'
          ? 'Tallennetaan muutoksia…'
          : 'Tiedot turvassa'
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Siirry sisältöön
      </a>
      <aside className="app-sidebar" aria-label="Päänavigaatio">
        <NavLink className="app-brand" to="/">
          <HaukkariLogo inverse />
        </NavLink>
        <nav className="desktop-navigation" aria-label="Päänavigaatio">
          {primaryNavigation.map((item) => (
            <NavLink
              className={navClass}
              key={item.to}
              to={item.to}
              end={item.to === '/'}
            >
              <item.icon aria-hidden="true" size={19} strokeWidth={2.2} />
              {item.label}
            </NavLink>
          ))}
          <div className="nav-divider" />
          {secondaryNavigation.map((item) => (
            <NavLink className={navClass} key={item.to} to={item.to}>
              <item.icon aria-hidden="true" size={18} strokeWidth={2} />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-status" role="status" aria-live="polite">
          <SyncIcon aria-hidden="true" size={17} />
          {syncLabel}
        </div>
      </aside>
      <div className="app-stage">
        <header className="mobile-app-header">
          <NavLink className="app-brand compact" to="/">
            <HaukkariLogo compact />
          </NavLink>
          <ThemeToggle />
        </header>
        <main className="app-content" id="main-content" tabIndex={-1}>
          <InAppReminderBanner />
          <Outlet />
        </main>
      </div>
      <nav className="bottom-navigation" aria-label="Päänavigaatio">
        {primaryNavigation.map((item) => (
          <NavLink className={navClass} key={item.to} to={item.to} end={item.to === '/'}>
            <item.icon aria-hidden="true" size={21} strokeWidth={2.1} />
            <span>{item.short}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
