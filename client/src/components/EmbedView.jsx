import { useDashboard } from '../hooks/useDashboard'
import { EMERGENCY_LEVELS } from '../lib/constants'
import { formatTimestamp } from '../lib/format'

function deriveLevel(dashboard) {
  const lvl = Number(dashboard?.current?.emergencyLevel ?? dashboard?.signals?.composite?.emergencyLevel)
  if (Number.isFinite(lvl) && lvl >= 1 && lvl <= 5) return Math.round(lvl)
  return 1
}

export function EmbedView() {
  const { data } = useDashboard()
  const level = data ? deriveLevel(data) : 1
  const info = EMERGENCY_LEVELS[level - 1] ?? EMERGENCY_LEVELS[0]
  const asOf = data?.current?.asOf ?? data?.liveStatus?.latestSampledAt
  const airborne = data?.current?.concurrentCount

  return (
    <div
      className="embed-widget"
      data-emergency={level}
      style={{
        '--accent': `var(--level-${level})`,
        fontFamily: 'Inter, system-ui, sans-serif',
        background: 'var(--surface-base)',
        color: 'var(--text-primary)',
        padding: '16px 20px',
        borderRadius: '12px',
        border: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
        maxWidth: '360px',
        minHeight: '72px',
      }}
    >
      <div
        style={{
          width: '44px',
          height: '44px',
          borderRadius: '50%',
          background: `color-mix(in srgb, var(--accent) 18%, var(--surface-glass))`,
          border: `2px solid var(--accent)`,
          display: 'grid',
          placeItems: 'center',
          fontSize: '18px',
          fontWeight: 700,
          color: 'var(--accent)',
          flexShrink: 0,
        }}
      >
        {level}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: '14px' }}>
          Level {level} — {info?.label}
        </div>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
          {airborne != null ? `${airborne} airborne` : ''}
          {asOf ? ` · ${formatTimestamp(asOf)}` : ''}
        </div>
      </div>
    </div>
  )
}
