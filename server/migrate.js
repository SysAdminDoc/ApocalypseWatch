const fs = require("node:fs");
const path = require("node:path");
const logger = require("./logger");

const MIGRATIONS_DIR = path.resolve(__dirname, "..", "migrations");

function ensureMigrationsTable(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

function getAppliedVersions(db) {
  return new Set(
    db.prepare("SELECT version FROM schema_migrations ORDER BY version ASC").all().map((r) => r.version),
  );
}

function discoverMigrations() {
  if (!fs.existsSync(MIGRATIONS_DIR)) return [];
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => /^\d{4}_.+\.sql$/.test(f))
    .sort()
    .map((f) => {
      const version = parseInt(f.split("_")[0], 10);
      return { version, name: f, path: path.join(MIGRATIONS_DIR, f) };
    });
}

function runMigrations(db) {
  ensureMigrationsTable(db);
  const applied = getAppliedVersions(db);
  const migrations = discoverMigrations();
  const pending = migrations.filter((m) => !applied.has(m.version));

  if (pending.length === 0) {
    return { applied: 0, total: migrations.length };
  }

  const insert = db.prepare("INSERT INTO schema_migrations (version, name) VALUES (?, ?)");

  for (const migration of pending) {
    const sql = fs.readFileSync(migration.path, "utf8");
    logger.info(`Applying migration ${migration.name}`);
    db.exec(sql);
    insert.run(migration.version, migration.name);
  }

  logger.info(`Applied ${pending.length} migration(s)`);
  return { applied: pending.length, total: migrations.length };
}

module.exports = { runMigrations };
