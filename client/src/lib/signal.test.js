import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { finiteNumber, deriveSignal, deriveEmergencyLevel, isLocalApi, validateDashboard } from './signal.js'
import { buildEvidencePacket, buildEvidenceText } from './evidence.js'
import { decodeArchive } from './archive.js'

const require = createRequire(import.meta.url)
const { computeEmergencyLevel, compactArchiveSeries } = require('../../../server/dashboard.js')
const { getDemoDashboard } = require('../../../server/demo-data.js')

test('missing numeric inputs remain unknown, never zero', () => {
  for (const value of [null, undefined, '', ' ', true, false, NaN, Infinity]) assert.equal(finiteNumber(value), null)
  for (const value of [0, '0', ' 12.5 ', -2]) assert.equal(finiteNumber(value), Number(value))
})

test('fallback activity levels match the backend at every threshold boundary', () => {
  for (const threshold of [4, 7, 9, 12]) {
    for (let sigma = -2; sigma <= 15; sigma += 0.125) {
      assert.equal(deriveEmergencyLevel({ sigmaShift: sigma, alarmSigmaThreshold: threshold }), computeEmergencyLevel(sigma, threshold))
    }
  }
})

test('a supplied valid level remains authoritative', () => {
  assert.equal(deriveEmergencyLevel({ emergencyLevel: 4, sigmaShift: 0 }), 4)
  assert.equal(deriveEmergencyLevel({ sigmaShift: 1.6 }), 1)
  assert.equal(deriveEmergencyLevel({ sigmaShift: 1.75 }), 2)
  assert.equal(deriveEmergencyLevel({ sigmaShift: 5.2 }), 3)
  assert.equal(deriveEmergencyLevel({ sigmaShift: 5.25 }), 4)
})

test('legacy current values retain the configured threshold', () => {
  const signal = deriveSignal({ current: { alarmSigmaThreshold: 4, zScore: 2, concurrentCount: 6 } })
  assert.equal(signal.alarmSigmaThreshold, 4)
  assert.equal(deriveEmergencyLevel(signal), 3)
})

test('local history and RSS links are not fabricated for static snapshots', () => {
  assert.equal(isLocalApi('/api/dashboard'), true)
  assert.equal(isLocalApi('/api/dashboard?range=24h'), true)
  for (const url of ['', './dashboard.json', 'https://example.test/dashboard.json', '/api/dashboard-invalid']) assert.equal(isLocalApi(url), false)
})

test('malformed data fails instead of presenting a reassuring default reading', () => {
  for (const value of [null, [], {}, { current: {}, liveAircraft: [], trends: { archive: [] } }]) assert.throws(() => validateDashboard(value))
})

test('the actual synthetic demo has a consistent cohort and usable baseline archive', () => {
  const demo = getDemoDashboard()
  assert.equal(validateDashboard(demo), demo)
  assert.equal(demo.mode, 'demo')
  assert.match(demo.liveStatus.providerLabel, /Synthetic/)
  assert.equal(demo.current.concurrentCount, demo.liveAircraft.length)
  assert.equal(demo.cohort.trackedCount, 6)
  const encoded = compactArchiveSeries(demo.trends.archive)
  assert.equal(encoded.c.length, 365 * 48)
  assert.ok(encoded.c.every(count => count >= 0 && count <= demo.cohort.trackedCount))
  assert.ok(encoded.p.every(Number.isFinite))
  assert.ok(encoded.s.every(value => Number.isFinite(value) && value > 0))
  assert.equal(encoded.c.at(-1), demo.current.concurrentCount)
  assert.equal(encoded.p.at(-1), demo.current.baselineMean)
})

test('evidence exports disclose synthetic mode and experimental limits', () => {
  const data = getDemoDashboard()
  const packet = buildEvidencePacket({ data, signal: deriveSignal(data), emergencyLevel: 1, archiveHealth: {}, sourceUrl: 'http://localhost/' })
  const text = buildEvidenceText(packet)
  assert.match(text, /Synthetic demo/)
  assert.match(text, /not an emergency warning or a forecast/)
  assert.equal(packet.warning, data.warning)
})

test('missing evidence inputs stay null', () => {
  const packet = buildEvidencePacket({ data: { cohort: { trackedCount: null }, current: {} }, signal: { sigmaShift: null }, emergencyLevel: 1, archiveHealth: {}, sourceUrl: 'http://localhost/' })
  assert.equal(packet.counts.tracked, null)
  assert.equal(packet.counts.sigmaShift, null)
  assert.equal(packet.archive.coverageRatio, null)
})

test('archive accepts the scalar deltas emitted by the filtered backend endpoint', () => {
  const decoded = decodeArchive({ v: 1, t0: '2026-09-09T00:00:00Z', tr: [1800000, [1800000, 1]], c: [2, 3, 4], p: [null, 2, 3], s: [null, 1, 1] })
  assert.equal(decoded.samples.length, 3)
  assert.equal(decoded.samples[0].expected, null)
  assert.equal(decoded.samples[0].sd, null)
})

test('an oversized archive run fails before expanding untrusted data', () => {
  const decoded = decodeArchive({ v: 1, t0: '2026-09-09T00:00:00Z', tr: [[1800000, 100000000]], c: [2] })
  assert.equal(decoded.samples.length, 0)
  assert.match(decoded.issue, /invalid values/)
})
