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
  recordLevelTransition,
  getLevelTransitions,
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
        const prevLevel = snapshot?.current?.emergencyLevel ?? null;
        const nextSnapshot = buildDashboardSnapshot({
          liveStatus: heatmapRefresher.getStatus(),
        });
        const nextLevel = nextSnapshot?.current?.emergencyLevel ?? 1;

        if (prevLevel !== null && nextLevel !== prevLevel) {
          try {
            recordLevelTransition({
              transitionedAt: nextSnapshot?.current?.asOf || new Date().toISOString(),
              fromLevel: prevLevel,
              toLevel: nextLevel,
              sigmaShift: nextSnapshot?.current?.zScore,
              concurrentCount: nextSnapshot?.current?.concurrentCount,
              expectedCount: nextSnapshot?.current?.baselineMean,
            });
            logger.info(`Level transition: ${prevLevel} → ${nextLevel}`);
          } catch (err) {
            logger.error("Failed to record level transition:", err);
          }
        }

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

app.get("/api/events", (request, response) => {
  const limit = Math.min(500, Math.max(1, Number(request.query.limit) || 100));
  const transitions = getLevelTransitions(limit);
  response.json({ transitions });
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

const MAX_SSE_CLIENTS = Number(process.env.MAX_SSE_CLIENTS) || 200;

app.get("/api/stream", (request, response) => {
  if (sseClients.size >= MAX_SSE_CLIENTS) {
    response.set("Retry-After", "30");
    response.status(503).json({ error: "Too many SSE connections. Try again later." });
    return;
  }

  response.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  response.flushHeaders();
  response.write(`retry: 5000\n\n`);

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

const RANGE_DAYS = { "24h": 1, "7d": 7, "30d": 30, "1y": 365 };

function filterArchiveByDays(archive, days) {
  if (!archive || archive.v !== 1 || !archive.c || !archive.c.length) return archive;
  const startMs = Date.parse(archive.t0);
  if (!Number.isFinite(startMs)) return archive;

  const timestamps = [startMs];
  const tr = archive.tr;
  for (let i = 0; i < tr.length; i++) {
    const run = tr[i];
    if (Array.isArray(run)) {
      const [delta, count] = run;
      for (let j = 0; j < count; j++) timestamps.push(timestamps[timestamps.length - 1] + delta);
    } else {
      timestamps.push(timestamps[timestamps.length - 1] + run);
    }
  }

  const cutoff = timestamps[timestamps.length - 1] - days * 86_400_000;
  let startIdx = 0;
  for (let i = 0; i < timestamps.length; i++) {
    if (timestamps[i] >= cutoff) { startIdx = i; break; }
  }
  if (startIdx === 0) return archive;

  const slicedRecords = [];
  for (let i = startIdx; i < timestamps.length && i < archive.c.length; i++) {
    slicedRecords.push({
      sampledAt: new Date(timestamps[i]).toISOString(),
      concurrentCount: archive.c[i],
      expectedConcurrentCount: archive.p?.[i],
      expectedConcurrentStdDev: archive.s?.[i],
    });
  }
  if (!slicedRecords.length) return archive;

  const deltas = [];
  for (let i = 1; i < slicedRecords.length; i++) {
    deltas.push(Date.parse(slicedRecords[i].sampledAt) - Date.parse(slicedRecords[i - 1].sampledAt));
  }
  const tr2 = [];
  let i = 0;
  while (i < deltas.length) {
    let count = 1;
    while (i + count < deltas.length && deltas[i + count] === deltas[i]) count++;
    tr2.push(count > 1 ? [deltas[i], count] : deltas[i]);
    i += count;
  }

  return {
    v: 1,
    t0: slicedRecords[0].sampledAt,
    tr: tr2,
    c: slicedRecords.map((r) => r.concurrentCount),
    p: slicedRecords.map((r) => r.expectedConcurrentCount),
    s: slicedRecords.map((r) => r.expectedConcurrentStdDev),
  };
}

app.get("/api/dashboard", (request, response) => {
  const snapshot = dashboardSnapshotManager.getSnapshot();
  if (!snapshot) {
    response.status(503).json({
      error: "Dashboard snapshot is not ready yet.",
    });
    return;
  }

  const rangeDays = RANGE_DAYS[request.query.range];
  if (rangeDays && snapshot.trends?.archive) {
    const filtered = { ...snapshot, trends: { ...snapshot.trends, archive: filterArchiveByDays(snapshot.trends.archive, rangeDays) } };
    response.json(filtered);
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
