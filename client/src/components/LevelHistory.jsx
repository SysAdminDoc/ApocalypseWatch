import { useEffect, useState } from 'react'
import { DASHBOARD_URL, EMERGENCY_LEVELS } from '../lib/constants'
import { formatTimestamp } from '../lib/format'
import { isLocalApi } from '../lib/signal.js'

function resolveEventsUrl() {
  if (!isLocalApi(DASHBOARD_URL)) return null
  return '/api/events?limit=50'
}

export function LevelHistory() {
  const [transitions, setTransitions] = useState([])
  const [error, setError] = useState(null)
  const eventsUrl = resolveEventsUrl()

  useEffect(() => {
    if (!eventsUrl) return
    const controller = new AbortController()
    fetch(eventsUrl, { signal: controller.signal })
      .then((r) => { if (!r.ok) throw new Error('History request failed.'); return r.json() })
      .then((data) => { if (data?.transitions) setTransitions(data.transitions) })
      .catch((err) => { if (err.name !== 'AbortError') setError('Activity history is unavailable.') })
    return () => controller.abort()
  }, [eventsUrl])

  if (!eventsUrl) return null
  if (error) return <p className="history-error" role="status">{error}</p>
  if (transitions.length === 0) return null

  return (
    <section className="card level-history-card">
      <div className="card-header">
        <div className="card-title">Level Transitions</div>
        <div className="level-history-meta">Recent {transitions.length}</div>
      </div>
      <div className="level-history-list" role="log" aria-label="Activity level transitions">
        {transitions.map((t) => {
          const toInfo = EMERGENCY_LEVELS[t.to_level - 1] ?? EMERGENCY_LEVELS[0]
          const direction = t.to_level > t.from_level ? '▲' : '▼'
          return (
            <div key={t.id} className="level-history-item">
              <span className="level-history-time">{formatTimestamp(t.transitioned_at)}</span>
              <span className="level-history-badge" style={{ '--badge-color': `var(--level-${t.to_level})` }}>
                {direction} Level {t.from_level} → {t.to_level}
              </span>
              <span className="level-history-label">{toInfo?.label}</span>
              {t.sigma_shift != null ? (
                <span className="level-history-sigma">{Number(t.sigma_shift).toFixed(1)}σ</span>
              ) : null}
            </div>
          )
        })}
      </div>
    </section>
  )
}
