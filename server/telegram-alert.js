const { getMetaValue, setMetaValue } = require("./db");
const {
  DEFAULT_ALERT_URL,
  getEmergencySnapshotSignal,
  getLatestSlotKey,
  getAlertMinLevel,
  formatCount,
  formatSignedCount,
} = require("./alert-helpers");

const TELEGRAM_ALERT_LAST_SLOT_META_KEY = "telegram_level5_alert_last_slot_key";
const TELEGRAM_API_BASE_URL = "https://api.telegram.org";

function normalizeTelegramChannel(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) {
    return null;
  }

  const tmeMatch = trimmed.match(/^https?:\/\/t\.me\/([^/?#]+)/i);
  if (tmeMatch) {
    return `@${tmeMatch[1]}`;
  }

  if (trimmed.startsWith("@") || trimmed.startsWith("-")) {
    return trimmed;
  }

  return `@${trimmed}`;
}

function getTelegramAlertConfig(env = process.env) {
  const token = String(env.TELEGRAM_BOT_TOKEN || "").trim();
  const channel = normalizeTelegramChannel(env.TELEGRAM_CHANNEL);

  return {
    enabled: Boolean(token && channel),
    token,
    botUsername: String(env.TELEGRAM_BOT_USERNAME || "").trim() || null,
    channel,
    alertUrl: String(env.EWS_PUBLIC_URL || DEFAULT_ALERT_URL).trim() || DEFAULT_ALERT_URL,
  };
}

function formatEmergencyLevelAlert(snapshot, { alertUrl = DEFAULT_ALERT_URL, emergencyLevel = 5 } = {}) {
  const signal = getEmergencySnapshotSignal(snapshot);
  const actualCount = Number(signal?.actualConcurrentCount ?? snapshot?.current?.concurrentCount ?? 0);
  const expectedCount = Number(signal?.expectedConcurrentCount ?? snapshot?.current?.baselineMean ?? 0);
  const aboveExpectedCount = actualCount - expectedCount;

  return [
    `emergency level ${emergencyLevel}!`,
    `${formatCount(actualCount)} airborne (${formatSignedCount(aboveExpectedCount)} above expected)`,
    alertUrl,
  ].join("\n");
}

async function sendTelegramMessage({ token, channel }, text, { maxRetries = 3 } = {}) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(`${TELEGRAM_API_BASE_URL}/bot${token}/sendMessage`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        chat_id: channel,
        text,
        disable_web_page_preview: true,
      }),
    });
    const payload = await response.json().catch(() => ({}));

    if (response.status === 429 && attempt < maxRetries) {
      const retryAfter = Number(payload?.parameters?.retry_after ?? 5);
      await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
      continue;
    }

    if (!response.ok || !payload.ok) {
      throw new Error(payload.description || `Telegram request failed with ${response.status}`);
    }

    return payload.result;
  }
}

async function maybeSendEmergencyLevelTelegramAlert({
  snapshot,
  status = null,
  env = process.env,
  dryRun = false,
  logger = console,
} = {}) {
  const config = getTelegramAlertConfig(env);
  if (!config.enabled) {
    return {
      ok: true,
      sent: false,
      reason: "telegram_not_configured",
    };
  }

  const signal = getEmergencySnapshotSignal(snapshot);
  const emergencyLevel = Math.round(Number(signal?.emergencyLevel || 1));
  const minLevel = getAlertMinLevel(env);
  if (emergencyLevel < minLevel) {
    return {
      ok: true,
      sent: false,
      reason: "emergency_level_below_threshold",
      emergencyLevel,
      threshold: minLevel,
    };
  }

  const latestSlotKey = getLatestSlotKey(snapshot, status);
  const lastAlertedSlotKey = getMetaValue(TELEGRAM_ALERT_LAST_SLOT_META_KEY);
  if (latestSlotKey && lastAlertedSlotKey === latestSlotKey) {
    return {
      ok: true,
      sent: false,
      reason: "already_alerted_for_slot",
      latestSlotKey,
    };
  }

  const text = formatEmergencyLevelAlert(snapshot, {
    alertUrl: config.alertUrl,
    emergencyLevel,
  });

  if (dryRun) {
    logger.log(text);
    return {
      ok: true,
      sent: false,
      reason: "dry_run",
      latestSlotKey,
      text,
    };
  }

  const message = await sendTelegramMessage(config, text);
  if (latestSlotKey) {
    setMetaValue(TELEGRAM_ALERT_LAST_SLOT_META_KEY, latestSlotKey);
  }

  return {
    ok: true,
    sent: true,
    latestSlotKey,
    messageId: message?.message_id ?? null,
  };
}

module.exports = {
  DEFAULT_ALERT_URL,
  TELEGRAM_ALERT_LAST_SLOT_META_KEY,
  formatEmergencyLevelAlert,
  getTelegramAlertConfig,
  getEmergencySnapshotSignal,
  getLatestSlotKey,
  maybeSendEmergencyLevelTelegramAlert,
  normalizeTelegramChannel,
  sendTelegramMessage,
};
