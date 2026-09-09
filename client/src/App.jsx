import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useDashboard } from './hooks/useDashboard'
import { Hero } from './components/Hero'
import { EmergencyGauge } from './components/EmergencyGauge'
import { AircraftList } from './components/AircraftList'
import { AboutCard } from './components/AboutCard'
import { StatusBanner } from './components/StatusBanner'
import { ThemeControl } from './components/ThemeControl'
import { LevelHistory } from './components/LevelHistory'
import { EmbedView } from './components/EmbedView'
import { DataGapCalendar } from './components/DataGapCalendar'
import { EvidencePacket } from './components/EvidencePacket'
import { SensitivitySandbox } from './components/SensitivitySandbox'
import { EMERGENCY_LEVELS, BRAND_ICON_URL } from './lib/constants'
import { deriveSignal, deriveEmergencyLevel } from './lib/signal.js'
import { formatDuration, formatRelative, formatTimestamp } from './lib/format'
import { buildArchiveHealth, buildSensitivityPreview, decodeArchive } from './lib/archive'

const APP_VERSION = '0.2.1'
const EMPTY_ARCHIVE = []

const DEFAULT_CADENCE_MINUTES = 30
const THEME_STORAGE_KEY = 'apocalypsewatch.theme'
const GlobalMap = lazy(() => import('./components/GlobalMap').then((module) => ({ default: module.GlobalMap })))
const ArchiveChart = lazy(() => import('./components/ArchiveChart').then((module) => ({ default: module.ArchiveChart })))

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

const IS_EMBED = new URLSearchParams(window.location.search).has('embed')

export default function App() {
  const { data, error, lastFetchedAt, retryInMs, isFetching } = useDashboard()
  const [themeMode, setThemeMode] = useState(getInitialThemeMode)
  const signal = useMemo(() => deriveSignal(data), [data])
  const emergencyLevel = useMemo(() => deriveEmergencyLevel(signal), [signal])
  const [sensitivityThreshold, setSensitivityThreshold] = useState(null)
  const [levelAnnouncement, setLevelAnnouncement] = useState('')
  const prevLevelRef = useRef(emergencyLevel)

  useEffect(() => {
    document.documentElement.dataset.emergency = String(emergencyLevel)
    if (prevLevelRef.current !== emergencyLevel) {
      const cfg = EMERGENCY_LEVELS.find((l) => l.level === emergencyLevel)
      setLevelAnnouncement(`Activity level ${emergencyLevel}: ${cfg?.label ?? 'Unknown'}`)
      prevLevelRef.current = emergencyLevel
    }
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

  const archive = data?.trends?.archive ?? EMPTY_ARCHIVE
  const liveStatus = data?.liveStatus ?? null
  const decodedArchive = useMemo(() => decodeArchive(archive), [archive])
  const archiveHealth = useMemo(
    () => buildArchiveHealth({ decodedArchive, liveStatus }),
    [decodedArchive, liveStatus],
  )
  const productionThreshold = Number(signal?.alarmSigmaThreshold)
  const productionThresholdValue = Number.isFinite(productionThreshold) && productionThreshold > 0 ? productionThreshold : 7
  const activeSensitivityThreshold = Number.isFinite(sensitivityThreshold) ? sensitivityThreshold : productionThresholdValue
  const sensitivity = useMemo(
    () => buildSensitivityPreview({
      samples: decodedArchive.samples,
      signal,
      alarmSigmaThreshold: activeSensitivityThreshold,
    }),
    [decodedArchive.samples, signal, activeSensitivityThreshold],
  )

  if (IS_EMBED) return <EmbedView data={data} error={error} />

  if (error && !data) {
    return (
      <>
        <div className="bg-fx" />
        <main className="shell">
          <header className="app-topbar">
            <div className="brand-lockup" aria-label="ApocalypseWatch">
              <img className="brand-mark" src={BRAND_ICON_URL} alt="" width="40" height="40" />
              <span>
                <strong>ApocalypseWatch</strong>
                <small>Business-jet activity dashboard</small>
              </span>
            </div>
            <ThemeControl value={themeMode} onChange={setThemeMode} />
          </header>
          <section className="card error-card">
            <h2>Unable to reach dashboard</h2>
            <p className="error-detail">{error}</p>
            <p className="error-hint">
              Check the configured snapshot source or local API server. No activity reading is available until a valid snapshot arrives.
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
  const cohort = data.cohort ?? data.watchlist ?? null
  const airborne = signal?.actualConcurrentCount ?? liveAircraft.length
  const maxSeats = estimateMaxSeats(liveAircraft, airborne)
  const sourceLabel = liveStatus?.providerLabel ?? 'Source not specified'
  const staleSample = getStaleSample(liveStatus)

  return (
    <>
      <div className="bg-fx" />
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
        <defs>
          <pattern id="severity-pattern-2" width="6" height="6" patternUnits="userSpaceOnUse">
            <rect width="6" height="6" fill="var(--level-2)" />
            <line x1="0" y1="3" x2="6" y2="3" stroke="rgba(0,0,0,0.25)" strokeWidth="1.5" />
          </pattern>
          <pattern id="severity-pattern-3" width="6" height="6" patternUnits="userSpaceOnUse">
            <rect width="6" height="6" fill="var(--level-3)" />
            <circle cx="3" cy="3" r="1.2" fill="rgba(0,0,0,0.3)" />
          </pattern>
          <pattern id="severity-pattern-4" width="6" height="6" patternUnits="userSpaceOnUse">
            <rect width="6" height="6" fill="var(--level-4)" />
            <line x1="0" y1="0" x2="6" y2="6" stroke="rgba(0,0,0,0.25)" strokeWidth="1.5" />
          </pattern>
          <pattern id="severity-pattern-5" width="6" height="6" patternUnits="userSpaceOnUse">
            <rect width="6" height="6" fill="var(--level-5)" />
            <line x1="0" y1="0" x2="6" y2="6" stroke="rgba(0,0,0,0.2)" strokeWidth="1" />
            <line x1="6" y1="0" x2="0" y2="6" stroke="rgba(0,0,0,0.2)" strokeWidth="1" />
          </pattern>
        </defs>
      </svg>
      <a className="skip-link" href="#dashboard-main">Skip to dashboard</a>
      <div className="sr-only" aria-live={emergencyLevel >= 3 ? 'assertive' : 'polite'} aria-atomic="true">
        {levelAnnouncement}
      </div>
      <main className="shell" id="dashboard-main">
        <header className="app-topbar">
          <div className="brand-lockup" aria-label="ApocalypseWatch">
            <img className="brand-mark" src={BRAND_ICON_URL} alt="" width="40" height="40" />
            <span>
              <strong>ApocalypseWatch</strong>
              <small>Business-jet activity dashboard</small>
            </span>
          </div>
          <div className="topbar-actions">
            <a className="export-btn" href="#evidence-packet">Evidence</a>
            <ThemeControl value={themeMode} onChange={setThemeMode} />
          </div>
        </header>

        <section className="page-intro">
          <h1>Business-jet activity, with the evidence in view.</h1>
          <p>Explore the latest snapshot and its historical baseline. This experimental signal is not an emergency warning or a forecast.</p>
        </section>

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

        <div className="row overview-row">
          <EmergencyGauge
            emergencyLevel={emergencyLevel}
            signal={signal}
            airborne={airborne}
            trackedTotal={cohort?.trackedCount}
            maxSeats={maxSeats}
            asOf={data.current?.asOf ?? signal?.asOf}
          />
          <Suspense fallback={<PanelFallback title="Aircraft positions" variant="map" />}>
            <GlobalMap aircraft={liveAircraft} asOf={data.current?.asOf} demo={data.mode === 'demo'} />
          </Suspense>
        </div>

        <div className="row row-2-1 details-row">
          <Hero
            emergencyLevel={emergencyLevel}
            sourceLabel={sourceLabel}
            signal={signal}
            cohort={cohort}
            liveStatus={liveStatus}
            demo={data.mode === 'demo'}
          />
          <AircraftList aircraft={liveAircraft} demo={data.mode === 'demo'} />
        </div>

        <div className="row row-1-1">
          <Suspense fallback={<PanelFallback title="Concurrent Tracked Jets" variant="chart" />}>
            <ArchiveChart archive={archive} signal={signal} />
          </Suspense>
          <AboutCard cohort={cohort} signal={signal} />
        </div>

        <DataGapCalendar health={archiveHealth} />

        <EvidencePacket
          data={data}
          signal={signal}
          emergencyLevel={emergencyLevel}
          archiveHealth={archiveHealth}
          sensitivity={sensitivity}
          lastFetchedAt={lastFetchedAt}
        />

        <SensitivitySandbox
          preview={sensitivity}
          productionEmergencyLevel={emergencyLevel}
          productionThreshold={productionThresholdValue}
          onThresholdChange={setSensitivityThreshold}
        />

        <LevelHistory />

        <footer className="foot">
          <span>ApocalypseWatch v{APP_VERSION}</span>
          <span>{formatTimestamp(liveStatus?.latestSampledAt ?? data.current?.asOf)}</span>
        </footer>
      </main>
    </>
  )
}
