const HALF_HOUR_MS = 30 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000
const DEFAULT_CADENCE_MINUTES = 30

function toFinite(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

export function decodeArchive(archive) {
  if (Array.isArray(archive)) {
    const samples = archive
      .map((s) => {
        const t = Date.parse(s?.sampledAt ?? s?.timestamp ?? '')
        const count = toFinite(s?.concurrentCount ?? s?.count)
        const expected = toFinite(s?.predictedConcurrentCount ?? s?.expectedCount)
        const sd = toFinite(s?.predictedConcurrentStdDev ?? s?.stdDev ?? s?.standardDeviation)
        const lower = expected !== null && sd !== null ? Math.max(0, expected - sd) : null
        const bandWidth = expected !== null && sd !== null ? expected + sd - Math.max(0, expected - sd) : null
        return Number.isFinite(t) && count !== null ? { t, count, expected, sd, lower, bandWidth } : null
      })
      .filter(Boolean)
      .sort((a, b) => a.t - b.t)
    return { samples, issue: null, format: Array.isArray(archive) ? 'array' : 'unknown' }
  }

  if (!archive) return { samples: [], issue: null, format: 'empty' }
  if (archive.v !== 1) {
    return { samples: [], issue: `Unsupported archive format v${archive.v ?? 'unknown'}.`, format: 'unsupported' }
  }
  if (!Array.isArray(archive.c) || !Array.isArray(archive.tr)) {
    return { samples: [], issue: 'Archive payload is missing required RLE arrays.', format: 'rle-v1' }
  }
  if (archive.c.length === 0) return { samples: [], issue: null, format: 'rle-v1' }

  const startMs = Date.parse(archive.t0)
  if (!Number.isFinite(startMs)) {
    return { samples: [], issue: 'Archive start timestamp is invalid.', format: 'rle-v1' }
  }

  const timestamps = [startMs]
  let cursor = startMs
  for (const run of archive.tr) {
    if (!Array.isArray(run)) return { samples: [], issue: 'Archive timestamp run is malformed.', format: 'rle-v1' }
    const delta = toFinite(run[0])
    const length = Number(run[1])
    if (delta === null || delta <= 0 || !Number.isInteger(length) || length < 0) {
      return { samples: [], issue: 'Archive timestamp run contains invalid values.', format: 'rle-v1' }
    }
    for (let i = 0; i < length; i += 1) {
      cursor += delta
      timestamps.push(cursor)
    }
  }

  if (timestamps.length < archive.c.length) {
    return { samples: [], issue: 'Archive RLE ended before all samples could be decoded.', format: 'rle-v1' }
  }

  const out = []
  const counts = archive.c
  const preds = archive.p || []
  const stdevs = archive.s || []
  const len = Math.min(timestamps.length, counts.length)
  for (let i = 0; i < len; i += 1) {
    const c = toFinite(counts[i])
    if (c === null) continue
    const exp = toFinite(preds[i])
    const sd = toFinite(stdevs[i])
    const lower = exp !== null && sd !== null ? Math.max(0, exp - sd) : null
    const bandWidth = exp !== null && sd !== null ? exp + sd - Math.max(0, exp - sd) : null
    out.push({ t: timestamps[i], count: c, expected: exp, sd, lower, bandWidth })
  }
  return { samples: out, issue: out.length ? null : 'Archive contains no valid samples.', format: 'rle-v1' }
}

function utcDayStart(timestamp) {
  const date = new Date(timestamp)
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
}

function dayKey(timestamp) {
  return new Date(timestamp).toISOString().slice(0, 10)
}

function expectedSlotsForDay(dayStart, windowStart, windowEnd) {
  const start = Math.max(dayStart, windowStart)
  const end = Math.min(dayStart + DAY_MS - 1, windowEnd)
  if (end < start) return 0
  return Math.floor((end - start) / HALF_HOUR_MS) + 1
}

export function buildArchiveHealth({ decodedArchive, liveStatus, now = Date.now(), days = 365 }) {
  const samples = decodedArchive?.samples ?? []
  const countsByDay = new Map()
  for (const sample of samples) {
    countsByDay.set(dayKey(sample.t), (countsByDay.get(dayKey(sample.t)) ?? 0) + 1)
  }

  const latestSampleMs = samples.length ? samples[samples.length - 1].t : null
  const earliestSampleMs = samples.length ? samples[0].t : null
  const endMs = latestSampleMs ?? now
  const endDay = utcDayStart(endMs)
  const startDay = endDay - (days - 1) * DAY_MS
  const windowStart = Math.max(startDay, earliestSampleMs ?? startDay)
  const windowEnd = latestSampleMs ?? now

  const calendar = []
  let completeDays = 0
  let partialDays = 0
  let missingDays = 0
  let expectedSlots = 0
  let observedSlots = 0
  let missingSlots = 0

  for (let offset = 0; offset < days; offset += 1) {
    const dayStart = startDay + offset * DAY_MS
    const key = dayKey(dayStart)
    const expected = expectedSlotsForDay(dayStart, windowStart, windowEnd)
    const count = countsByDay.get(key) ?? 0
    const coverage = expected > 0 ? Math.min(1, count / expected) : 0
    const status = expected === 0 ? 'empty' : count === 0 ? 'missing' : count < expected ? 'partial' : 'complete'

    if (expected > 0) {
      expectedSlots += expected
      observedSlots += Math.min(count, expected)
      missingSlots += Math.max(0, expected - count)
      if (status === 'complete') completeDays += 1
      else if (status === 'partial') partialDays += 1
      else if (status === 'missing') missingDays += 1
    }

    calendar.push({
      key,
      label: new Date(dayStart).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }),
      count,
      expected,
      coverage,
      status,
    })
  }

  const sampledAt = liveStatus?.latestSampledAt
  const sampledMs = sampledAt ? Date.parse(sampledAt) : latestSampleMs
  const cadenceMinutes = Math.max(1, Number(liveStatus?.cadenceMinutes ?? DEFAULT_CADENCE_MINUTES) || DEFAULT_CADENCE_MINUTES)
  const ageMs = Number.isFinite(sampledMs) ? now - sampledMs : null
  const delayed = ageMs !== null ? ageMs > cadenceMinutes * 2 * 60_000 : true

  return {
    calendar,
    format: decodedArchive?.format ?? 'unknown',
    issue: decodedArchive?.issue ?? null,
    latestSampleAt: latestSampleMs ? new Date(latestSampleMs).toISOString() : null,
    earliestSampleAt: earliestSampleMs ? new Date(earliestSampleMs).toISOString() : null,
    sampleCount: samples.length,
    completeDays,
    partialDays,
    missingDays,
    expectedSlots,
    observedSlots,
    missingSlots,
    coverageRatio: expectedSlots ? observedSlots / expectedSlots : 0,
    delayed,
    dataAgeMs: ageMs,
    cadenceMinutes,
  }
}

export function computeEmergencyLevelForThreshold(sigmaShift, alarmSigmaThreshold) {
  const threshold = Number(alarmSigmaThreshold)
  const normalizedSigma = Math.max(0, Number(sigmaShift || 0))
  if (!Number.isFinite(threshold) || threshold <= 0) return 1
  if (normalizedSigma >= threshold) return 5
  return Math.min(4, Math.max(1, Math.floor((normalizedSigma / threshold) * 4) + 1))
}

export function buildSensitivityPreview({ samples, signal, alarmSigmaThreshold }) {
  const threshold = Number(alarmSigmaThreshold)
  const levelCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  let peak = { level: 1, sigmaShift: 0, at: null, count: null, expected: null }

  for (const sample of samples ?? []) {
    if (!Number.isFinite(sample.count) || !Number.isFinite(sample.expected) || !Number.isFinite(sample.sd) || sample.sd <= 0) {
      continue
    }
    const sigmaShift = (sample.count - sample.expected) / sample.sd
    const level = computeEmergencyLevelForThreshold(sigmaShift, threshold)
    levelCounts[level] += 1
    if (level > peak.level || sigmaShift > peak.sigmaShift) {
      peak = { level, sigmaShift, at: new Date(sample.t).toISOString(), count: sample.count, expected: sample.expected }
    }
  }

  const currentSigma = Number(signal?.sigmaShift)
  const currentLevel = computeEmergencyLevelForThreshold(Number.isFinite(currentSigma) ? currentSigma : 0, threshold)

  return {
    alarmSigmaThreshold: threshold,
    currentLevel,
    currentSigmaShift: Number.isFinite(currentSigma) ? currentSigma : null,
    peak,
    levelCounts,
    scoredSamples: Object.values(levelCounts).reduce((total, value) => total + value, 0),
  }
}
