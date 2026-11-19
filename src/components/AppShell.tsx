import { useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import {
  Bot,
  Home,
  LayoutDashboard,
  Leaf,
  MapPin,
  Menu,
  Settings,
  ShieldCheck,
  Sparkles,
  Sun,
  TrendingDown,
  Users,
  Wind,
  X,
} from 'lucide-react'
import { useApp } from '../context/AppContext'
import { AqiBadge } from './AqiBadge'
import { LocationDialog } from './LocationDialog'
import { OnboardingDialog } from './OnboardingDialog'

const NAV_ITEMS = [
  { to: '/', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/air-quality', label: 'Air quality', icon: Wind },
  { to: '/planner', label: 'Daily planner', icon: Sun },
  { to: '/indoor', label: 'Indoor air', icon: Home },
  { to: '/impact', label: 'Impact simulator', icon: TrendingDown },
  { to: '/family', label: 'Family protection', icon: ShieldCheck },
  { to: '/advisor', label: 'AI advisor', icon: Bot },
]

export function AppShell() {
  const { location, setLocation, air, profile, onboarded } = useApp()
  const [menuOpen, setMenuOpen] = useState(false)
  const [locationOpen, setLocationOpen] = useState(false)
  const { pathname } = useLocation()

  // `NavLink` only exposes its active state through `className`, so the current
  // page was conveyed by colour alone. Assistive technology needs
  // `aria-current="page"`, which requires knowing the active route directly.
  const isCurrent = (to: string, end?: boolean) =>
    end ? pathname === to : pathname === to || pathname.startsWith(`${to}/`)

  const assessment = air.data?.model.assessment
  const statusLabel = air.loading
    ? 'Loading air data'
    : air.error
      ? 'Air data unavailable'
      : assessment
        ? `${assessment.category ?? 'AQI unavailable'}`
        : 'Air data unavailable'

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <aside id="primary-sidebar" className={`sidebar ${menuOpen ? 'open' : ''}`} aria-label="Sidebar">
        <div className="brand">
          <div className="brand-mark"><Leaf size={22} aria-hidden="true" /></div>
          <span>Vayu</span>
          <button type="button" className="mobile-close" aria-label="Close navigation" onClick={() => setMenuOpen(false)}>
            <X size={18} />
          </button>
        </div>
        <p className="brand-tagline">Urban air intelligence</p>

        <nav aria-label="Primary navigation">
          {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => {
            const active = isCurrent(to, end)
            return (
              <Link
                key={to}
                to={to}
                className={active ? 'active' : ''}
                aria-current={active ? 'page' : undefined}
                onClick={() => setMenuOpen(false)}
              >
                <Icon size={19} aria-hidden="true" />
                <span>{label}</span>
              </Link>
            )
          })}
        </nav>

        <div className="sidebar-bottom">
          <Link
            to="/settings"
            className={isCurrent('/settings') ? 'active' : ''}
            aria-current={isCurrent('/settings') ? 'page' : undefined}
            onClick={() => setMenuOpen(false)}
          >
            <Settings size={19} aria-hidden="true" />
            <span>Settings &amp; privacy</span>
          </Link>
          <div className="user-chip">
            <div aria-hidden="true"><Users size={16} /></div>
            <span>
              <strong>Your household</strong>
              <small>{profile.adults} adults · {profile.children} children · {profile.elderly} older adults</small>
            </span>
          </div>
        </div>
      </aside>

      {menuOpen && <button type="button" className="overlay" aria-label="Close navigation" onClick={() => setMenuOpen(false)} />}

      <main id="main-content">
        <header className="topbar">
          <button
            type="button"
            className="menu-button"
            aria-label={menuOpen ? 'Close navigation' : 'Open navigation'}
            aria-expanded={menuOpen}
            aria-controls="primary-sidebar"
            onClick={() => setMenuOpen(true)}
          >
            <Menu size={20} />
          </button>
          <button type="button" className="location-control" onClick={() => setLocationOpen(true)}>
            <MapPin size={17} aria-hidden="true" />
            <span>
              <small>Current location</small>
              <strong>{location.city}</strong>
            </span>
          </button>

          <div className="top-actions">
            <span className={`data-status ${air.isStale ? 'stale' : ''}`} role="status">
              {statusLabel}
            </span>
            {assessment && <AqiBadge aqi={assessment.aqi} category={assessment.category} prefix="AQI" />}
            <Link className="ask-button" to="/advisor">
              <Sparkles size={17} aria-hidden="true" /> Ask Vayu
            </Link>
          </div>
        </header>

        <Outlet />
      </main>

      <LocationDialog
        open={locationOpen}
        onClose={() => setLocationOpen(false)}
        onSelect={setLocation}
      />
      <OnboardingDialog open={!onboarded} onClose={() => undefined} />
    </div>
  )
}
