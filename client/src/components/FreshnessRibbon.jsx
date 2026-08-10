import { useMemo } from 'react'

const DEFAULT_CADENCE_MS = 30 * 60_000

/**
 * Compute a 0-100 freshness confidence score from multiple signals:
 * - Sample age relative to cadence (40% weight)
 * - Provider error state (25% weight)
 * - Archive validity / sample count (20% weight)
 * - Last successful poll recency (15% weight)
 */
function computeFreshness({ liveStatus, archiveSampleCount, lastFetchedAt }) {
  let score = 100

  // 1. Sample age (40 points)
  const sampledAt = liveStatus?.latestSampledAt
  if (sampledAt) {
    const ageMs = Date.now() - Date.parse(sampledAt)
    const cadenceMs = Math.max(1, Number(liveStatus?.cadenceMinutes ?? 30)) * 60_000
    const ageRatio = ageMs / cadenceMs
    if (ageRatio <= 1.0) score -= 0
    else if (ageRatio <= 1.5) score -= 10
    else if (ageRatio <= 2.0) score -= 20
    else if (ageRatio <= 3.0) score -= 30
    else score -= 40
  } else {
    score -= 40
  }

  // 2. Provider errors (25 points)
  if (liveStatus?.lastError) {
    score -= 25
  }

  // 3. Archive validity (20 points)
  if (archiveSampleCount != null) {
    if (archiveSampleCount >= 24) score -= 0
    else if (archiveSampleCount >= 12) score -= 5
    else if (archiveSampleCount >= 1) score -= 12
    else score -= 20
  } else {
    score -= 10
  }

  // 4. Last successful fetch recency (15 points)
  if (lastFetchedAt) {
    const fetchAge = Date.now() - lastFetchedAt.getTime()
    if (fetchAge > 5 * 60_000) score -= 8
    if (fetchAge > 15 * 60_000) score -= 15
  } else {
    score -= 15
  }

  return Math.max(0, Math.min(100, score))
}

function freshnessGrade(score) {
  if (score >= 90) return { label: 'Excellent', className: 'freshness--excellent' }
  if (score >= 70) return { label: 'Good', className: 'freshness--good' }
  if (score >= 45) return { label: 'Degraded', className: 'freshness--degraded' }
  return { label: 'Stale', className: 'freshness--stale' }
}

export function FreshnessRibbon({ liveStatus, archiveSampleCount, lastFetchedAt }) {
  const score = useMemo(
    () => computeFreshness({ liveStatus, archiveSampleCount, lastFetchedAt }),
    [liveStatus, archiveSampleCount, lastFetchedAt],
  )
  const grade = freshnessGrade(score)

  return (
    <div
      className={`freshness-ribbon ${grade.className}`}
      role="status"
      aria-label={`Data freshness: ${grade.label} (${score}%)`}
      title={`Data freshness: ${score}% — ${grade.label}`}
    >
      <div className="freshness-bar" style={{ '--freshness-pct': `${score}%` }} />
      <span className="freshness-label">{grade.label}</span>
      <span className="freshness-score">{score}%</span>
    </div>
  )
}
