import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { useDashboard } from './hooks/useDashboard'
import { Hero } from './components/Hero'
import { EmergencyGauge } from './components/EmergencyGauge'
import { AircraftList } from './components/AircraftList'
import { AboutCard } from './components/AboutCard'
import { StatusBanner } from './components/StatusBanner'
import { ThemeControl } from './components/ThemeControl'
import { formatDuration, formatRelative, formatTimestamp } from './lib/format'

const APP_VERSION = '0.1.0'
const DEFAULT_CADENCE_MINUTES = 30
const THEME_STORAGE_KEY = 'apocalypsewatch.theme'
const GlobalMap = lazy(() => import('./components/GlobalMap').then((module) => ({ default: module.GlobalMap })))
const ArchiveChart = lazy(() => import('./components/ArchiveChart').then((module) => ({ default: module.ArchiveChart })))

function deriveSignal(dashboard) {
  if (!dashboard) return null
  return (
    dashboard.signals?.composite ?? {
      asOf: dashboard.current?.asOf,
      actualConcurrentCount: dashboard.current?.concurrentCount,
      expectedConcurrentCount: dashboard.current?.baselineMean,
      expectedConcurrentStdDev: dashboard.current?.baselineStdDev,
      sigmaShift: dashboard.current?.zScore,
      alertLevel: dashboard.current?.alertLevel,
      emergencyLevel: dashboard.current?.emergencyLevel,
    }
  )
}

function deriveEmergencyLevel(signal) {
  const lvl = Number(signal?.emergencyLevel)
  if (Number.isFinite(lvl) && lvl >= 1 && lvl <= 5) return Math.round(lvl)
  const sigma = Number(signal?.sigmaShift)
  if (!Number.isFinite(sigma)) return 1
  if (sigma >= 7) return 5
  if (sigma >= 5) return 4
  if (sigma >= 3.5) return 3
  if (sigma >= 1.5) return 2
  return 1
}

function estimateMaxSeats(aircraft = [], airborneTotal) {
  if (!aircraft.length) return 0
  let known = 0
  let knownTotal = 0
  for (const a of aircraft) {
    const seats = Number(a.maxPassengers ?? a.maxSeats ?? a.seats)
    if (Number.isFinite(seats) && seats > 0) {
      knownTotal += seats
      known += 1
    }
  }
  if (!known) return null
  const avg = knownTotal / known
  const total = Number.isFinite(airborneTotal) ? airborneTotal : aircraft.length
  return Math.round(knownTotal + Math.max(0, total - known) * avg)
}

function getStaleSample(status) {
  const sampledAt = status?.latestSampledAt
  if (!sampledAt) return null
  const sampledMs = Date.parse(sampledAt)
  if (!Number.isFinite(sampledMs)) return null
  const cadenceMinutes = Number(status?.cadenceMinutes ?? DEFAULT_CADENCE_MINUTES)
  const cadenceMs = Math.max(1, Number.isFinite(cadenceMinutes) ? cadenceMinutes : DEFAULT_CADENCE_MINUTES) * 60_000
  const staleAfterMs = cadenceMs * 2
  const ageMs = Date.now() - sampledMs
  return ageMs > staleAfterMs ? { sampledAt, ageMs, staleAfterMs } : null
}

function getInitialThemeMode() {
  try {
    const saved = window.localStorage.getItem(THEME_STORAGE_KEY)
    return ['dark', 'light', 'system'].includes(saved) ? saved : 'dark'
  } catch {
    return 'dark'
  }
}

function resolveTheme(mode) {
  if (mode !== 'system') return mode
  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

function PanelFallback({ title, variant }) {
  return (
    <section className={`card panel-fallback panel-fallback--${variant}`} aria-busy="true">
      <div className="card-header">
        <div className="card-title">{title}</div>
        <div className="card-eyebrow">Loading</div>
      </div>
      <div className="panel-skeleton" />
    </section>
  )
}

export default function App() {
  const { data, error, lastFetchedAt, retryInMs, isFetching } = useDashboard()
  const [themeMode, setThemeMode] = useState(getInitialThemeMode)
  const signal = useMemo(() => deriveSignal(data), [data])
  const emergencyLevel = useMemo(() => deriveEmergencyLevel(signal), [signal])

  useEffect(() => {
    document.documentElement.dataset.emergency = String(emergencyLevel)
  }, [emergencyLevel])

  useEffect(() => {
    function applyTheme() {
      const resolved = resolveTheme(themeMode)
      document.documentElement.dataset.theme = resolved
      document.documentElement.style.colorScheme = resolved
    }

    applyTheme()
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, themeMode)
    } catch {
      // Preference persistence is best-effort only.
    }

    const media = window.matchMedia?.('(prefers-color-scheme: light)')
    if (themeMode !== 'system' || !media) return undefined
    media.addEventListener('change', applyTheme)
    return () => media.removeEventListener('change', applyTheme)
  }, [themeMode])

  if (error && !data) {
    return (
      <>
        <div className="bg-fx" />
        <main className="shell">
          <section className="card error-card">
            <h2>Data unavailable</h2>
            <p style={{ color: 'var(--text-secondary)' }}>{error}</p>
            <p style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem', marginTop: 12 }}>
              Make sure the API server is running on port 3030.
            </p>
          </section>
        </main>
      </>
    )
  }

  if (!data) {
    return (
      <>
        <div className="bg-fx" />
        <div className="loader" role="status" aria-live="polite">
          <div>
            <div className="loader-ring" />
            <div className="loader-label">Acquiring signal…</div>
          </div>
        </div>
      </>
    )
  }

  const liveAircraft = data.liveAircraft ?? []
  const archive = data.trends?.archive ?? []
  const liveStatus = data.liveStatus ?? null
  const cohort = data.cohort ?? data.watchlist ?? null
  const airborne = signal?.actualConcurrentCount ?? liveAircraft.length
  const maxSeats = estimateMaxSeats(liveAircraft, airborne)
  const sourceLabel = liveStatus?.providerLabel ?? 'ADS-B Exchange'
  const staleSample = getStaleSample(liveStatus)

  return (
    <>
      <div className="bg-fx" />
      <a className="skip-link" href="#dashboard-main">Skip to dashboard</a>
      <main className="shell" id="dashboard-main">
        <header className="app-topbar">
          <div className="brand-lockup" aria-label="ApocalypseWatch">
            <span className="brand-mark" aria-hidden="true">AW</span>
            <span>
              <strong>ApocalypseWatch</strong>
              <small>Private-jet anomaly monitor</small>
            </span>
          </div>
          <ThemeControl value={themeMode} onChange={setThemeMode} />
        </header>

        {data.warning ? (
          <StatusBanner kind="info" title={data.mode === 'demo' ? 'Demo mode' : 'Configuration required'}>
            {data.warning}
          </StatusBanner>
        ) : null}

        {!data.warning && !liveStatus?.latestSampledAt ? (
          <StatusBanner kind="info" title="No recent sweep">
            The backend polls the newest heatmap every 30 minutes and serves the latest cached sample.
          </StatusBanner>
        ) : null}

        {error ? (
          <StatusBanner kind="warning" title="Dashboard refresh delayed">
            Showing the last successful snapshot
            {lastFetchedAt ? ` from ${formatTimestamp(lastFetchedAt)}` : ''}.
            {' '}{error}
            {retryInMs ? ` Retrying in ${formatDuration(retryInMs)}.` : ''}
            {isFetching ? ' Refresh in progress.' : ''}
          </StatusBanner>
        ) : null}

        {staleSample ? (
          <StatusBanner kind="warning" title="Stale aircraft sweep">
            Latest heatmap sample is {formatRelative(staleSample.sampledAt)}.
            {liveStatus?.nextRefreshAt ? ` Next sweep: ${formatTimestamp(liveStatus.nextRefreshAt)}.` : ''}
          </StatusBanner>
        ) : null}

        {liveStatus?.lastError ? (
          <StatusBanner kind="error" title="Refresh error">
            {liveStatus.lastError}
            {liveStatus.nextRefreshAt ? ` Next sweep: ${formatTimestamp(liveStatus.nextRefreshAt)}.` : ''}
          </StatusBanner>
        ) : null}

        <Suspense fallback={<PanelFallback title="Realtime Tracker" variant="map" />}>
          <GlobalMap aircraft={liveAircraft} asOf={data.current?.asOf} />
        </Suspense>

        <div className="row row-2-1">
          <EmergencyGauge
            emergencyLevel={emergencyLevel}
            signal={signal}
            airborne={airborne}
            trackedTotal={cohort?.trackedCount}
            maxSeats={maxSeats}
            asOf={data.current?.asOf ?? signal?.asOf}
          />
          <AircraftList aircraft={liveAircraft} />
        </div>

        <Hero
          emergencyLevel={emergencyLevel}
          sourceLabel={sourceLabel}
          signal={signal}
          cohort={cohort}
          liveStatus={liveStatus}
        />

        <div className="row row-1-1">
          <Suspense fallback={<PanelFallback title="Concurrent Tracked Jets" variant="chart" />}>
            <ArchiveChart archive={archive} signal={signal} />
          </Suspense>
          <AboutCard cohort={cohort} signal={signal} />
        </div>

        <footer className="foot">
          <span>ApocalypseWatch v{APP_VERSION}</span>
          <span>{formatTimestamp(liveStatus?.latestSampledAt ?? data.current?.asOf)}</span>
        </footer>
      </main>
    </>
  )
}
