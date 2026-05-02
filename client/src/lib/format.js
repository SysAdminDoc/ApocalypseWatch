export function formatCount(value) {
  const n = Number(value)
  if (value === null || value === undefined || !Number.isFinite(n)) return '—'
  return Math.round(n).toLocaleString()
}

export function formatDelta(value) {
  const n = Number(value)
  if (value === null || value === undefined || !Number.isFinite(n)) return '—'
  const sign = n > 0 ? '+' : n < 0 ? '' : ''
  return `${sign}${Math.round(n).toLocaleString()}`
}

export function formatSigma(value) {
  const n = Number(value)
  if (value === null || value === undefined || !Number.isFinite(n)) return '—'
  const sign = n >= 0 ? '+' : ''
  return `${sign}${n.toFixed(1)}σ`
}

export function formatTimestamp(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  })
}

export function formatRelative(value) {
  if (!value) return '—'
  const d = new Date(value)
  const diff = Date.now() - d.getTime()
  if (Number.isNaN(diff)) return '—'
  const m = Math.round(diff / 60_000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}h ago`
  const days = Math.round(h / 24)
  return `${days}d ago`
}

export function formatDuration(value) {
  const ms = Number(value)
  if (!Number.isFinite(ms) || ms <= 0) return 'soon'
  const totalSeconds = Math.ceil(ms / 1000)
  if (totalSeconds < 60) return `${totalSeconds}s`
  const minutes = Math.ceil(totalSeconds / 60)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.ceil(minutes / 60)
  return `${hours}h`
}

export function formatAltitude(value) {
  const n = Number(value)
  if (value === null || value === undefined || !Number.isFinite(n)) return '—'
  return `${Math.round(n).toLocaleString()} ft`
}

export function formatSpeed(value) {
  const n = Number(value)
  if (value === null || value === undefined || !Number.isFinite(n)) return '—'
  return `${Math.round(n)} kt`
}

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}
