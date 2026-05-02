import { useEffect, useMemo, useState } from 'react'
import { geoNaturalEarth1, geoPath, geoGraticule10 } from 'd3-geo'
import { feature } from 'topojson-client'
import worldData from 'world-atlas/countries-110m.json'
import { formatTimestamp } from '../lib/format'

const WIDTH = 980
const HEIGHT = 480

function makeProjection() {
  const projection = geoNaturalEarth1()
  projection.fitExtent([[14, 14], [WIDTH - 14, HEIGHT - 14]], { type: 'Sphere' })
  return projection
}

function toFiniteNumber(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function projectAircraftPoint(aircraft, projection) {
  const lat = toFiniteNumber(aircraft?.lat)
  const lon = toFiniteNumber(aircraft?.lon)
  if (lat === null || lon === null || lat < -90 || lat > 90 || lon < -180 || lon > 180) return null

  const xy = projection([lon, lat])
  if (!xy || !Number.isFinite(xy[0]) || !Number.isFinite(xy[1])) return null

  return {
    id: aircraft.hex ?? aircraft.registration ?? aircraft.callsign ?? `${lat},${lon}`,
    x: xy[0],
    y: xy[1],
    rotation: Number.isFinite(Number(aircraft?.track)) ? Number(aircraft.track) : 0,
    callsign: aircraft.callsign ?? aircraft.registration ?? aircraft.hex ?? '—',
    model: aircraft.label ?? aircraft.modelLabel ?? aircraft.model ?? '',
    altitude: toFiniteNumber(aircraft.altitudeFt ?? aircraft.altitude),
  }
}

export function GlobalMap({ aircraft = [], asOf, onAirborneCount }) {
  const [projection] = useState(() => makeProjection())
  const path = useMemo(() => geoPath(projection), [projection])

  const land = useMemo(() => feature(worldData, worldData.objects.countries), [])
  const graticule = useMemo(() => geoGraticule10(), [])

  const { points, droppedCount } = useMemo(() => {
    const source = Array.isArray(aircraft) ? aircraft : []
    const visible = []
    let dropped = 0

    for (const item of source) {
      const point = projectAircraftPoint(item, projection)
      if (point) {
        visible.push(point)
      } else {
        dropped += 1
      }
    }

    return { points: visible, droppedCount: dropped }
  }, [aircraft, projection])

  useEffect(() => {
    onAirborneCount?.(points.length)
  }, [points.length, onAirborneCount])

  return (
    <section className="card map-card">
      <div className="card-header">
        <div className="card-title">Realtime Tracker</div>
        <div className="map-meta">
          {points.length} aircraft visible{droppedCount ? ` · ${droppedCount} hidden` : ''} · {formatTimestamp(asOf)}
        </div>
      </div>
      <div className="map-frame">
        <p className="sr-only">
          {points.length} aircraft have valid map positions.
          {droppedCount ? ` ${droppedCount} aircraft are hidden because their coordinates are invalid.` : ''}
        </p>
        <svg className="map-svg" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label="Global aircraft positions">
          <defs>
            <radialGradient id="ocean-tint" cx="50%" cy="60%" r="60%">
              <stop offset="0%" stopColor="rgba(80,140,240,0.18)" />
              <stop offset="100%" stopColor="rgba(0,0,0,0)" />
            </radialGradient>
            <filter id="aircraft-glow" x="-200%" y="-200%" width="500%" height="500%">
              <feGaussianBlur stdDeviation="2.4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <path d={path({ type: 'Sphere' })} className="map-sphere" />
          <rect x="0" y="0" width={WIDTH} height={HEIGHT} fill="url(#ocean-tint)" pointerEvents="none" />
          <path d={path(graticule)} className="map-graticule" />
          <path d={path(land)} className="map-land" />

          <g filter="url(#aircraft-glow)">
            {points.map((p) => (
              <g key={p.id} transform={`translate(${p.x} ${p.y})`}>
                <circle r={6} className="map-aircraft-halo" />
                <g transform={`rotate(${p.rotation})`}>
                  <path
                    className="map-aircraft"
                    d="M0 -5 L1.4 -0.8 L4.6 0.6 L4.6 1.6 L1.2 1.1 L1.2 3.6 L2.4 4.6 L2.4 5.2 L0 4.4 L-2.4 5.2 L-2.4 4.6 L-1.2 3.6 L-1.2 1.1 L-4.6 1.6 L-4.6 0.6 L-1.4 -0.8 Z"
                  />
                </g>
                <title>
                  {p.callsign}{p.model ? ` · ${p.model}` : ''}{Number.isFinite(p.altitude) ? ` · ${Math.round(p.altitude).toLocaleString()} ft` : ''}
                </title>
              </g>
            ))}
          </g>
        </svg>
        <div className="map-legend">
          <span className="map-legend-dot" /> tracked private jet · live position
        </div>
      </div>
    </section>
  )
}
