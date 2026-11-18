import { useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
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
      <aside className={`sidebar ${menuOpen ? 'open' : ''}`} aria-label="Sidebar">
        <div className="brand">
          <div className="brand-mark"><Leaf size={22} aria-hidden="true" /></div>
          <span>Vayu</span>
          <button type="button" className="mobile-close" aria-label="Close navigation" onClick={() => setMenuOpen(false)}>
            <X size={18} />
          </button>
        </div>
        <p className="brand-tagline">Urban air intelligence</p>

        <nav aria-label="Primary navigation">
          {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => (isActive ? 'active' : '')}
              onClick={() => setMenuOpen(false)}
            >
              <Icon size={19} aria-hidden="true" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <NavLink to="/settings" className={({ isActive }) => (isActive ? 'active' : '')} onClick={() => setMenuOpen(false)}>
            <Settings size={19} aria-hidden="true" />
            <span>Settings &amp; privacy</span>
          </NavLink>
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
          <button type="button" className="menu-button" aria-label="Open navigation" onClick={() => setMenuOpen(true)}>
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
