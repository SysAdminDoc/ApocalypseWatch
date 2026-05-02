import { EMERGENCY_LEVELS } from '../lib/constants'
import { formatCount, formatDelta, formatSigma, formatTimestamp } from '../lib/format'

const SIZE = 400
const VIEWBOX_HEIGHT = 360
const CENTER = SIZE / 2
const RADIUS = 150
const STROKE = 22
const START_ANGLE = -210 // degrees
const END_ANGLE = 30
const SWEEP = END_ANGLE - START_ANGLE // 240

function polarToCartesian(angleDeg, r = RADIUS) {
  const rad = (angleDeg - 90) * (Math.PI / 180)
  return { x: CENTER + r * Math.cos(rad), y: CENTER + r * Math.sin(rad) }
}

function describeArc(startAngle, endAngle, r = RADIUS) {
  const start = polarToCartesian(endAngle, r)
  const end = polarToCartesian(startAngle, r)
  const largeArc = endAngle - startAngle <= 180 ? 0 : 1
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`
}

export function EmergencyGauge({
  emergencyLevel = 1,
  signal,
  airborne,
  trackedTotal,
  maxSeats,
  asOf,
}) {
  const cfg = EMERGENCY_LEVELS.find((l) => l.level === emergencyLevel) ?? EMERGENCY_LEVELS[0]
  const segmentSweep = SWEEP / 5
  const needleAngle = START_ANGLE + segmentSweep * (emergencyLevel - 0.5)
  const needleEnd = polarToCartesian(needleAngle, RADIUS - 18)
  const needleStart = polarToCartesian(needleAngle, 30)

  const expected = signal?.expectedConcurrentCount
  const actual = signal?.actualConcurrentCount
  const deviation = (Number.isFinite(actual) && Number.isFinite(expected)) ? actual - expected : null

  return (
    <section className="card card--accent gauge">
      <div className="card-header">
        <div className="card-title">Emergency Level</div>
        <div className="card-eyebrow">{formatTimestamp(asOf)}</div>
      </div>

      <div className="gauge-svg-wrap">
        <svg className="gauge-svg" viewBox={`0 0 ${SIZE} ${VIEWBOX_HEIGHT}`} role="img"
             aria-label={`Emergency level ${emergencyLevel} of 5`}>
          <path className="gauge-arc-bg" d={describeArc(START_ANGLE, END_ANGLE)} strokeWidth={STROKE} />

          {EMERGENCY_LEVELS.map((_, i) => {
            const a0 = START_ANGLE + segmentSweep * i + 1
            const a1 = START_ANGLE + segmentSweep * (i + 1) - 1
            const isActive = i + 1 <= emergencyLevel
            return (
              <path
                key={i}
                className={`gauge-arc-segment gauge-arc-segment--${i + 1} ${isActive ? '' : 'is-dim'}`}
                d={describeArc(a0, a1)}
                strokeWidth={STROKE}
              />
            )
          })}

          {Array.from({ length: 6 }, (_, i) => {
            const a = START_ANGLE + segmentSweep * i
            const inner = polarToCartesian(a, RADIUS - STROKE - 4)
            const outer = polarToCartesian(a, RADIUS - STROKE - 14)
            return (
              <line key={i} className="gauge-tick" x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y} />
            )
          })}

          {[1, 2, 3, 4, 5].map((n) => {
            const a = START_ANGLE + segmentSweep * (n - 0.5)
            const p = polarToCartesian(a, RADIUS - STROKE - 28)
            return (
              <text
                key={n}
                x={p.x}
                y={p.y}
                className={`gauge-tick-label ${n <= emergencyLevel ? 'is-active' : ''}`}
                textAnchor="middle"
                dominantBaseline="middle"
                fontFamily="var(--font-mono)"
                fontSize="14"
                fontWeight="600"
              >
                {n}
              </text>
            )
          })}

          <line
            className="gauge-needle"
            x1={needleStart.x}
            y1={needleStart.y}
            x2={needleEnd.x}
            y2={needleEnd.y}
          />
          <circle className="gauge-needle-hub" cx={CENTER} cy={CENTER} r={6} />
        </svg>
      </div>

      <div className="gauge-readout">
        <div className="gauge-level">
          {emergencyLevel}
          <small> /5</small>
        </div>
        <div className="gauge-status-block">
          <span className="gauge-status">{cfg.label}</span>
          <span>{cfg.tone}</span>
        </div>
      </div>

      <div className="gauge-stats">
        <div className="stat">
          <span className="stat-label">Airborne</span>
          <span className="stat-value">
            {formatCount(airborne)}
            <span className="unit">/ {formatCount(trackedTotal)}</span>
          </span>
          <span className="stat-sub">tracked private jets aloft</span>
        </div>
        <div className="stat">
          <span className="stat-label">Max people aloft</span>
          <span className="stat-value">{formatCount(maxSeats)}</span>
          <span className="stat-sub">capacity-weighted estimate</span>
        </div>
        <div className="stat">
          <span className="stat-label">Deviation</span>
          <span className="stat-value">
            {formatDelta(deviation)}
          </span>
          <span className={`stat-sub ${(deviation ?? 0) > 0 ? 'up' : 'down'}`}>
            {formatSigma(signal?.sigmaShift)} from baseline
          </span>
        </div>
        <div className="stat">
          <span className="stat-label">Baseline</span>
          <span className="stat-value">{formatCount(expected)}</span>
          <span className="stat-sub">expected at this hour</span>
        </div>
      </div>
    </section>
  )
}
