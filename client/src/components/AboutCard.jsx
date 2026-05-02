export function AboutCard({ cohort, signal }) {
  return (
    <section className="card about-card">
      <div className="card-header">
        <div className="card-title">How it works</div>
      </div>
      <p>
        A curated cohort of business jets is pulled from the FAA registry. Every 30 minutes the backend ingests
        the latest <strong>ADS-B Exchange</strong> heatmap and counts how many cohort aircraft were airborne in
        that half-hour slot.
      </p>
      <p>
        Each slot is compared to a rolling 24-hour baseline of the same time-of-day windows. Sigma shifts beyond
        the configured threshold escalate the emergency level (1–5).
      </p>
      <details>
        <summary>Technical detail</summary>
        <ul>
          <li>Cohort size: <strong>{cohort?.trackedCount ?? '—'}</strong> aircraft</li>
          <li>Cadence: 30-minute heatmap sweep</li>
          <li>Concurrent expected: <strong>{Math.round(signal?.expectedConcurrentCount ?? 0)}</strong></li>
          <li>Concurrent actual: <strong>{Math.round(signal?.actualConcurrentCount ?? 0)}</strong></li>
          <li>Sigma shift: <strong>{Number(signal?.sigmaShift ?? 0).toFixed(2)}σ</strong></li>
          <li>Alert level: <strong>{signal?.alertLevel ?? 'normal'}</strong></li>
        </ul>
      </details>
      <p style={{ marginTop: 12 }}>
        Original concept and data pipeline by{' '}
        <a href="https://www.instagram.com/kcimc/" target="_blank" rel="noreferrer">Kyle McDonald</a>{' '}
        (<a href="https://github.com/kylemcdonald/ews" target="_blank" rel="noreferrer">kylemcdonald/ews</a>). This frontend is an
        independent redesign by SysAdminDoc.
      </p>
    </section>
  )
}
