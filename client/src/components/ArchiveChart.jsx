import { useMemo, useState } from 'react'
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
import { RANGE_OPTIONS } from '../lib/constants'

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
        return Number.isFinite(t) && count !== null ? { t, count, expected } : null
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
  const len = Math.min(timestamps.length, counts.length)
  for (let i = 0; i < len; i++) {
    const c = toFinite(counts[i])
    if (c === null) continue
    out.push({ t: timestamps[i], count: c, expected: toFinite(preds[i]) })
  }
  return { samples: out, issue: out.length ? null : 'Archive contains no valid samples.' }
}

export function ArchiveChart({ archive, signal }) {
  const [rangeId, setRangeId] = useState('24h')
  const range = RANGE_OPTIONS.find((r) => r.id === rangeId) ?? RANGE_OPTIONS[0]

  const decodedArchive = useMemo(() => decodeArchive(archive), [archive])
  const series = decodedArchive.samples

  const filtered = useMemo(() => {
    if (series.length === 0) return []
    const lastT = series[series.length - 1].t
    const cutoff = lastT - range.days * DAY_MS
    return series.filter((s) => s.t >= cutoff)
  }, [series, range.days])

  const expected = signal?.expectedConcurrentCount
  const lastValue = filtered.length ? filtered[filtered.length - 1].count : null

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
              className={`range-tab ${opt.id === rangeId ? 'is-active' : ''}`}
              onClick={() => setRangeId(opt.id)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="chart-frame">
        {decodedArchive.issue ? (
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
                formatter={(v) => [`${v} airborne`, '']}
              />
              {Number.isFinite(expected) ? (
                <ReferenceLine
                  y={expected}
                  stroke="var(--text-tertiary)"
                  strokeDasharray="3 4"
                  label={{ value: 'baseline', position: 'right', fill: 'var(--text-tertiary)', fontSize: 11 }}
                />
              ) : null}
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
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {lastValue !== null && Number.isFinite(expected) ? (
        <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: 'var(--text-tertiary)', letterSpacing: '0.05em' }}>
          <span>latest: <strong style={{ color: 'var(--text-primary)' }}>{Math.round(lastValue)}</strong></span>
          <span>baseline: <strong style={{ color: 'var(--text-primary)' }}>{Math.round(expected)}</strong></span>
        </div>
      ) : null}
    </section>
  )
}
