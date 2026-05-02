import { EMERGENCY_LEVELS } from '../lib/constants'
import { formatCount, formatRelative, formatSigma } from '../lib/format'

export function Hero({ emergencyLevel, sourceLabel, signal, cohort, liveStatus }) {
  const cfg = EMERGENCY_LEVELS.find((l) => l.level === emergencyLevel) ?? EMERGENCY_LEVELS[0]
  const sampledAt = liveStatus?.latestSampledAt
  const trackedCount = Number(cohort?.trackedCount)
  const trackedDetail = Number.isFinite(trackedCount) && trackedCount > 0 ? `${formatCount(trackedCount)} tracked` : 'demo sample'
  const metrics = [
    { label: 'Level', value: `${cfg.level}/5`, detail: cfg.label },
    { label: 'Airborne', value: formatCount(signal?.actualConcurrentCount), detail: trackedDetail },
    { label: 'Baseline', value: formatCount(signal?.expectedConcurrentCount), detail: formatSigma(signal?.sigmaShift) },
    { label: 'Sample', value: sampledAt ? formatRelative(sampledAt) : 'Pending', detail: sourceLabel ?? 'ADS-B Exchange' },
  ]

  return (
    <section className="card hero">
      <div className="hero-copy">
        <span className="hero-eyebrow">
          <span className="pulse" />
          Live · {sourceLabel ?? 'ADS-B Exchange'}
        </span>
        <h1 className="hero-title">Apocalypse Watch</h1>
        <p className="hero-caption">
          Tracks a curated business-jet cohort against its rolling baseline. When enough aircraft lift off at
          once, the signal moves toward level 5.
        </p>
        <p className="hero-caption hero-caption--muted">
          Current reading: <strong>Level {cfg.level} — {cfg.label}</strong>. {cfg.tone}.
        </p>
        <div className="hero-metrics" aria-label="Current signal summary">
          {metrics.map((metric) => (
            <div className="hero-metric" key={metric.label}>
              <span>{metric.label}</span>
              <strong>{metric.value}</strong>
              <small>{metric.detail}</small>
            </div>
          ))}
        </div>
        <div className="hero-credits">
          <span>Client by SysAdminDoc</span>
          <span className="sep">/</span>
          <a href="https://github.com/SysAdminDoc/ApocalypseWatch" target="_blank" rel="noreferrer">GitHub</a>
          <span className="sep">/</span>
          <a href="/rss.xml" target="_blank" rel="noreferrer">RSS</a>
          <span className="sep">/</span>
          <span>data: <a href="https://github.com/kylemcdonald/ews" target="_blank" rel="noreferrer">kylemcdonald/ews</a></span>
        </div>
      </div>
      <HeroVisual emergencyLevel={emergencyLevel} signal={signal} />
    </section>
  )
}

function HeroVisual({ emergencyLevel, signal }) {
  const rings = Array.from({ length: 6 }, (_, i) => i)
  const sigma = formatSigma(signal?.sigmaShift)
  return (
    <div className="hero-visual" aria-hidden="true">
      <svg viewBox="-100 -100 200 200" style={{ width: '100%', height: '100%', display: 'block' }}>
        <defs>
          <radialGradient id="hero-fade" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.65" />
            <stop offset="60%" stopColor="var(--accent)" stopOpacity="0.04" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle r="80" fill="url(#hero-fade)" />
        {rings.map((i) => (
          <circle
            key={i}
            r={12 + i * 12}
            fill="none"
            stroke="var(--accent)"
            strokeOpacity={0.28 - i * 0.04}
            strokeWidth={i === emergencyLevel - 1 ? 1.6 : 0.6}
          />
        ))}
        <g className="hero-plane-orbit">
          <path
            d="M0 -42 L9 -7 L34 5 L34 9 L8 4.6 L8 26 L18 33 L18 36 L0 30 L-18 36 L-18 33 L-8 26 L-8 4.6 L-34 9 L-34 5 L-9 -7 Z"
            fill="var(--accent)"
            opacity="0.85"
            style={{ filter: 'drop-shadow(0 0 18px var(--accent-glow))' }}
          />
        </g>
      </svg>
      <div className="hero-visual-readout">
        <span>Signal</span>
        <strong>Level {emergencyLevel}</strong>
        <small>{sigma} from baseline</small>
      </div>
    </div>
  )
}
