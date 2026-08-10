import { useEffect, useMemo, useState } from 'react'
import { useDashboard } from '../hooks/useDashboard'
import { EMERGENCY_LEVELS } from '../lib/constants'
import { formatCount, formatRelative, formatSigma, formatTimestamp } from '../lib/format'
import { FreshnessRibbon } from './FreshnessRibbon'

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

export function WallboardView() {
  const { data, lastFetchedAt } = useDashboard()
  const signal = useMemo(() => deriveSignal(data), [data])
  const emergencyLevel = useMemo(() => deriveEmergencyLevel(signal), [signal])
  const [clock, setClock] = useState(() => new Date())

  useEffect(() => {
    document.documentElement.dataset.emergency = String(emergencyLevel)
  }, [emergencyLevel])

  useEffect(() => {
    const id = setInterval(() => setClock(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  if (!data) {
    return (
      <div className="wallboard" data-emergency={emergencyLevel}>
        <div className="wallboard-loading">Acquiring signal...</div>
      </div>
    )
  }

  const cfg = EMERGENCY_LEVELS.find((l) => l.level === emergencyLevel) ?? EMERGENCY_LEVELS[0]
  const liveStatus = data.liveStatus ?? null
  const cohort = data.cohort ?? data.watchlist ?? null
  const airborne = signal?.actualConcurrentCount ?? data.liveAircraft?.length ?? 0
  const expected = signal?.expectedConcurrentCount
  const archiveSampleCount = Array.isArray(data.trends?.archive) ? data.trends.archive.length : (data.trends?.archive?.c?.length ?? null)

  return (
    <div className="wallboard" data-emergency={emergencyLevel}>
      <div className="wallboard-header">
        <div className="wallboard-brand">ApocalypseWatch</div>
        <div className="wallboard-clock">{clock.toLocaleTimeString()}</div>
      </div>

      <div className="wallboard-center">
        <div className="wallboard-level-ring" style={{ '--ring-color': `var(--level-${emergencyLevel})` }}>
          <span className="wallboard-level-value">{emergencyLevel}</span>
        </div>
        <div className="wallboard-level-label">{cfg.label}</div>
        <div className="wallboard-level-tone">{cfg.tone}</div>
      </div>

      <div className="wallboard-metrics">
        <div className="wallboard-metric">
          <span className="wallboard-metric-label">Airborne</span>
          <span className="wallboard-metric-value">{formatCount(airborne)}</span>
          <span className="wallboard-metric-sub">of {formatCount(cohort?.trackedCount)} tracked</span>
        </div>
        <div className="wallboard-metric">
          <span className="wallboard-metric-label">Baseline</span>
          <span className="wallboard-metric-value">{formatCount(expected)}</span>
          <span className="wallboard-metric-sub">expected now</span>
        </div>
        <div className="wallboard-metric">
          <span className="wallboard-metric-label">Deviation</span>
          <span className="wallboard-metric-value">{formatSigma(signal?.sigmaShift)}</span>
          <span className="wallboard-metric-sub">from baseline</span>
        </div>
        <div className="wallboard-metric">
          <span className="wallboard-metric-label">Last sweep</span>
          <span className="wallboard-metric-value">{formatRelative(liveStatus?.latestSampledAt)}</span>
          <span className="wallboard-metric-sub">{liveStatus?.providerLabel ?? 'ADS-B Exchange'}</span>
        </div>
      </div>

      <div className="wallboard-footer">
        <FreshnessRibbon
          liveStatus={liveStatus}
          archiveSampleCount={archiveSampleCount}
          lastFetchedAt={lastFetchedAt}
        />
        <div className="wallboard-timestamp">
          {formatTimestamp(liveStatus?.latestSampledAt ?? data.current?.asOf)}
        </div>
      </div>
    </div>
  )
}
