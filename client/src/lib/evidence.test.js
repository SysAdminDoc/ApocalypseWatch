import test from 'node:test'
import assert from 'node:assert/strict'
import { buildEvidencePacket, buildEvidenceText } from './evidence.js'

test('buildEvidencePacket includes citation fields and archive validation', () => {
  const packet = buildEvidencePacket({
    data: {
      mode: 'live',
      current: { asOf: '2026-08-11T12:00:00Z' },
      cohort: { trackedCount: 120 },
      liveAircraft: [{ hex: 'abc123' }, { hex: 'def456' }],
      liveStatus: {
        providerLabel: 'Airplanes.Live',
        latestSampledAt: '2026-08-11T11:30:00Z',
        nextRefreshAt: '2026-08-11T12:30:00Z',
      },
    },
    signal: {
      actualConcurrentCount: 2,
      expectedConcurrentCount: 1.2,
      expectedConcurrentStdDev: 0.4,
      sigmaShift: 2,
      alarmSigmaThreshold: 7,
    },
    emergencyLevel: 2,
    archiveHealth: {
      format: 'rle-v1',
      dataAgeMs: 1_800_000,
      sampleCount: 48,
      earliestSampleAt: '2026-08-10T12:00:00Z',
      latestSampleAt: '2026-08-11T11:30:00Z',
      completeDays: 1,
      partialDays: 1,
      missingDays: 0,
      expectedSlots: 48,
      observedSlots: 48,
      missingSlots: 0,
      coverageRatio: 1,
      delayed: false,
      issue: null,
    },
    sensitivity: {
      alarmSigmaThreshold: 7,
      currentLevel: 2,
      currentSigmaShift: 2,
      peak: { level: 4, sigmaShift: 5.2, at: '2026-08-10T20:00:00Z' },
      scoredSamples: 48,
      levelCounts: { 1: 20, 2: 15, 3: 8, 4: 5, 5: 0 },
    },
    lastFetchedAt: new Date('2026-08-11T12:01:00Z'),
    sourceUrl: 'https://example.test/dashboard',
  })

  assert.equal(packet.schema, 'apocalypsewatch.evidence.v1')
  assert.equal(packet.mode, 'live')
  assert.equal(packet.emergency.asOfEpochMs, Date.parse('2026-08-11T12:00:00Z'))
  assert.equal(packet.emergency.dataAgeMinutes, 30)
  assert.equal(packet.counts.tracked, 120)
  assert.equal(packet.counts.airborne, 2)
  assert.equal(packet.archive.coverageRatio, 1)
  assert.equal(packet.sensitivity.peakLevel, 4)
  assert.equal(packet.freshness.provider, 'Airplanes.Live')
  assert.equal(packet.sources.some((source) => source.url === 'https://airplanes.live/api-guide/'), true)
})

test('buildEvidenceText makes UTC and local timestamps explicit', () => {
  const packet = buildEvidencePacket({
    data: { current: { asOf: '2026-08-11T12:00:00Z' } },
    signal: {},
    emergencyLevel: 1,
    archiveHealth: { coverageRatio: 0, observedSlots: 0, expectedSlots: 48 },
    sourceUrl: 'https://example.test/dashboard',
  })
  const text = buildEvidenceText(packet)

  assert.match(text, /generated: .* UTC/)
  assert.match(text, /Browser-local generation time:/)
  assert.match(text, /Reading as of: 2026-08-11T12:00:00Z \(ISO 8601 UTC\)/)
  assert.match(text, /Source: https:\/\/example\.test\/dashboard/)
})
