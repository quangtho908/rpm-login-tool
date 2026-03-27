import { join } from 'node:path'
import { createRequire } from 'node:module'
import { ensureSchema } from './schema'

// better-sqlite3 is a native addon (CJS). Use createRequire to load it reliably from ESM.
const require = createRequire(import.meta.url)
const electron = require('electron') as typeof import('electron')
const { app } = electron

const Database = require('better-sqlite3') as typeof import('better-sqlite3')

let db: import('better-sqlite3').Database | null = null

export function getDb(): import('better-sqlite3').Database {
  if (db) return db

  const dbPath = join(app.getPath('userData'), 'app.sqlite')
  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  ensureSchema(db)
  return db
}
