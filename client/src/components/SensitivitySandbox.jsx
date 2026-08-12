import { formatSigma, formatTimestamp } from '../lib/format'

const MIN_THRESHOLD = 1.5
const MAX_THRESHOLD = 12
const STEP = 0.5

function levelColor(level) {
  return `var(--level-${level})`
}

function formatThreshold(value) {
  return Number.isFinite(value) ? `${value.toFixed(1)}σ` : '—'
}

export function SensitivitySandbox({ preview, productionEmergencyLevel, productionThreshold, onThresholdChange }) {
  const hasSamples = preview.scoredSamples > 0
  const delta = preview.currentLevel - productionEmergencyLevel
  const deltaLabel = delta === 0 ? 'same as live' : delta > 0 ? `${delta} level${delta === 1 ? '' : 's'} higher` : `${Math.abs(delta)} level${Math.abs(delta) === 1 ? '' : 's'} lower`

  return (
    <section className="card sensitivity-card" aria-labelledby="sensitivity-title">
      <div className="card-header">
        <div>
          <div className="card-title" id="sensitivity-title">Sensitivity sandbox</div>
          <div className="sensitivity-subtitle">Model preview · production signal unchanged</div>
        </div>
        <div className="card-eyebrow">{preview.scoredSamples.toLocaleString()} scored samples</div>
      </div>

      <p className="sensitivity-intro">
        Move the alarm threshold to see how the current reading and archive would map to emergency levels. This is a
        what-if view only; it never changes the live dial, alerts, or stored history.
      </p>

      <div className="sensitivity-control">
        <div className="sensitivity-control-head">
          <label htmlFor="sensitivity-threshold">Alarm threshold</label>
          <output htmlFor="sensitivity-threshold">{formatThreshold(preview.alarmSigmaThreshold)}</output>
        </div>
        <input
          id="sensitivity-threshold"
          type="range"
          min={MIN_THRESHOLD}
          max={MAX_THRESHOLD}
          step={STEP}
          value={preview.alarmSigmaThreshold}
          onChange={(event) => onThresholdChange(Number(event.target.value))}
          aria-describedby="sensitivity-help"
        />
        <div className="sensitivity-range" aria-hidden="true">
          <span>{MIN_THRESHOLD.toFixed(1)}σ · more sensitive</span>
          <span>{MAX_THRESHOLD.toFixed(1)}σ · less sensitive</span>
        </div>
        <p id="sensitivity-help" className="sensitivity-help">
          Lower thresholds escalate sooner. The production threshold is {formatThreshold(productionThreshold)}.
        </p>
      </div>

      <div className="sensitivity-results" aria-live="polite">
        <div className="sensitivity-result sensitivity-result--preview">
          <span>Preview now</span>
          <strong style={{ color: levelColor(preview.currentLevel) }}>Level {preview.currentLevel}</strong>
          <small>{formatSigma(preview.currentSigmaShift)} · {deltaLabel}</small>
        </div>
        <div className="sensitivity-result">
          <span>Live dial</span>
          <strong style={{ color: levelColor(productionEmergencyLevel) }}>Level {productionEmergencyLevel}</strong>
          <small>unchanged production reading</small>
        </div>
        <div className="sensitivity-result">
          <span>Archive peak</span>
          <strong style={{ color: levelColor(preview.peak.level) }}>Level {preview.peak.level}</strong>
          <small>{formatSigma(preview.peak.sigmaShift)}{preview.peak.at ? ` · ${formatTimestamp(preview.peak.at)}` : ''}</small>
        </div>
      </div>

      <div className="sensitivity-distribution" aria-label="Historical sample distribution by preview emergency level">
        <div className="sensitivity-distribution-head">
          <span>Historical preview distribution</span>
          <span>{hasSamples ? 'Each segment is a scored archive sample' : 'No archive samples have model metadata'}</span>
        </div>
        <div className="sensitivity-bar" role="img" aria-label={hasSamples ? Object.entries(preview.levelCounts).map(([level, count]) => `Level ${level}: ${count}`).join('; ') : 'No scored archive samples'}>
          {[1, 2, 3, 4, 5].map((level) => {
            const count = preview.levelCounts[level] ?? 0
            const width = preview.scoredSamples ? (count / preview.scoredSamples) * 100 : 0
            return <span key={level} className={`sensitivity-bar-segment sensitivity-bar-segment--${level}`} style={{ width: `${width}%` }} title={`Level ${level}: ${count}`} />
          })}
        </div>
        <div className="sensitivity-legend">
          {[1, 2, 3, 4, 5].map((level) => (
            <span key={level}><i className={`sensitivity-swatch sensitivity-swatch--${level}`} aria-hidden="true" />L{level} {preview.levelCounts[level] ?? 0}</span>
          ))}
        </div>
      </div>
    </section>
  )
}
