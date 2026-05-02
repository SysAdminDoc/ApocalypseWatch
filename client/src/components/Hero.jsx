import { EMERGENCY_LEVELS } from '../lib/constants'

export function Hero({ emergencyLevel, sourceLabel }) {
  const cfg = EMERGENCY_LEVELS.find((l) => l.level === emergencyLevel) ?? EMERGENCY_LEVELS[0]

  return (
    <section className="card hero">
      <div className="hero-copy">
        <span className="hero-eyebrow">
          <span className="pulse" />
          Live · {sourceLabel ?? 'ADS-B Exchange'}
        </span>
        <h1 className="hero-title">Apocalypse Watch</h1>
        <p className="hero-caption">
          A realtime dashboard tracking a curated cohort of business jets. If a meaningful number of those
          aircraft suddenly take to the skies relative to a rolling 24-hour baseline, this dial moves toward 5.
          The premise: people with private-jet access tend to leave city centers fast in a crisis.
        </p>
        <p className="hero-caption" style={{ color: 'var(--text-tertiary)' }}>
          Current reading: <strong style={{ color: 'var(--accent)' }}>Level {cfg.level} — {cfg.label}</strong>.
          {' '}{cfg.tone}.
        </p>
        <div className="hero-credits">
          <span>Redesigned client by SysAdminDoc</span>
          <span className="sep">/</span>
          <a href="https://github.com/SysAdminDoc/ApocalypseWatch" target="_blank" rel="noreferrer">GitHub</a>
          <span className="sep">/</span>
          <a href="/rss.xml" target="_blank" rel="noreferrer">RSS</a>
          <span className="sep">/</span>
          <span>data: <a href="https://github.com/kylemcdonald/ews" target="_blank" rel="noreferrer">kylemcdonald/ews</a></span>
        </div>
      </div>
      <HeroVisual emergencyLevel={emergencyLevel} />
    </section>
  )
}

function HeroVisual({ emergencyLevel }) {
  const rings = Array.from({ length: 6 }, (_, i) => i)
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
    </div>
  )
}
