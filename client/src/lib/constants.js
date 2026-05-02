export const DASHBOARD_POLL_INTERVAL_MS = 60_000

export const EMERGENCY_LEVELS = [
  { level: 1, label: 'Calm', tone: 'Nominal baseline' },
  { level: 2, label: 'Watch', tone: 'Mild elevation' },
  { level: 3, label: 'Alert', tone: 'Notable deviation' },
  { level: 4, label: 'Severe', tone: 'Significant anomaly' },
  { level: 5, label: 'Critical', tone: 'Apocalypse signal' },
]

export const RANGE_OPTIONS = [
  { id: '24h', label: '24h', days: 1 },
  { id: '7d', label: '7d', days: 7 },
  { id: '30d', label: '30d', days: 30 },
  { id: '365d', label: '1y', days: 365 },
]

export const DASHBOARD_URL =
  import.meta.env.VITE_DASHBOARD_URL ?? '/api/dashboard'
