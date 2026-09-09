export const DASHBOARD_POLL_INTERVAL_MS = 60_000

export const EMERGENCY_LEVELS = [
  { level: 1, label: 'Baseline', tone: 'Below the first deviation band' },
  { level: 2, label: 'Watch', tone: 'Mild elevation' },
  { level: 3, label: 'Elevated', tone: 'Notable activity deviation' },
  { level: 4, label: 'High', tone: 'Large activity deviation' },
  { level: 5, label: 'Threshold', tone: 'Configured activity threshold reached' },
]

export const RANGE_OPTIONS = [
  { id: '24h', label: '24h', days: 1 },
  { id: '7d', label: '7d', days: 7 },
  { id: '30d', label: '30d', days: 30 },
  { id: '365d', label: '1y', days: 365 },
]

const clientEnv = import.meta.env ?? {}

export const DASHBOARD_URL =
  clientEnv.VITE_DASHBOARD_URL ?? '/api/dashboard'

export const BRAND_ICON_URL = `${clientEnv.BASE_URL ?? '/'}favicon.svg`
export const RSS_URL = clientEnv.VITE_RSS_URL || (DASHBOARD_URL === '/api/dashboard' ? '/rss.xml' : null)
