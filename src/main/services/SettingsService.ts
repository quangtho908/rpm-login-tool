import { getDb } from '../db/db'
import type { Settings } from '../../shared/types'

const DEFAULTS: Required<Settings> = {
  chromePath: null,
  ipCheckUrl: 'https://api.ipify.org?format=json'
}

export function getSettings(): Settings {
  const db = getDb()
  const rows = db.prepare('SELECT key, value FROM settings').all() as Array<{ key: string; value: string }>

  const out: Settings = { ...DEFAULTS }
  for (const r of rows) {
    if (r.key === 'chromePath') out.chromePath = r.value || null
    if (r.key === 'ipCheckUrl') out.ipCheckUrl = r.value || null
  }
  return out
}

export function setSettings(patch: Partial<Settings>): Settings {
  const db = getDb()
  const current = getSettings()
  const next: Settings = { ...current, ...patch }

  const stmt = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value')
  if (patch.chromePath !== undefined) stmt.run('chromePath', patch.chromePath ?? '')
  if (patch.ipCheckUrl !== undefined) stmt.run('ipCheckUrl', patch.ipCheckUrl ?? '')

  return next
}
