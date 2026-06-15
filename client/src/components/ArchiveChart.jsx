import { useEffect, useMemo, useState } from 'react'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts'
import { DASHBOARD_URL, RANGE_OPTIONS } from '../lib/constants'

const DAY_MS = 24 * 60 * 60 * 1000

function toFinite(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function decodeArchive(archive) {
  if (Array.isArray(archive)) {
    const samples = archive
      .map((s) => {
        const t = Date.parse(s?.sampledAt ?? s?.timestamp ?? '')
        const count = toFinite(s?.concurrentCount ?? s?.count)
        const expected = toFinite(s?.predictedConcurrentCount ?? s?.expectedCount)
        const sd = toFinite(s?.stdDev ?? s?.standardDeviation)
        const lower = expected !== null && sd !== null ? Math.max(0, expected - sd) : null
        const bandWidth = expected !== null && sd !== null ? expected + sd - Math.max(0, expected - sd) : null
        return Number.isFinite(t) && count !== null ? { t, count, expected, lower, bandWidth } : null
      })
      .filter(Boolean)
      .sort((a, b) => a.t - b.t)
    return { samples, issue: null }
  }

  if (!archive) return { samples: [], issue: null }
  if (archive.v !== 1) {
    return { samples: [], issue: `Unsupported archive format v${archive.v ?? 'unknown'}.` }
  }
  if (!Array.isArray(archive.c) || !Array.isArray(archive.tr)) {
    return { samples: [], issue: 'Archive payload is missing required RLE arrays.' }
  }
  if (archive.c.length === 0) return { samples: [], issue: null }

  const startMs = Date.parse(archive.t0)
  if (!Number.isFinite(startMs)) {
    return { samples: [], issue: 'Archive start timestamp is invalid.' }
  }

  const timestamps = [startMs]
  let cursor = startMs
  for (const run of archive.tr) {
    if (!Array.isArray(run)) return { samples: [], issue: 'Archive timestamp run is malformed.' }
    const delta = toFinite(run[0])
    const length = Number(run[1])
    if (delta === null || delta <= 0 || !Number.isInteger(length) || length < 0) {
      return { samples: [], issue: 'Archive timestamp run contains invalid values.' }
    }
    for (let i = 0; i < length; i++) {
      cursor += delta
      timestamps.push(cursor)
    }
  }

  if (timestamps.length < archive.c.length) {
    return { samples: [], issue: 'Archive RLE ended before all samples could be decoded.' }
  }

  const out = []
  const counts = archive.c
  const preds = archive.p || []
  const stdevs = archive.s || []
  const len = Math.min(timestamps.length, counts.length)
  for (let i = 0; i < len; i++) {
    const c = toFinite(counts[i])
    if (c === null) continue
    const exp = toFinite(preds[i])
    const sd = toFinite(stdevs[i])
    const lower = exp !== null && sd !== null ? Math.max(0, exp - sd) : null
    const bandWidth = exp !== null && sd !== null ? exp + sd - Math.max(0, exp - sd) : null
    out.push({ t: timestamps[i], count: c, expected: exp, lower, bandWidth })
  }
  return { samples: out, issue: out.length ? null : 'Archive contains no valid samples.' }
}

function getInitialRange() {
  try {
    const params = new URLSearchParams(window.location.search)
    const r = params.get('range')
    if (r && RANGE_OPTIONS.some((opt) => opt.id === r)) return r
  } catch { /* SSR / non-browser fallback */ }
  return '24h'
}

function syncRangeToUrl(id) {
  try {
    const url = new URL(window.location.href)
    if (id === '24h') url.searchParams.delete('range')
    else url.searchParams.set('range', id)
    window.history.replaceState(null, '', url)
  } catch { /* history API unavailable */ }
}

const LEVEL_COLORS = { 1: 'var(--level-1)', 2: 'var(--level-2)', 3: 'var(--level-3)', 4: 'var(--level-4)', 5: 'var(--level-5)' }

export function ArchiveChart({ archive, signal }) {
  const [rangeId, setRangeId] = useState(getInitialRange)
  const [showTable, setShowTable] = useState(false)
  const [transitions, setTransitions] = useState([])
  const range = RANGE_OPTIONS.find((r) => r.id === rangeId) ?? RANGE_OPTIONS[0]

  useEffect(() => {
    if (DASHBOARD_URL) return
    const controller = new AbortController()
    fetch('/api/events?limit=200', { signal: controller.signal })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data?.transitions) setTransitions(data.transitions) })
      .catch(() => {})
    return () => controller.abort()
  }, [])

  const decodedArchive = useMemo(() => decodeArchive(archive), [archive])
  const series = decodedArchive.samples

  const filtered = useMemo(() => {
    if (series.length === 0) return []
    const lastT = series[series.length - 1].t
    const cutoff = lastT - range.days * DAY_MS
    return series.filter((s) => s.t >= cutoff)
  }, [series, range.days])

  const visibleTransitions = useMemo(() => {
    if (!filtered.length || !transitions.length) return []
    const minT = filtered[0].t
    const maxT = filtered[filtered.length - 1].t
    return transitions
      .map((t) => ({ ...t, t: Date.parse(t.transitioned_at) }))
      .filter((t) => Number.isFinite(t.t) && t.t >= minT && t.t <= maxT)
  }, [filtered, transitions])

  const expected = signal?.expectedConcurrentCount
  const lastValue = filtered.length ? filtered[filtered.length - 1].count : null
  const activeIndex = RANGE_OPTIONS.findIndex((opt) => opt.id === rangeId)

  function handleRangeKeyDown(event) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const lastIndex = RANGE_OPTIONS.length - 1
    const nextIndex =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? lastIndex
          : event.key === 'ArrowLeft'
            ? Math.max(0, activeIndex - 1)
            : Math.min(lastIndex, activeIndex + 1)
    const nextId = RANGE_OPTIONS[nextIndex].id
    setRangeId(nextId)
    syncRangeToUrl(nextId)
  }

  return (
    <section className="card chart-card">
      <div className="chart-header">
        <div className="card-title">Concurrent Tracked Jets</div>
        <div className="range-tabs" role="tablist" aria-label="Time range">
          {RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              role="tab"
              aria-selected={opt.id === rangeId}
              aria-controls="archive-chart-panel"
              id={`archive-range-${opt.id}`}
              className={`range-tab ${opt.id === rangeId ? 'is-active' : ''}`}
              onClick={() => { setRangeId(opt.id); syncRangeToUrl(opt.id) }}
              onKeyDown={handleRangeKeyDown}
            >
              {opt.label}
            </button>
          ))}
          <button
            type="button"
            className={`range-tab ${showTable ? 'is-active' : ''}`}
            onClick={() => setShowTable((v) => !v)}
            aria-pressed={showTable}
            title="View data as table"
          >
            {showTable ? 'Chart' : 'Table'}
          </button>
        </div>
      </div>

      <div
        className="chart-frame"
        id="archive-chart-panel"
        role="tabpanel"
        aria-labelledby={`archive-range-${rangeId}`}
      >
        {showTable ? (
          <div className="chart-data-table-wrap">
            <table className="chart-data-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Airborne</th>
                  <th>Expected</th>
                  <th>Deviation</th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice(-48).map((s) => (
                  <tr key={s.t}>
                    <td>{new Date(s.t).toLocaleString()}</td>
                    <td>{s.count != null ? Math.round(s.count) : '—'}</td>
                    <td>{s.expected != null ? Math.round(s.expected) : '—'}</td>
                    <td>{s.count != null && s.expected != null ? (s.count - s.expected > 0 ? '+' : '') + Math.round(s.count - s.expected) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : decodedArchive.issue ? (
          <div className="chart-state chart-state--warning">{decodedArchive.issue}</div>
        ) : filtered.length === 0 ? (
          <div className="chart-state">No samples in range yet.</div>
        ) : (
          <ResponsiveContainer initialDimension={{ width: 640, height: 280 }}>
            <AreaChart data={filtered} margin={{ top: 10, right: 16, left: 0, bottom: 6 }}>
              <defs>
                <linearGradient id="ac-area" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.55} />
                  <stop offset="100%" stopColor="var(--accent)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis
                dataKey="t"
                type="number"
                domain={['dataMin', 'dataMax']}
                tickFormatter={(t) =>
                  new Date(t).toLocaleString(undefined, range.days <= 1
                    ? { hour: 'numeric', minute: '2-digit' }
                    : range.days <= 30
                      ? { month: 'short', day: 'numeric' }
                      : { month: 'short', year: '2-digit' })
                }
                tick={{ fontSize: 11 }}
                axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
                tickLine={false}
                minTickGap={40}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={36}
              />
              <Tooltip
                cursor={{ stroke: 'var(--accent)', strokeOpacity: 0.4 }}
                labelFormatter={(t) => new Date(t).toLocaleString()}
                formatter={(v, name) => {
                  if (name === 'lower' || name === 'Expected +/- 1 sigma') return null
                  return [Math.round(v), name === 'expected' ? 'Expected' : 'Airborne']
                }}
              />
              <Area
                type="monotone"
                dataKey="lower"
                stackId="band"
                stroke="none"
                fill="none"
                isAnimationActive={false}
                dot={false}
                activeDot={false}
                connectNulls
              />
              <Area
                type="monotone"
                dataKey="bandWidth"
                stackId="band"
                stroke="none"
                fill="var(--text-tertiary)"
                fillOpacity={0.08}
                isAnimationActive={false}
                dot={false}
                activeDot={false}
                connectNulls
                name="Expected +/- 1 sigma"
              />
              <Area
                type="monotone"
                dataKey="expected"
                stroke="var(--text-tertiary)"
                strokeWidth={1.5}
                strokeDasharray="4 3"
                fill="none"
                isAnimationActive={false}
                dot={false}
                activeDot={false}
                connectNulls
                name="Expected"
              />
              <Area
                type="monotone"
                dataKey="count"
                stroke="var(--accent)"
                strokeWidth={2}
                fill="url(#ac-area)"
                isAnimationActive={false}
                dot={false}
                activeDot={{ r: 4, stroke: 'var(--accent)', strokeWidth: 2, fill: 'var(--surface-1)' }}
              />
              {visibleTransitions.map((tr) => (
                <ReferenceLine
                  key={tr.id}
                  x={tr.t}
                  stroke={LEVEL_COLORS[tr.to_level] ?? 'var(--text-muted)'}
                  strokeDasharray="3 3"
                  strokeOpacity={0.6}
                  label={{ value: `L${tr.to_level}`, position: 'top', fill: LEVEL_COLORS[tr.to_level] ?? 'var(--text-muted)', fontSize: 10 }}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {lastValue !== null && Number.isFinite(expected) ? (
        <div className="chart-summary">
          <span>Latest <strong>{Math.round(lastValue)}</strong></span>
          <span>Baseline <strong>{Math.round(expected)}</strong></span>
        </div>
      ) : null}
    </section>
  )
}
