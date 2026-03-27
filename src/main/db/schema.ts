import type Database from 'better-sqlite3'

export function ensureSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS profiles (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      tags TEXT,
      notes TEXT,
      userDataDir TEXT NOT NULL,
      proxyId TEXT,
      createdAt TEXT NOT NULL,
      lastLaunchedAt TEXT,
      lastPid INTEGER
    );

    CREATE TABLE IF NOT EXISTS proxies (
      id TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      type TEXT NOT NULL,
      host TEXT NOT NULL,
      port INTEGER NOT NULL,
      username TEXT,
      passwordEnc TEXT,
      createdAt TEXT NOT NULL,
      lastCheckAt TEXT,
      lastCheckOk INTEGER,
      lastCheckLatencyMs INTEGER,
      lastCheckIp TEXT,
      lastCheckError TEXT
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS totp_secrets (
      profileId TEXT PRIMARY KEY,
      issuer TEXT,
      accountName TEXT,
      secretEnc TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      action TEXT NOT NULL,
      payloadJson TEXT,
      createdAt TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_profiles_proxyId ON profiles(proxyId);
  `)
}
