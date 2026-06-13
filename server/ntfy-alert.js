const { getMetaValue, setMetaValue } = require("./db");

const NTFY_ALERT_LAST_SLOT_META_KEY = "ntfy_level5_alert_last_slot_key";
const DEFAULT_NTFY_SERVER = "https://ntfy.sh";
const DEFAULT_ALERT_URL = "https://ews.kylemcdonald.net/";

function getNtfyAlertConfig(env = process.env) {
  const topic = String(env.NTFY_TOPIC || "").trim();
  const server = String(env.NTFY_SERVER || DEFAULT_NTFY_SERVER).trim();
  return {
    enabled: Boolean(topic),
    server,
    topic,
    alertUrl: String(env.EWS_PUBLIC_URL || DEFAULT_ALERT_URL).trim() || DEFAULT_ALERT_URL,
  };
}

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

async function sendNtfyNotification({ server, topic }, { title, message, priority, clickUrl }) {
  const response = await fetch(`${server}/${topic}`, {
    method: "POST",
    headers: {
      "Title": title,
      "Priority": String(priority),
      "Click": clickUrl,
      "Tags": "warning,rotating_light",
    },
    body: message,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`ntfy publish failed with ${response.status}: ${text}`);
  }
}

async function maybeSendEmergencyLevelNtfyAlert({
  snapshot,
  status = null,
  env = process.env,
  logger = console,
} = {}) {
  const config = getNtfyAlertConfig(env);
  if (!config.enabled) {
    return { ok: true, sent: false, reason: "ntfy_not_configured" };
  }

  const signal = getEmergencySnapshotSignal(snapshot);
  const emergencyLevel = Math.round(Number(signal?.emergencyLevel || 1));
  if (emergencyLevel !== 5) {
    return { ok: true, sent: false, reason: "emergency_level_not_5", emergencyLevel };
  }

  const latestSlotKey = getLatestSlotKey(snapshot, status);
  const lastAlertedSlotKey = getMetaValue(NTFY_ALERT_LAST_SLOT_META_KEY);
  if (latestSlotKey && lastAlertedSlotKey === latestSlotKey) {
    return { ok: true, sent: false, reason: "already_alerted_for_slot", latestSlotKey };
  }

  const actualCount = Number(signal?.actualConcurrentCount ?? 0);
  const expectedCount = Number(signal?.expectedConcurrentCount ?? 0);
  const aboveExpected = actualCount - expectedCount;
  const sign = aboveExpected >= 0 ? "+" : "";

  try {
    await sendNtfyNotification(config, {
      title: "Emergency Level 5!",
      message: `${actualCount} airborne (${sign}${aboveExpected} above expected)`,
      priority: 5,
      clickUrl: config.alertUrl,
    });
  } catch (error) {
    logger.error("ntfy alert failed:", error.message);
    return { ok: false, sent: false, reason: "ntfy_send_failed", error: error.message };
  }

  if (latestSlotKey) {
    setMetaValue(NTFY_ALERT_LAST_SLOT_META_KEY, latestSlotKey);
  }

  return { ok: true, sent: true, latestSlotKey };
}

module.exports = {
  getNtfyAlertConfig,
  maybeSendEmergencyLevelNtfyAlert,
};
