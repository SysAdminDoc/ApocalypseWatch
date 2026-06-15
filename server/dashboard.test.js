const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const {
  computeAlertLevel,
  computeEmergencyLevel,
  computeGaugeValue,
  computeBaselineSignal,
  compactArchiveSeries,
  encodeRuns,
} = require("./dashboard");

describe("computeAlertLevel", () => {
  const threshold = 7;

  it("returns 'normal' below elevated threshold", () => {
    assert.equal(computeAlertLevel(0, threshold), "normal");
    assert.equal(computeAlertLevel(1, threshold), "normal");
    assert.equal(computeAlertLevel(3.4, threshold), "normal");
  });

  it("returns 'elevated' at or above half the alarm threshold", () => {
    assert.equal(computeAlertLevel(3.5, threshold), "elevated");
    assert.equal(computeAlertLevel(5, threshold), "elevated");
    assert.equal(computeAlertLevel(6.9, threshold), "elevated");
  });

  it("returns 'alarm' at or above alarm threshold", () => {
    assert.equal(computeAlertLevel(7, threshold), "alarm");
    assert.equal(computeAlertLevel(10, threshold), "alarm");
    assert.equal(computeAlertLevel(100, threshold), "alarm");
  });

  it("handles threshold of 4 (elevated at 2)", () => {
    assert.equal(computeAlertLevel(1.9, 4), "normal");
    assert.equal(computeAlertLevel(2, 4), "elevated");
    assert.equal(computeAlertLevel(4, 4), "alarm");
  });

  it("elevated threshold floors at 1.5 for very low alarm thresholds", () => {
    assert.equal(computeAlertLevel(1.4, 2), "normal");
    assert.equal(computeAlertLevel(1.5, 2), "elevated");
  });
});

describe("computeEmergencyLevel", () => {
  const threshold = 7;

  it("returns 1 for zero or negative sigma", () => {
    assert.equal(computeEmergencyLevel(0, threshold), 1);
    assert.equal(computeEmergencyLevel(-5, threshold), 1);
  });

  it("returns 5 at or above alarm threshold", () => {
    assert.equal(computeEmergencyLevel(7, threshold), 5);
    assert.equal(computeEmergencyLevel(7.1, threshold), 5);
    assert.equal(computeEmergencyLevel(100, threshold), 5);
  });

  it("returns levels 1-4 proportionally below threshold", () => {
    assert.equal(computeEmergencyLevel(0, threshold), 1);
    assert.equal(computeEmergencyLevel(1.7, threshold), 1);
    assert.equal(computeEmergencyLevel(1.8, threshold), 2);
    assert.equal(computeEmergencyLevel(3.4, threshold), 2);
    assert.equal(computeEmergencyLevel(3.5, threshold), 3);
    assert.equal(computeEmergencyLevel(5.2, threshold), 3);
    assert.equal(computeEmergencyLevel(5.3, threshold), 4);
    assert.equal(computeEmergencyLevel(6.9, threshold), 4);
  });

  it("returns 1 if alarm threshold is falsy", () => {
    assert.equal(computeEmergencyLevel(10, 0), 1);
    assert.equal(computeEmergencyLevel(10, null), 1);
  });

  it("handles falsy sigma shift", () => {
    assert.equal(computeEmergencyLevel(null, threshold), 1);
    assert.equal(computeEmergencyLevel(undefined, threshold), 1);
  });
});

describe("computeGaugeValue", () => {
  it("returns 0 for zero sigma", () => {
    assert.equal(computeGaugeValue(0, 7), 0);
  });

  it("returns 1 at alarm threshold", () => {
    assert.equal(computeGaugeValue(7, 7), 1);
  });

  it("clamps to 0-1 range", () => {
    assert.equal(computeGaugeValue(-5, 7), 0);
    assert.equal(computeGaugeValue(100, 7), 1);
  });

  it("returns 0 if threshold is falsy", () => {
    assert.equal(computeGaugeValue(5, 0), 0);
    assert.equal(computeGaugeValue(5, null), 0);
  });

  it("returns proportional value", () => {
    assert.equal(computeGaugeValue(3.5, 7), 0.5);
  });
});

describe("computeBaselineSignal", () => {
  it("returns safe defaults when stddev is 0/falsy", () => {
    const result = computeBaselineSignal(100, 80, 0, 7);
    assert.equal(result.sigmaShift, 0);
    assert.equal(result.emergencyLevel, 1);
    assert.equal(result.alertLevel, "normal");
  });

  it("computes correct sigma shift", () => {
    const result = computeBaselineSignal(100, 80, 10, 7);
    assert.equal(result.sigmaShift, 2);
    assert.equal(result.alertLevel, "normal");
  });

  it("triggers alarm at threshold", () => {
    const result = computeBaselineSignal(150, 80, 10, 7);
    assert.equal(result.sigmaShift, 7);
    assert.equal(result.alertLevel, "alarm");
    assert.equal(result.emergencyLevel, 5);
  });
});

describe("encodeRuns", () => {
  it("encodes consecutive identical values into [value, count] runs", () => {
    const result = encodeRuns([1800000, 1800000, 1800000]);
    assert.deepEqual(result, [[1800000, 3]]);
  });

  it("handles mixed values", () => {
    const result = encodeRuns([1800000, 1800000, 3600000, 3600000, 3600000]);
    assert.deepEqual(result, [
      [1800000, 2],
      [3600000, 3],
    ]);
  });

  it("handles empty input", () => {
    assert.deepEqual(encodeRuns([]), []);
  });

  it("handles single value", () => {
    assert.deepEqual(encodeRuns([42]), [[42, 1]]);
  });

  it("all unique values produce runs of 1", () => {
    assert.deepEqual(encodeRuns([1, 2, 3]), [
      [1, 1],
      [2, 1],
      [3, 1],
    ]);
  });
});

describe("compactArchiveSeries", () => {
  it("returns empty archive for empty records", () => {
    const result = compactArchiveSeries([]);
    assert.deepEqual(result, { v: 1, t0: null, tr: [], c: [], p: [], s: [] });
  });

  it("encodes records with uniform 30-min spacing", () => {
    const base = new Date("2026-01-01T00:00:00Z");
    const records = Array.from({ length: 3 }, (_, i) => ({
      sampledAt: new Date(base.getTime() + i * 1800000).toISOString(),
      concurrentCount: 10 + i,
      expectedConcurrentCount: 9.5 + i,
      expectedConcurrentStdDev: 2.1,
    }));

    const result = compactArchiveSeries(records);
    assert.equal(result.v, 1);
    assert.equal(result.t0, records[0].sampledAt);
    assert.deepEqual(result.tr, [[1800000, 2]]);
    assert.deepEqual(result.c, [10, 11, 12]);
    assert.equal(result.p.length, 3);
    assert.equal(result.s.length, 3);
  });

  it("round-trips: decode(encode(records)) preserves count values", () => {
    const base = new Date("2026-06-01T12:00:00Z");
    const records = Array.from({ length: 5 }, (_, i) => ({
      sampledAt: new Date(base.getTime() + i * 1800000).toISOString(),
      concurrentCount: 20 + i * 3,
      expectedConcurrentCount: 18 + i * 3,
      expectedConcurrentStdDev: 5,
    }));

    const encoded = compactArchiveSeries(records);
    assert.equal(encoded.v, 1);
    assert.deepEqual(encoded.c, records.map((r) => r.concurrentCount));

    const startMs = Date.parse(encoded.t0);
    let cursor = startMs;
    const timestamps = [startMs];
    for (const [delta, count] of encoded.tr) {
      for (let j = 0; j < count; j++) {
        cursor += delta;
        timestamps.push(cursor);
      }
    }
    assert.equal(timestamps.length, records.length);
    for (let i = 0; i < records.length; i++) {
      assert.equal(timestamps[i], Date.parse(records[i].sampledAt));
    }
  });
});
