import { join } from 'node:path'
import { createRequire } from 'node:module'
import { mkdir, rm } from 'node:fs/promises'
import { v4 as uuidv4 } from 'uuid'
import { getDb } from '../db/db'
import type { ProfileRecord } from '../../shared/types'
import { audit } from './AuditLogService'

const require = createRequire(import.meta.url)
const electron = require('electron') as typeof import('electron')
const { app } = electron

export function getProfilesRoot(): string {
  return join(app.getPath('userData'), 'profiles')
}

export async function ensureProfilesRoot() {
  await mkdir(getProfilesRoot(), { recursive: true })
}

function rowToProfile(r: any): ProfileRecord {
  return {
    id: r.id,
    name: r.name,
    tags: r.tags ?? null,
    notes: r.notes ?? null,
    userDataDir: r.userDataDir,
    proxyId: r.proxyId ?? null,
    createdAt: r.createdAt,
    lastLaunchedAt: r.lastLaunchedAt ?? null,
    lastPid: r.lastPid ?? null
  }
}

export function listProfiles(): ProfileRecord[] {
  const db = getDb()
  const rows = db.prepare('SELECT * FROM profiles ORDER BY createdAt DESC').all()
  return rows.map(rowToProfile)
}

export async function createProfile(input: { name: string }): Promise<ProfileRecord> {
  const db = getDb()
  await ensureProfilesRoot()

  const id = uuidv4()
  const userDataDir = join(getProfilesRoot(), id)
  await mkdir(userDataDir, { recursive: true })

  const now = new Date().toISOString()
  db.prepare(
    `INSERT INTO profiles (id, name, userDataDir, createdAt) VALUES (?, ?, ?, ?)`
  ).run(id, input.name, userDataDir, now)

  audit('profiles:create', { id, name: input.name })

  const row = db.prepare('SELECT * FROM profiles WHERE id=?').get(id)
  return rowToProfile(row)
}

export async function deleteProfile(input: { id: string }): Promise<void> {
  const db = getDb()
  const row = db.prepare('SELECT * FROM profiles WHERE id=?').get(input.id) as any
  if (!row) return

  db.prepare('DELETE FROM profiles WHERE id=?').run(input.id)
  audit('profiles:delete', { id: input.id })

  // delete folder best-effort
  try {
    await rm(row.userDataDir, { recursive: true, force: true })
  } catch {
    // ignore
  }
}

export function setProfileProxy(input: { profileId: string; proxyId: string | null }): void {
  const db = getDb()
  db.prepare('UPDATE profiles SET proxyId=? WHERE id=?').run(input.proxyId, input.profileId)
  audit('profiles:setProxy', input)
}

export function setProfileLastLaunch(input: { profileId: string; pid: number }): void {
  const db = getDb()
  db.prepare('UPDATE profiles SET lastLaunchedAt=?, lastPid=? WHERE id=?').run(
    new Date().toISOString(),
    input.pid,
    input.profileId
  )
}

export function clearProfilePid(input: { profileId: string }): void {
  const db = getDb()
  db.prepare('UPDATE profiles SET lastPid=NULL WHERE id=?').run(input.profileId)
}
