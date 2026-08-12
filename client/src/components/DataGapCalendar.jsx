import { formatTimestamp } from '../lib/format'

const STATUS_LABELS = {
  complete: 'Complete',
  partial: 'Partial',
  missing: 'Missing',
  delayed: 'Delayed',
  malformed: 'Malformed',
  empty: 'Outside archive window',
}

const STATUS_ORDER = ['complete', 'partial', 'missing', 'delayed', 'malformed']

function coveragePercent(ratio) {
  return Number.isFinite(ratio) ? `${Math.round(ratio * 100)}%` : 'n/a'
}

function cellLabel(day) {
  const status = STATUS_LABELS[day.status] ?? 'Unknown'
  return `${day.label}: ${status}; ${day.count} of ${day.expected} expected half-hour samples.`
}

export function DataGapCalendar({ health }) {
  if (!health) return null

  const firstDay = health.calendar.length ? new Date(`${health.calendar[0].key}T00:00:00Z`).getUTCDay() : 0
  const paddedDays = [
    ...Array.from({ length: firstDay }, () => null),
    ...health.calendar,
  ]
  const latest = health.latestSampleAt ? formatTimestamp(health.latestSampleAt) : 'No valid samples'
  const malformedDetail = health.malformed
    ? ` Archive validation found ${health.intervalIssueCount + health.duplicateSampleCount} timestamp issue${health.intervalIssueCount + health.duplicateSampleCount === 1 ? '' : 's'}${health.issue ? `: ${health.issue}` : '.'}`
    : ''

  return (
    <section className="card coverage-card" aria-labelledby="coverage-title">
      <div className="card-header">
        <div>
          <div className="card-title" id="coverage-title">Data coverage</div>
          <div className="coverage-subtitle">365-day half-hour archive health</div>
        </div>
        <div className="coverage-score" aria-label={`Archive coverage ${coveragePercent(health.coverageRatio)}`}>
          <strong>{coveragePercent(health.coverageRatio)}</strong>
          <span>covered</span>
        </div>
      </div>

      <p className="coverage-intro">
        Each cell is one UTC day. A partial or missing cell means the archive has fewer samples than its expected
        cadence; delayed and malformed cells are called out separately so a quiet reading is not mistaken for a
        healthy feed.{malformedDetail}
      </p>

      <div className="coverage-stats" aria-label="Archive coverage summary">
        <div><strong>{health.observedSlots.toLocaleString()}</strong><span>observed slots</span></div>
        <div><strong>{health.missingSlots.toLocaleString()}</strong><span>missing slots</span></div>
        <div><strong>{health.completeDays}</strong><span>complete days</span></div>
        <div><strong>{health.partialDays + health.missingDays}</strong><span>gap days</span></div>
        <div><strong>{health.delayed ? 'Yes' : 'No'}</strong><span>latest delayed</span></div>
      </div>

      <div className="coverage-grid-wrap">
        <div className="coverage-weekdays" aria-hidden="true">
          <span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span>
        </div>
        <div className="coverage-grid" role="grid" aria-label="Daily archive coverage for the last 365 days">
          {paddedDays.map((day, index) => day ? (
            <div
              className={`coverage-cell coverage-cell--${day.status}`}
              key={day.key}
              role="gridcell"
              aria-label={cellLabel(day)}
              title={cellLabel(day)}
            />
          ) : (
            <div className="coverage-cell coverage-cell--empty" key={`padding-${index}`} aria-hidden="true" />
          ))}
        </div>
      </div>

      <div className="coverage-footer">
        <div className="coverage-legend" aria-label="Coverage legend">
          {STATUS_ORDER.map((status) => (
            <span key={status}>
              <i className={`coverage-swatch coverage-swatch--${status}`} aria-hidden="true" />
              {STATUS_LABELS[status]}
            </span>
          ))}
        </div>
        <span className="coverage-latest">Latest valid sample: {latest}</span>
      </div>
    </section>
  )
}
