const { getMetaValue, setMetaValue } = require("./db");
const {
  DEFAULT_ALERT_URL,
  getEmergencySnapshotSignal,
  getLatestSlotKey,
  getAlertMinLevel,
} = require("./alert-helpers");

const DISCORD_ALERT_LAST_SLOT_META_KEY = "discord_level5_alert_last_slot_key";

const LEVEL_COLORS = {
  1: 0x74c7ec,
  2: 0x94e2d5,
  3: 0xf9e2af,
  4: 0xfab387,
  5: 0xf38ba8,
};

const DISCORD_WEBHOOK_PATTERN = /^https:\/\/discord\.com\/api\/webhooks\/\d+\/.+$/;

function getDiscordAlertConfig(env = process.env) {
  const webhookUrl = String(env.DISCORD_WEBHOOK_URL || "").trim();
  const valid = DISCORD_WEBHOOK_PATTERN.test(webhookUrl);
  if (webhookUrl && !valid) {
    const logger = require("./logger");
    logger.warn(`DISCORD_WEBHOOK_URL is set but does not match expected pattern (https://discord.com/api/webhooks/{id}/{token}). Discord alerts disabled.`);
  }
  return {
    enabled: Boolean(webhookUrl) && valid,
    webhookUrl,
    alertUrl: String(env.EWS_PUBLIC_URL || DEFAULT_ALERT_URL).trim() || DEFAULT_ALERT_URL,
  };
}

async function sendDiscordWebhook(webhookUrl, embed) {
  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ embeds: [embed] }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Discord webhook failed with ${response.status}: ${text}`);
  }
}

async function maybeSendEmergencyLevelDiscordAlert({
  snapshot,
  status = null,
  env = process.env,
  logger = console,
} = {}) {
  const config = getDiscordAlertConfig(env);
  if (!config.enabled) {
    return { ok: true, sent: false, reason: "discord_not_configured" };
  }

  const signal = getEmergencySnapshotSignal(snapshot);
  const emergencyLevel = Math.round(Number(signal?.emergencyLevel || 1));
  const minLevel = getAlertMinLevel(env);
  if (emergencyLevel < minLevel) {
    return { ok: true, sent: false, reason: "emergency_level_below_threshold", emergencyLevel, threshold: minLevel };
  }

  const latestSlotKey = getLatestSlotKey(snapshot, status);
  const lastAlertedSlotKey = getMetaValue(DISCORD_ALERT_LAST_SLOT_META_KEY);
  if (latestSlotKey && lastAlertedSlotKey === latestSlotKey) {
    return { ok: true, sent: false, reason: "already_alerted_for_slot", latestSlotKey };
  }

  const actualCount = Number(signal?.actualConcurrentCount ?? 0);
  const expectedCount = Number(signal?.expectedConcurrentCount ?? 0);
  const aboveExpected = actualCount - expectedCount;
  const sign = aboveExpected >= 0 ? "+" : "";

  const embed = {
    title: `Emergency Level ${emergencyLevel}!`,
    description: `**${actualCount}** airborne (${sign}${aboveExpected} above expected)`,
    url: config.alertUrl,
    color: LEVEL_COLORS[emergencyLevel] ?? LEVEL_COLORS[5],
    timestamp: new Date().toISOString(),
    footer: { text: "ApocalypseWatch" },
  };

  try {
    await sendDiscordWebhook(config.webhookUrl, embed);
  } catch (error) {
    logger.error("Discord alert failed:", error.message);
    return { ok: false, sent: false, reason: "discord_send_failed", error: error.message };
  }

  if (latestSlotKey) {
    setMetaValue(DISCORD_ALERT_LAST_SLOT_META_KEY, latestSlotKey);
  }

  return { ok: true, sent: true, latestSlotKey };
}

module.exports = {
  getDiscordAlertConfig,
  maybeSendEmergencyLevelDiscordAlert,
};
