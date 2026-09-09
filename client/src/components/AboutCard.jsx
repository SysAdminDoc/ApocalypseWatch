import { formatCount, formatSigma } from '../lib/format'

export function AboutCard({ cohort, signal }) {
  return (
    <section className="card about-card">
      <div className="card-header">
        <div className="card-title">How it works</div>
      </div>
      <p>
        The self-hosted pipeline builds a business-jet cohort from the FAA registry and reads half-hour ADS-B heatmaps.
        A static dashboard instead displays the snapshot supplied by its configured data source.
      </p>
      <p>
        The local model learns time-of-day and weekday patterns from up to 28 days of history. Its sigma deviation
        sets an activity level from 1 to 5. External snapshots may use a different model.
      </p>
      <details>
        <summary>Technical detail</summary>
        <ul>
          <li>Cohort size: <strong>{cohort?.trackedCount ?? '—'}</strong> aircraft</li>
          <li>Cadence: 30-minute heatmap sweep</li>
          <li>Concurrent expected: <strong>{formatCount(signal?.expectedConcurrentCount)}</strong></li>
          <li>Concurrent actual: <strong>{formatCount(signal?.actualConcurrentCount)}</strong></li>
          <li>Sigma shift: <strong>{formatSigma(signal?.sigmaShift)}</strong></li>
          <li>Signal classification: <strong>{signal?.alertLevel ?? 'normal'}</strong></li>
        </ul>
      </details>
      <p className="about-credit">
        Original concept and data pipeline by{' '}
        <a href="https://www.instagram.com/kcimc/" target="_blank" rel="noreferrer">Kyle McDonald</a>{' '}
        (<a href="https://github.com/kylemcdonald/ews" target="_blank" rel="noreferrer">kylemcdonald/ews</a>). This frontend is an
        independent redesign by SysAdminDoc.
      </p>
    </section>
  )
}
