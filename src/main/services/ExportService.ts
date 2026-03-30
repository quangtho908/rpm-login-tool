import { createRequire } from 'node:module'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { getDb } from '../db/db'
import { decryptFromBase64, encryptToBase64 } from './CryptoService'
import { ensureProfilesRoot, getProfilesRoot } from './ProfileService'
import { audit } from './AuditLogService'
import { v4 as uuidv4 } from 'uuid'

const require = createRequire(import.meta.url)
type ExportRuntime = {
  exportData: (input: { input: any; deps: any }) => Promise<{ path: string }>
  importData: (input: { input: any; deps: any }) => Promise<{ profiles: number; proxies: number }>
}

let runtime: ExportRuntime | null = null

function getRuntime(): ExportRuntime {
  if (runtime) return runtime

  const currentFile = fileURLToPath(import.meta.url)
  const currentDir = dirname(currentFile)
  const candidates = [
    // Production/dist copy (created by scripts/copy-runtime.mjs)
    join(currentDir, 'export-runtime.cjs'),
    // Dev fallback when electron-vite serves from dist/main but runtime still lives in src
    join(process.cwd(), 'src', 'main', 'runtime', 'export-runtime.cjs'),
    // Secondary fallback in case dist layout keeps runtime under /runtime
    join(currentDir, 'runtime', 'export-runtime.cjs')
  ]

  const runtimePath = candidates.find((p) => existsSync(p))
  if (!runtimePath) {
    throw new Error(
      'Cannot locate export runtime. Tried: ' + candidates.join(', ')
    )
  }

  runtime = require(runtimePath) as ExportRuntime
  return runtime
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
  return getRuntime().exportData({ input, deps: getDeps() })
}

export async function importData(input: {
  password: string
  zipPath: string
}): Promise<{ profiles: number; proxies: number }> {
  return getRuntime().importData({ input, deps: getDeps() })
}
