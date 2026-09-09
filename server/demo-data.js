function getDemoDashboard() {
  const archiveLength = 365 * 48;
  const nowMs = Math.floor(Date.now() / 1_800_000) * 1_800_000;
  const currentConcurrentCount = 6;
  const expectedConcurrentCount = 5.2;
  const expectedConcurrentStdDev = 0.9;
  const zScore = (currentConcurrentCount - expectedConcurrentCount) / expectedConcurrentStdDev;
  const alarmSigmaThreshold = 7.0;
  const elevatedSigmaThreshold = 3.5;
  const emergencyLevel = zScore >= alarmSigmaThreshold ? 5 : Math.min(4, Math.max(1, Math.floor((Math.max(0, zScore) / alarmSigmaThreshold) * 4) + 1));
  const cohort = {
    configured: false,
    trackedCount: 6,
    reason: "Run `npm run import:faa` to switch from demo mode to real tracking.",
  };

  return {
    mode: "demo",
    warning: "No cohort has been imported yet. This dashboard is showing synthetic review data.",
    cohort,
    watchlist: cohort,
    liveStatus: {
      provider: "synthetic_demo",
      providerLabel: "Synthetic demonstration",
      cadenceMinutes: 30,
      refreshing: false,
      nextRefreshAt: null,
      lastAttemptAt: null,
      lastSuccessAt: null,
      lastError: null,
      latestSampledAt: new Date(nowMs).toISOString(),
      latestSlotKey: "demo",
      latestUrl: null,
      cachePath: null,
      usedCache: true,
      matchedCount: 6,
      airborneCount: 6,
      concurrentCount: 6,
    },
    current: {
      asOf: new Date(nowMs).toISOString(),
      concurrentCount: currentConcurrentCount,
      baselineMean: expectedConcurrentCount,
      baselineStdDev: expectedConcurrentStdDev,
      zScore,
      gaugeValue: Math.max(0, Math.min(1, 0.5 + 0.25 * zScore)),
      alertLevel: zScore >= 2 ? "alarm" : zScore >= 1 ? "elevated" : "normal",
      emergencyLevel,
      alarmSigmaThreshold,
      elevatedSigmaThreshold,
    },
    signals: {
      composite: {
        asOf: new Date(nowMs).toISOString(),
        actualConcurrentCount: currentConcurrentCount,
        expectedConcurrentCount,
        expectedConcurrentStdDev,
        timeOfDayExpected: 5.0,
        timeOfWeekExpected: 5.4,
        timeOfDaySampleCount: 28,
        timeOfWeekSampleCount: 4,
        timeOfWeekBlendWeight: 0.67,
        sigmaShift: zScore,
        gaugeValue: Math.max(0, Math.min(1, 0.5 + 0.25 * zScore)),
        alertLevel: zScore >= 2 ? "alarm" : zScore >= 1 ? "elevated" : "normal",
        emergencyLevel,
        alarmSigmaThreshold,
        elevatedSigmaThreshold,
      },
    },
    liveAircraft: [
      {
        hex: "d3m001",
        registration: "N-DEMO1",
        label: "Cohort 01",
        observed_at: new Date(nowMs).toISOString(),
        lat: 40.7128,
        lon: -74.006,
        altitudeFt: 39000,
        groundSpeedKt: 441,
        track: 84,
        isAirborne: true,
      },
      {
        hex: "d3m002",
        registration: "N-DEMO2",
        label: "Cohort 02",
        observed_at: new Date(nowMs).toISOString(),
        lat: 51.5072,
        lon: -0.1276,
        altitudeFt: 41000,
        groundSpeedKt: 458,
        track: 118,
        isAirborne: true,
      },
      {
        hex: "d3m003",
        registration: "N-DEMO3",
        label: "Cohort 03",
        observed_at: new Date(nowMs).toISOString(),
        lat: 25.2048,
        lon: 55.2708,
        altitudeFt: 38200,
        groundSpeedKt: 429,
        track: 303,
        isAirborne: true,
      },
      {
        hex: "d3m004",
        registration: "N-DEMO4",
        label: "Cohort 04",
        observed_at: new Date(nowMs).toISOString(),
        lat: -23.5505,
        lon: -46.6333,
        altitudeFt: 36700,
        groundSpeedKt: 417,
        track: 47,
        isAirborne: true,
      },
      {
        hex: "d3m005",
        registration: "N-DEMO5",
        label: "Cohort 05",
        observed_at: new Date(nowMs).toISOString(),
        lat: 35.6764,
        lon: 139.65,
        altitudeFt: 40100,
        groundSpeedKt: 447,
        track: 211,
        isAirborne: true,
      },
      {
        hex: "d3m006",
        registration: "N-DEMO6",
        label: "Cohort 06",
        observed_at: new Date(nowMs).toISOString(),
        lat: -33.8688,
        lon: 151.2093,
        altitudeFt: 35400,
        groundSpeedKt: 433,
        track: 294,
        isAirborne: true,
      },
    ],
    trends: {
      archive: Array.from({ length: archiveLength }, (_, index) => {
        const sampledAt = new Date(nowMs - (archiveLength - 1 - index) * 1_800_000).toISOString();
        const isLatest = index === archiveLength - 1;
        const concurrentCount = isLatest ? currentConcurrentCount : Math.max(1, Math.min(6, Math.round(3 + Math.sin(index / 20) * 1.7 + Math.sin(index / 97))));
        const expectedConcurrentCount = isLatest ? 5.2 : Math.max(1, Math.min(6, 3 + Math.sin(index / 20) * 1.3));
        return { sampledAt, concurrentCount, expectedConcurrentCount, expectedConcurrentStdDev: 0.9 };
      }),
    },
  };
}

module.exports = {
  getDemoDashboard,
};
