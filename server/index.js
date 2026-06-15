const fs = require("node:fs");
const path = require("node:path");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const pinoHttp = require("pino-http");
const logger = require("./logger");
const { loadEnvFile } = require("./env");
const { CLIENT_DIST_DIR, readWatchlist } = require("./config");
const {
  initDb,
  getMetaValue,
  setMetaValue,
  upsertTrackedAircraft,
  getTrackingSummary,
  pruneOldObservations,
  detectRollingMetricGaps,
} = require("./db");
const { createHeatmapCacheRefresher } = require("./heatmap-cache");
const { buildDashboardSnapshot } = require("./dashboard");
const { maybeSendEmergencyLevelTelegramAlert } = require("./telegram-alert");
const { maybeSendEmergencyLevelDiscordAlert } = require("./discord-alert");
const { maybeSendEmergencyLevelNtfyAlert } = require("./ntfy-alert");
const { buildEmergencyRssFeedXml, maybeRecordEmergencyLevelRssItem } = require("./rss-feed");

loadEnvFile();

const app = express();
const PORT = Number(process.env.PORT || 3030);
const DASHBOARD_SNAPSHOT_META_KEY = "dashboard_snapshot_v1";

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "blob:"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
      },
    },
  })
);

const CORS_ORIGINS = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(",").map((s) => s.trim())
  : undefined;
app.use(cors(CORS_ORIGINS ? { origin: CORS_ORIGINS } : undefined));

app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: "draft-8",
    legacyHeaders: false,
  })
);
app.use(express.json());
app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === "/api/health" } }));

function loadPersistedDashboardSnapshot() {
  const savedValue = getMetaValue(DASHBOARD_SNAPSHOT_META_KEY);
  if (!savedValue) {
    return null;
  }

  try {
    return JSON.parse(savedValue);
  } catch {
    return null;
  }
}

function createDashboardSnapshotManager() {
  let snapshot = loadPersistedDashboardSnapshot();
  let refreshPromise = null;

  function hasSnapshot() {
    return Boolean(snapshot);
  }

  function getSnapshot() {
    return snapshot;
  }

  async function refresh({ reason = "manual" } = {}) {
    if (refreshPromise) {
      return refreshPromise;
    }

    refreshPromise = Promise.resolve()
      .then(() => {
        const nextSnapshot = buildDashboardSnapshot({
          liveStatus: heatmapRefresher.getStatus(),
        });
        snapshot = nextSnapshot;
        setMetaValue(DASHBOARD_SNAPSHOT_META_KEY, JSON.stringify(nextSnapshot));
        return nextSnapshot;
      })
      .catch((error) => {
        logger.error(`Dashboard snapshot refresh failed (${reason}):`, error);
        if (snapshot) {
          return snapshot;
        }
        throw error;
      })
      .finally(() => {
        refreshPromise = null;
      });

    return refreshPromise;
  }

  async function ensureReady() {
    if (snapshot) {
      return snapshot;
    }

    return refresh({ reason: "startup" });
  }

  return {
    hasSnapshot,
    getSnapshot,
    refresh,
    ensureReady,
  };
}

const dashboardSnapshotManager = createDashboardSnapshotManager();
const heatmapRefresher = createHeatmapCacheRefresher({
  onRefreshComplete({ success }) {
    if (!success) {
      return;
    }

    try {
      const pruned = pruneOldObservations(90);
      if (pruned > 0) {
        logger.info(`Pruned ${pruned} observations older than 90 days.`);
      }
    } catch (error) {
      logger.error("Observation pruning failed:", error);
    }

    void dashboardSnapshotManager
      .refresh({ reason: "heatmap_refresh" })
      .then(async (snapshot) => {
        broadcastSSE(snapshot);
        const status = heatmapRefresher.getStatus();
        const rssResult = maybeRecordEmergencyLevelRssItem({
          snapshot,
          status,
        });
        const [telegramResult, discordResult, ntfyResult] = await Promise.all([
          maybeSendEmergencyLevelTelegramAlert({ snapshot, status }),
          maybeSendEmergencyLevelDiscordAlert({ snapshot, status }),
          maybeSendEmergencyLevelNtfyAlert({ snapshot, status }),
        ]);

        return { rssResult, telegramResult, discordResult, ntfyResult };
      })
      .then(({ rssResult, telegramResult, discordResult, ntfyResult }) => {
        if (rssResult?.updated) {
          logger.info(`RSS emergency alert recorded for ${rssResult.latestSlotKey || "latest heatmap"}.`);
        }

        if (telegramResult?.sent) {
          logger.info(`Telegram emergency alert sent for ${telegramResult.latestSlotKey || "latest heatmap"}.`);
        }

        if (discordResult?.sent) {
          logger.info(`Discord emergency alert sent for ${discordResult.latestSlotKey || "latest heatmap"}.`);
        }

        if (ntfyResult?.sent) {
          logger.info(`ntfy emergency alert sent for ${ntfyResult.latestSlotKey || "latest heatmap"}.`);
        }
      })
      .catch((error) => {
        logger.error("Emergency alert handling failed:", error);
      });
  },
});

app.get("/api/health", (_request, response) => {
  const refreshStatus = heatmapRefresher.getStatus();
  const gaps = detectRollingMetricGaps(7);
  response.json({
    ok: true,
    now: new Date().toISOString(),
    lastRefreshAt: refreshStatus.lastSuccessAt ?? null,
    lastError: refreshStatus.lastError ?? null,
    dbConnected: dashboardSnapshotManager.hasSnapshot(),
    gaps: { count: gaps.length, items: gaps },
  });
});

app.get("/api/watchlist", (_request, response) => {
  const watchlist = readWatchlist();
  response.json({
    configured: watchlist.configured,
    reason: watchlist.reason || null,
    entries: watchlist.entries,
  });
});

app.get("/api/cohort", (_request, response) => {
  response.json(getTrackingSummary());
});

const sseClients = new Set();
let sseEventId = 0;

function broadcastSSE(snapshot) {
  sseEventId += 1;
  const data = JSON.stringify(snapshot);
  for (const client of sseClients) {
    client.write(`id: ${sseEventId}\ndata: ${data}\n\n`);
  }
}

app.get("/api/stream", (request, response) => {
  response.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  response.flushHeaders();

  const snapshot = dashboardSnapshotManager.getSnapshot();
  if (snapshot) {
    response.write(`id: ${sseEventId}\ndata: ${JSON.stringify(snapshot)}\n\n`);
  }

  sseClients.add(response);

  const heartbeat = setInterval(() => {
    response.write(": heartbeat\n\n");
  }, 30_000);

  request.on("close", () => {
    clearInterval(heartbeat);
    sseClients.delete(response);
  });
});

app.get("/api/dashboard", (_request, response) => {
  const snapshot = dashboardSnapshotManager.getSnapshot();
  if (!snapshot) {
    response.status(503).json({
      error: "Dashboard snapshot is not ready yet.",
    });
    return;
  }

  response.json(snapshot);
});

app.get(["/rss.xml", "/feed.xml"], (_request, response) => {
  response
    .type("application/rss+xml")
    .set("Cache-Control", "public, max-age=300")
    .send(buildEmergencyRssFeedXml());
});

if (fs.existsSync(CLIENT_DIST_DIR)) {
  app.use(express.static(CLIENT_DIST_DIR));
  app.get("/{*asset}", (_request, response) => {
    response.sendFile(path.join(CLIENT_DIST_DIR, "index.html"));
  });
}

async function start() {
  initDb();
  const watchlist = readWatchlist();
  if (watchlist.entries.length) {
    upsertTrackedAircraft(watchlist.entries);
  }

  const hadPersistedSnapshot = dashboardSnapshotManager.hasSnapshot();
  await dashboardSnapshotManager.ensureReady();

  app.listen(PORT, () => {
    logger.info(`EWS server listening on http://localhost:${PORT}`);
  });

  heatmapRefresher.start();
  if (hadPersistedSnapshot) {
    void dashboardSnapshotManager.refresh({ reason: "startup_rebuild" });
  }
}

start().catch((error) => {
  logger.error(error);
  process.exitCode = 1;
});
