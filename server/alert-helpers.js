const DEFAULT_ALERT_URL = "https://ews.kylemcdonald.net/";
const DEFAULT_MIN_LEVEL = 5;

function getEmergencySnapshotSignal(snapshot) {
  return snapshot?.signals?.composite || {
    emergencyLevel: snapshot?.current?.emergencyLevel,
    actualConcurrentCount: snapshot?.current?.concurrentCount,
    expectedConcurrentCount: snapshot?.current?.baselineMean,
    asOf: snapshot?.current?.asOf,
  };
}

function getLatestSlotKey(snapshot, status) {
  return (
    status?.latestSlotKey ||
    snapshot?.liveStatus?.latestSlotKey ||
    snapshot?.current?.asOf ||
    getEmergencySnapshotSignal(snapshot)?.asOf ||
    null
  );
}

function getAlertMinLevel(env = process.env) {
  const raw = Number(env.ALERT_MIN_LEVEL);
  if (Number.isFinite(raw) && raw >= 1 && raw <= 5) return Math.round(raw);
  return DEFAULT_MIN_LEVEL;
}

function formatCount(value) {
  const numericValue = Number(value || 0);
  if (!Number.isFinite(numericValue)) return "0";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Math.round(numericValue));
}

function formatSignedCount(value) {
  const numericValue = Number(value || 0);
  if (!Number.isFinite(numericValue)) return "+0";
  const roundedValue = Math.round(numericValue);
  return `${roundedValue >= 0 ? "+" : ""}${formatCount(roundedValue)}`;
}

module.exports = {
  DEFAULT_ALERT_URL,
  DEFAULT_MIN_LEVEL,
  getEmergencySnapshotSignal,
  getLatestSlotKey,
  getAlertMinLevel,
  formatCount,
  formatSignedCount,
};
