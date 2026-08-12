import test from 'node:test'
import assert from 'node:assert/strict'
import { buildArchiveHealth, buildSensitivityPreview, decodeArchive } from './archive.js'

const sample = (timestamp, count = 10, expected = 8, sd = 1) => ({
  sampledAt: timestamp,
  concurrentCount: count,
  predictedConcurrentCount: expected,
  predictedConcurrentStdDev: sd,
})

test('decodeArchive reports malformed array samples while keeping valid samples', () => {
  const decoded = decodeArchive([
    sample('2026-08-09T00:00:00Z'),
    { sampledAt: 'not-a-timestamp', concurrentCount: 4 },
  ])

  assert.equal(decoded.samples.length, 1)
  assert.match(decoded.issue, /sample could not be decoded/)
})

test('buildArchiveHealth distinguishes partial, missing, and complete days', () => {
  const decodedArchive = decodeArchive([
    sample('2026-08-09T00:00:00Z'),
    sample('2026-08-11T00:00:00Z'),
  ])
  const health = buildArchiveHealth({
    decodedArchive,
    liveStatus: { latestSampledAt: '2026-08-11T00:00:00Z', cadenceMinutes: 30 },
    now: Date.parse('2026-08-11T01:00:00Z'),
    days: 3,
  })

  assert.equal(health.coverageRatio, 2 / 97)
  assert.equal(health.missingSlots, 95)
  assert.equal(health.calendar.find((day) => day.key === '2026-08-09').status, 'partial')
  assert.equal(health.calendar.find((day) => day.key === '2026-08-10').status, 'missing')
  assert.equal(health.calendar.find((day) => day.key === '2026-08-11').status, 'complete')
})

test('buildArchiveHealth marks a stale latest day as delayed', () => {
  const health = buildArchiveHealth({
    decodedArchive: decodeArchive([sample('2026-08-11T00:00:00Z')]),
    liveStatus: { latestSampledAt: '2026-08-11T00:00:00Z', cadenceMinutes: 30 },
    now: Date.parse('2026-08-11T02:01:00Z'),
    days: 1,
  })

  assert.equal(health.delayed, true)
  assert.equal(health.calendar[0].status, 'delayed')
})

test('buildArchiveHealth flags irregular timestamps as malformed', () => {
  const health = buildArchiveHealth({
    decodedArchive: decodeArchive([
      sample('2026-08-11T00:00:00Z'),
      sample('2026-08-11T00:45:00Z'),
    ]),
    liveStatus: { latestSampledAt: '2026-08-11T00:45:00Z', cadenceMinutes: 30 },
    now: Date.parse('2026-08-11T01:00:00Z'),
    days: 1,
  })

  assert.equal(health.malformed, true)
  assert.equal(health.intervalIssueCount, 1)
  assert.equal(health.calendar[0].status, 'malformed')
})

test('buildSensitivityPreview recalculates current and archive levels without mutating samples', () => {
  const samples = [
    { t: Date.parse('2026-08-11T00:00:00Z'), count: 10, expected: 8, sd: 1 },
    { t: Date.parse('2026-08-11T00:30:00Z'), count: 12, expected: 8, sd: 1 },
    { t: Date.parse('2026-08-11T01:00:00Z'), count: 16, expected: 8, sd: 1 },
    { t: Date.parse('2026-08-11T01:30:00Z'), count: 2, expected: 2, sd: 0 },
  ]
  const preview = buildSensitivityPreview({
    samples,
    signal: { sigmaShift: 2 },
    alarmSigmaThreshold: 4,
  })

  assert.equal(preview.currentLevel, 3)
  assert.deepEqual(preview.levelCounts, { 1: 0, 2: 0, 3: 1, 4: 0, 5: 2 })
  assert.equal(preview.scoredSamples, 3)
  assert.equal(preview.peak.level, 5)
  assert.equal(preview.peak.sigmaShift, 8)
  assert.equal(samples.length, 4)
})

test('buildSensitivityPreview makes a higher threshold less sensitive', () => {
  const samples = [{ t: 1, count: 12, expected: 8, sd: 1 }]
  const sensitive = buildSensitivityPreview({ samples, signal: { sigmaShift: 4 }, alarmSigmaThreshold: 4 })
  const conservative = buildSensitivityPreview({ samples, signal: { sigmaShift: 4 }, alarmSigmaThreshold: 8 })

  assert.equal(sensitive.currentLevel, 5)
  assert.equal(conservative.currentLevel, 3)
  assert.equal(conservative.peak.level, 3)
})
