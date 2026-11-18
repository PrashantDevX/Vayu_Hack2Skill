import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom'
import { AppProvider } from './context/AppContext'
import { ErrorBoundary } from './components/ErrorBoundary'
import { AppShell } from './components/AppShell'
import Dashboard from './pages/Dashboard'

const AirQuality = lazy(() => import('./pages/AirQuality'))
const DailyPlanner = lazy(() => import('./pages/DailyPlanner'))
const IndoorAir = lazy(() => import('./pages/IndoorAir'))
const ImpactSimulator = lazy(() => import('./pages/ImpactSimulator'))
const FamilyProtection = lazy(() => import('./pages/FamilyProtection'))
const AIAdvisor = lazy(() => import('./pages/AIAdvisor'))
const Settings = lazy(() => import('./pages/Settings'))
const NotFound = lazy(() => import('./pages/NotFound'))

function RouteFallback() {
  return (
    <div className="page route-loading" role="status">
      <div className="skeleton-card" />
      <p>Loading module…</p>
    </div>
  )
}

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [pathname])
  return null
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AppProvider>
          <ScrollToTop />
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route element={<AppShell />}>
                <Route index element={<Dashboard />} />
                <Route path="air-quality" element={<AirQuality />} />
                <Route path="planner" element={<DailyPlanner />} />
                <Route path="indoor" element={<IndoorAir />} />
                <Route path="impact" element={<ImpactSimulator />} />
                <Route path="family" element={<FamilyProtection />} />
                <Route path="advisor" element={<AIAdvisor />} />
                <Route path="settings" element={<Settings />} />
                <Route path="*" element={<NotFound />} />
              </Route>
            </Routes>
          </Suspense>
        </AppProvider>
      </BrowserRouter>
    </ErrorBoundary>
  )
}
