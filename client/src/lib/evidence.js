import { DASHBOARD_URL, EMERGENCY_LEVELS } from './constants'

function finiteOrNull(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function round(value, digits = 2) {
  const n = finiteOrNull(value)
  if (n === null) return null
  const factor = 10 ** digits
  return Math.round(n * factor) / factor
}

function ageMinutes(value) {
  const n = finiteOrNull(value)
  return n === null ? null : round(n / 60_000, 1)
}

export function buildEvidencePacket({
  data,
  signal,
  emergencyLevel,
  archiveHealth,
  sensitivity,
  lastFetchedAt,
  sourceUrl = window.location.href,
}) {
  const levelInfo = EMERGENCY_LEVELS[emergencyLevel - 1] ?? EMERGENCY_LEVELS[0]
  const asOf = data?.current?.asOf ?? signal?.asOf ?? data?.liveStatus?.latestSampledAt ?? null
  const asOfMs = asOf ? Date.parse(asOf) : NaN
  const generatedAt = new Date()
  const trackedCount = finiteOrNull(data?.cohort?.trackedCount ?? data?.watchlist?.trackedCount)
  const airborne = finiteOrNull(signal?.actualConcurrentCount ?? data?.current?.concurrentCount ?? data?.liveAircraft?.length)
  const providerLabel = data?.liveStatus?.providerLabel ?? 'ADS-B Exchange'

  return {
    schema: 'apocalypsewatch.evidence.v1',
    app: 'ApocalypseWatch',
    generatedAt: generatedAt.toISOString(),
    generatedAtLocal: generatedAt.toString(),
    sourceUrl,
    dashboardUrl: DASHBOARD_URL,
    mode: data?.mode ?? null,
    emergency: {
      level: emergencyLevel,
      label: levelInfo.label,
      tone: levelInfo.tone,
      asOf,
      asOfEpochMs: Number.isFinite(asOfMs) ? asOfMs : null,
      dataAgeMs: archiveHealth?.dataAgeMs ?? (Number.isFinite(asOfMs) ? generatedAt.getTime() - asOfMs : null),
      dataAgeMinutes: ageMinutes(archiveHealth?.dataAgeMs ?? (Number.isFinite(asOfMs) ? generatedAt.getTime() - asOfMs : null)),
    },
    counts: {
      tracked: trackedCount,
      airborne,
      liveAircraft: finiteOrNull(data?.liveAircraft?.length),
      expectedConcurrent: round(signal?.expectedConcurrentCount ?? data?.current?.baselineMean),
      baselineStdDev: round(signal?.expectedConcurrentStdDev ?? data?.current?.baselineStdDev),
      sigmaShift: round(signal?.sigmaShift ?? data?.current?.zScore),
      alarmSigmaThreshold: round(signal?.alarmSigmaThreshold ?? data?.current?.alarmSigmaThreshold),
    },
    archive: {
      format: archiveHealth?.format ?? null,
      decodedSamples: archiveHealth?.sampleCount ?? 0,
      earliestSampleAt: archiveHealth?.earliestSampleAt ?? null,
      latestSampleAt: archiveHealth?.latestSampleAt ?? null,
      completeDays: archiveHealth?.completeDays ?? 0,
      partialDays: archiveHealth?.partialDays ?? 0,
      missingDays: archiveHealth?.missingDays ?? 0,
      expectedSlots: archiveHealth?.expectedSlots ?? 0,
      observedSlots: archiveHealth?.observedSlots ?? 0,
      missingSlots: archiveHealth?.missingSlots ?? 0,
      coverageRatio: round(archiveHealth?.coverageRatio, 4),
      delayed: Boolean(archiveHealth?.delayed),
      issue: archiveHealth?.issue ?? null,
    },
    sensitivity: sensitivity
      ? {
          alarmSigmaThreshold: round(sensitivity.alarmSigmaThreshold, 1),
          currentLevel: sensitivity.currentLevel,
          currentSigmaShift: round(sensitivity.currentSigmaShift),
          peakLevel: sensitivity.peak?.level ?? null,
          peakSigmaShift: round(sensitivity.peak?.sigmaShift),
          peakAt: sensitivity.peak?.at ?? null,
          scoredSamples: sensitivity.scoredSamples,
          levelCounts: sensitivity.levelCounts,
        }
      : null,
    freshness: {
      provider: providerLabel,
      latestSampledAt: data?.liveStatus?.latestSampledAt ?? null,
      lastFetchedAt: lastFetchedAt?.toISOString?.() ?? null,
      lastError: data?.liveStatus?.lastError ?? null,
      nextRefreshAt: data?.liveStatus?.nextRefreshAt ?? null,
    },
    sources: [
      { label: 'Dashboard snapshot', url: DASHBOARD_URL },
      { label: 'Provider', name: providerLabel },
      { label: 'ADS-B Exchange data products', url: 'https://www.adsbexchange.com/data-products/' },
      { label: 'Airplanes.Live API guide', url: 'https://airplanes.live/api-guide/' },
      { label: 'ADSB.lol open data', url: 'https://www.adsb.lol/docs/open-data/api/' },
    ],
  }
}

export function buildEvidenceText(packet) {
  const coveragePct = packet.archive.coverageRatio === null ? 'n/a' : `${Math.round(packet.archive.coverageRatio * 100)}%`
  const age = packet.emergency.dataAgeMinutes === null ? 'n/a' : `${packet.emergency.dataAgeMinutes} min`
  const expected = packet.counts.expectedConcurrent === null ? 'n/a' : packet.counts.expectedConcurrent
  const sigma = packet.counts.sigmaShift === null ? 'n/a' : `${packet.counts.sigmaShift} sigma`

  return [
    `ApocalypseWatch evidence packet (${packet.generatedAt})`,
    `Level ${packet.emergency.level}/5: ${packet.emergency.label}`,
    `Airborne tracked jets: ${packet.counts.airborne ?? 'n/a'} of ${packet.counts.tracked ?? 'n/a'}`,
    `Expected concurrent count: ${expected}; deviation: ${sigma}`,
    `Data age: ${age}; provider: ${packet.freshness.provider}`,
    `Archive coverage: ${coveragePct} (${packet.archive.observedSlots}/${packet.archive.expectedSlots} half-hour slots)`,
    `Source: ${packet.sourceUrl}`,
  ].join('\n')
}

export function downloadJson(filename, payload) {
  const blob = new Blob([`${JSON.stringify(payload, null, 2)}\n`], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
