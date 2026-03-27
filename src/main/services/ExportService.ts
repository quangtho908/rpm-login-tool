import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { getDb } from '../db/db'
import { decryptFromBase64, encryptToBase64 } from './CryptoService'
import { ensureProfilesRoot, getProfilesRoot } from './ProfileService'
import { audit } from './AuditLogService'
import { v4 as uuidv4 } from 'uuid'

const require = createRequire(import.meta.url)
const runtimePath = fileURLToPath(new URL('./export-runtime.cjs', import.meta.url))
const runtime = require(runtimePath) as {
  exportData: (input: { input: any; deps: any }) => Promise<{ path: string }>
  importData: (input: { input: any; deps: any }) => Promise<{ profiles: number; proxies: number }>
}

function getDeps() {
  return {
    getDb,
    decryptFromBase64,
    encryptToBase64,
    ensureProfilesRoot,
    getProfilesRoot,
    audit,
    uuidv4
  }
}

export async function exportData(input: {
  profileIds: string[]
  proxyIds: string[]
  includeCache: boolean
  password: string
  outputPath: string
}): Promise<{ path: string }> {
  return runtime.exportData({ input, deps: getDeps() })
}

export async function importData(input: {
  password: string
  zipPath: string
}): Promise<{ profiles: number; proxies: number }> {
  return runtime.importData({ input, deps: getDeps() })
}
