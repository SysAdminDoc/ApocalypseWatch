import { EMERGENCY_LEVELS } from '../lib/constants'
import { formatTimestamp } from '../lib/format'

import { deriveSignal, deriveEmergencyLevel } from '../lib/signal.js'

export function EmbedView({ data, error }) {
  if (!data) return <div className="embed-widget" role="status">{error ? 'Snapshot unavailable. No activity reading.' : 'Loading snapshot...'}</div>
  const level = deriveEmergencyLevel(deriveSignal(data))
  const info = EMERGENCY_LEVELS[level - 1] ?? EMERGENCY_LEVELS[0]
  const asOf = data?.current?.asOf ?? data?.liveStatus?.latestSampledAt
  const airborne = data?.current?.concurrentCount

  return (
    <div className="embed-widget" data-emergency={level} style={{ '--accent': `var(--level-${level})` }}>
      <div className="embed-level">{level}</div>
      <div className="embed-body">
        <div className="embed-title">Level {level}: {info?.label}</div>
        <div className="embed-meta">
          {data.mode === 'demo' ? 'Synthetic demo · ' : ''}
          {airborne != null ? `${airborne} airborne` : ''}
          {asOf ? ` · ${formatTimestamp(asOf)}` : ''}
        </div>
        <small className="embed-disclaimer">Experimental activity signal, not an emergency warning.</small>
        {error ? <small role="status">Refresh delayed. Showing the last snapshot.</small> : null}
      </div>
    </div>
  )
}
