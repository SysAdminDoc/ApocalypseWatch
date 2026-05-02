import { useMemo } from 'react'
import { formatAltitude, formatSpeed } from '../lib/format'

function PlaneIcon() {
  return (
    <svg width="18" height="18" viewBox="-10 -10 20 20" aria-hidden="true">
      <path
        d="M0 -8 L2 -1.4 L7.4 0.8 L7.4 2.6 L1.6 1.6 L1.6 5.6 L3.8 7 L3.8 8 L0 6.6 L-3.8 8 L-3.8 7 L-1.6 5.6 L-1.6 1.6 L-7.4 2.6 L-7.4 0.8 L-2 -1.4 Z"
        fill="currentColor"
        transform="rotate(45)"
      />
    </svg>
  )
}

export function AircraftList({ aircraft = [] }) {
  const sorted = useMemo(() => {
    const source = Array.isArray(aircraft) ? aircraft : []
    return source
      .map((a) => ({
        ...a,
        _alt: Number(a.altitudeFt ?? a.altitude ?? 0),
        _spd: Number(a.groundSpeedKt ?? a.speed ?? a.groundSpeed ?? 0),
      }))
      .filter((a) => Number.isFinite(a._alt) && a._alt > 0)
      .sort((a, b) => b._alt - a._alt)
      .slice(0, 60)
  }, [aircraft])

  return (
    <section className="card">
      <div className="card-header">
        <div className="card-title">Live Aircraft</div>
        <div className="card-eyebrow">{Array.isArray(aircraft) ? aircraft.length : 0} airborne</div>
      </div>
      {sorted.length === 0 ? (
        <div className="aircraft-empty">No aircraft currently airborne.</div>
      ) : (
        <ul className="aircraft-list" role="list">
          {sorted.map((a, idx) => (
            <li key={a.hex ?? a.icao24 ?? a.registration ?? a.callsign ?? idx} className="aircraft-row">
              <span className="aircraft-icon"><PlaneIcon /></span>
              <span className="aircraft-meta">
                <span className="aircraft-callsign">
                  {(a.callsign?.trim?.() || a.registration || a.hex || a.icao24 || 'unknown')}
                </span>
                <span className="aircraft-model">{a.label || a.modelLabel || a.model || a.aircraftType || '—'}</span>
              </span>
              <span className="aircraft-stats">
                <span>{formatAltitude(a._alt)}</span>
                <span>{formatSpeed(a._spd)}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
