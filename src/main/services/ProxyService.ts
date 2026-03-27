import { getDb } from '../db/db'
import { v4 as uuidv4 } from 'uuid'
import type { ProxyRecord } from '../../shared/types'
import { decryptFromBase64, encryptToBase64 } from './CryptoService'
import { audit } from './AuditLogService'
import { getSettings } from './SettingsService'
import fetch from 'node-fetch'
import { HttpProxyAgent } from 'http-proxy-agent'
import { HttpsProxyAgent } from 'https-proxy-agent'
import { SocksProxyAgent } from 'socks-proxy-agent'

function rowToProxy(r: any): ProxyRecord {
  return {
    id: r.id,
    label: r.label,
    type: r.type,
    host: r.host,
    port: r.port,
    username: r.username ?? null,
    password: null, // never return decrypted password to renderer
    lastCheckAt: r.lastCheckAt ?? null,
    lastCheckOk: r.lastCheckOk ?? null,
    lastCheckLatencyMs: r.lastCheckLatencyMs ?? null,
    lastCheckIp: r.lastCheckIp ?? null,
    lastCheckError: r.lastCheckError ?? null
  }
}

export function listProxies(): ProxyRecord[] {
  const db = getDb()
  const rows = db.prepare('SELECT * FROM proxies ORDER BY createdAt DESC').all()
  return rows.map(rowToProxy)
}

export function createProxy(input: {
  label: string
  type: ProxyRecord['type']
  host: string
  port: number
  username?: string | null
  password?: string | null
}): ProxyRecord {
  const db = getDb()
  const id = uuidv4()
  const now = new Date().toISOString()

  const passwordEnc = input.password ? encryptToBase64(input.password) : null

  db.prepare(
    `INSERT INTO proxies (id, label, type, host, port, username, passwordEnc, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    input.label,
    input.type,
    input.host,
    input.port,
    input.username ?? null,
    passwordEnc,
    now
  )

  audit('proxies:create', { id, label: input.label })
  const row = db.prepare('SELECT * FROM proxies WHERE id=?').get(id)
  return rowToProxy(row)
}

export function deleteProxy(input: { id: string }): void {
  const db = getDb()

  // Clear proxy assignment from profiles to avoid dangling references.
  db.prepare('UPDATE profiles SET proxyId=NULL WHERE proxyId=?').run(input.id)

  db.prepare('DELETE FROM proxies WHERE id=?').run(input.id)
  audit('proxies:delete', { id: input.id })
}

export async function checkProxy(input: { id: string }): Promise<ProxyRecord> {
  const db = getDb()
  const row = db.prepare('SELECT * FROM proxies WHERE id=?').get(input.id) as any
  if (!row) throw new Error('Proxy not found')

  const settings = getSettings()
  const url = settings.ipCheckUrl || 'https://api.ipify.org?format=json'

  const username = row.username as string | null
  const password = row.passwordEnc ? decryptFromBase64(row.passwordEnc) : null

  const authPart = username && password ? `${encodeURIComponent(username)}:${encodeURIComponent(password)}@` : ''
  const proxyUrl = `${row.type}://${authPart}${row.host}:${row.port}`

  const started = Date.now()
  let ok = 0
  let ip: string | null = null
  let err: string | null = null

  try {
    const targetProtocol = new URL(url).protocol

    const agent =
      row.type === 'socks5'
        ? (new SocksProxyAgent(proxyUrl) as any)
        : targetProtocol === 'https:'
          ? (new HttpsProxyAgent(proxyUrl) as any)
          : (new HttpProxyAgent(proxyUrl) as any)

    const res = await fetch(url, { agent })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)

    const text = await res.text()
    try {
      const parsed = JSON.parse(text)
      ip = typeof parsed.ip === 'string' ? parsed.ip : text
    } catch {
      ip = text
    }

    ok = 1
  } catch (e: any) {
    ok = 0
    err = e?.message ? String(e.message) : String(e)
  }

  const latencyMs = Date.now() - started

  db.prepare(
    `UPDATE proxies
     SET lastCheckAt=?, lastCheckOk=?, lastCheckLatencyMs=?, lastCheckIp=?, lastCheckError=?
     WHERE id=?`
  ).run(new Date().toISOString(), ok, latencyMs, ip, err, input.id)

  audit('proxies:check', { id: input.id, ok, latencyMs, ip, err })

  const updated = db.prepare('SELECT * FROM proxies WHERE id=?').get(input.id)
  return rowToProxy(updated)
}

export function getProxyAuthForInternalUse(proxyId: string): {
  proxyUrlForChrome?: string
  proxyUrlForFetch: string
} {
  const db = getDb()
  const row = db.prepare('SELECT * FROM proxies WHERE id=?').get(proxyId) as any
  if (!row) throw new Error('Proxy not found')

  const username = row.username as string | null
  const password = row.passwordEnc ? decryptFromBase64(row.passwordEnc) : null

  const hostPort = `${row.host}:${row.port}`
  const authPart = username && password ? `${encodeURIComponent(username)}:${encodeURIComponent(password)}@` : ''
  const proxyUrlForFetch = `${row.type}://${authPart}${hostPort}`

  // Chrome CLI proxy auth is not fully supported; return only host:port for safer default.
  const proxyUrlForChrome = `${row.type}://${hostPort}`

  return { proxyUrlForChrome, proxyUrlForFetch }
}
