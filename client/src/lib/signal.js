export function finiteNumber(value) {
  if (value === null || value === undefined || typeof value === 'boolean' || String(value).trim() === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

export function deriveSignal(dashboard) {
  if (!dashboard) return null
  return dashboard.signals?.composite ?? {
    asOf: dashboard.current?.asOf,
    actualConcurrentCount: dashboard.current?.concurrentCount,
    expectedConcurrentCount: dashboard.current?.baselineMean,
    expectedConcurrentStdDev: dashboard.current?.baselineStdDev,
    sigmaShift: dashboard.current?.zScore,
    alertLevel: dashboard.current?.alertLevel,
    emergencyLevel: dashboard.current?.emergencyLevel,
    alarmSigmaThreshold: dashboard.current?.alarmSigmaThreshold,
  }
}

export function deriveEmergencyLevel(signal) {
  const supplied = finiteNumber(signal?.emergencyLevel)
  if (supplied !== null && supplied >= 1 && supplied <= 5) return Math.round(supplied)
  const sigma = finiteNumber(signal?.sigmaShift)
  const threshold = finiteNumber(signal?.alarmSigmaThreshold) ?? 7
  if (sigma === null || threshold <= 0) return 1
  if (sigma >= threshold) return 5
  return Math.min(4, Math.max(1, Math.floor(Math.max(0, sigma) / threshold * 4) + 1))
}

export function isLocalApi(dashboardUrl) {
  return /^\/api\/dashboard(?:\?|$)/.test(dashboardUrl)
}

export function validateDashboard(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      !value.current || !Array.isArray(value.liveAircraft) || !value.trends ||
      (!Array.isArray(value.trends.archive) && value.trends.archive?.v !== 1)) {
    throw new Error('The data source did not return a supported dashboard snapshot.')
  }
  const signal = deriveSignal(value)
  if (finiteNumber(signal?.actualConcurrentCount) === null ||
      (finiteNumber(signal?.emergencyLevel) === null && finiteNumber(signal?.sigmaShift) === null)) {
    throw new Error('The snapshot is missing its activity reading.')
  }
  return value
}
