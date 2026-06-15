import { useDashboard } from '../hooks/useDashboard'
import { EMERGENCY_LEVELS } from '../lib/constants'
import { formatTimestamp } from '../lib/format'

function deriveLevel(dashboard) {
  const lvl = Number(dashboard?.current?.emergencyLevel ?? dashboard?.signals?.composite?.emergencyLevel)
  if (Number.isFinite(lvl) && lvl >= 1 && lvl <= 5) return Math.round(lvl)
  return 1
}

export function EmbedView() {
  const { data } = useDashboard()
  const level = data ? deriveLevel(data) : 1
  const info = EMERGENCY_LEVELS[level - 1] ?? EMERGENCY_LEVELS[0]
  const asOf = data?.current?.asOf ?? data?.liveStatus?.latestSampledAt
  const airborne = data?.current?.concurrentCount

  return (
    <div className="embed-widget" data-emergency={level} style={{ '--accent': `var(--level-${level})` }}>
      <div className="embed-level">{level}</div>
      <div className="embed-body">
        <div className="embed-title">Level {level} — {info?.label}</div>
        <div className="embed-meta">
          {airborne != null ? `${airborne} airborne` : ''}
          {asOf ? ` · ${formatTimestamp(asOf)}` : ''}
        </div>
      </div>
    </div>
  )
}
