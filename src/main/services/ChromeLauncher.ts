import { spawn } from 'node:child_process'
import { access } from 'node:fs/promises'
import { constants } from 'node:fs'
import { platform } from 'node:os'
import { getDb } from '../db/db'
import { getSettings } from './SettingsService'
import { getProxyAuthForInternalUse } from './ProxyService'
import { clearProfilePid, setProfileLastLaunch } from './ProfileService'
import { audit } from './AuditLogService'

const running = new Map<string, number>() // profileId -> pid

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.X_OK)
    return true
  } catch {
    return false
  }
}

export async function resolveChromePath(): Promise<string> {
  const settings = getSettings()
  if (settings.chromePath && (await fileExists(settings.chromePath))) return settings.chromePath

  const p = platform()
  const candidates: string[] = []

  if (p === 'darwin') {
    candidates.push('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
    candidates.push('/Applications/Chromium.app/Contents/MacOS/Chromium')
  } else if (p === 'win32') {
    candidates.push('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe')
    candidates.push('C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe')
    candidates.push('C:\\Program Files\\Chromium\\Application\\chrome.exe')
  } else {
    candidates.push('/usr/bin/google-chrome')
    candidates.push('/usr/bin/google-chrome-stable')
    candidates.push('/usr/bin/chromium-browser')
    candidates.push('/usr/bin/chromium')
  }

  for (const c of candidates) {
    if (await fileExists(c)) return c
  }

  throw new Error('Chrome/Chromium not found. Open Settings and either set Chrome path, or use “Download & Install Chromium”.')
}

export async function launchProfile(input: { profileId: string; startUrl?: string }): Promise<{ pid: number }> {
  const db = getDb()
  const profile = db.prepare('SELECT * FROM profiles WHERE id=?').get(input.profileId) as any
  if (!profile) throw new Error('Profile not found')

  const chromePath = await resolveChromePath()

  const args: string[] = [
    `--user-data-dir=${profile.userDataDir}`,
    '--no-first-run',
    '--no-default-browser-check'
  ]

  if (profile.proxyId) {
    try {
      const { proxyUrlForChrome } = getProxyAuthForInternalUse(profile.proxyId)
      if (proxyUrlForChrome) args.push(`--proxy-server=${proxyUrlForChrome}`)
    } catch (e: any) {
      // If proxy was deleted, clear the reference and continue without proxy.
      if (String(e?.message ?? e).includes('Proxy not found')) {
        db.prepare('UPDATE profiles SET proxyId=NULL WHERE id=?').run(profile.id)
      } else {
        throw e
      }
    }
  }

  if (input.startUrl) args.push(input.startUrl)

  const child = spawn(chromePath, args, { stdio: 'ignore', detached: true })
  child.unref()

  if (!child.pid) throw new Error('Failed to start Chrome')

  running.set(input.profileId, child.pid)
  setProfileLastLaunch({ profileId: input.profileId, pid: child.pid })
  audit('profiles:launch', { profileId: input.profileId, pid: child.pid })

  return { pid: child.pid }
}

export async function closeProfile(input: { profileId: string }): Promise<void> {
  const pid = running.get(input.profileId)
  if (!pid) {
    // Best-effort: try lastPid from DB
    const db = getDb()
    const row = db.prepare('SELECT lastPid FROM profiles WHERE id=?').get(input.profileId) as any
    if (row?.lastPid) {
      try {
        process.kill(row.lastPid)
      } catch {
        // ignore
      }
    }
    clearProfilePid({ profileId: input.profileId })
    return
  }

  try {
    process.kill(pid)
  } catch {
    // ignore
  } finally {
    running.delete(input.profileId)
    clearProfilePid({ profileId: input.profileId })
    audit('profiles:close', { profileId: input.profileId, pid })
  }
}
