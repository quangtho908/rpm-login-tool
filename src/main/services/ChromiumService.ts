import { join } from 'node:path'
import { createRequire } from 'node:module'
import fetch from 'node-fetch'

// Lazy-load `@puppeteer/browsers` so app startup doesn't depend on it.
async function getPuppeteerBrowsers() {
  return import('@puppeteer/browsers')
}

const require = createRequire(import.meta.url)
const electron = require('electron') as typeof import('electron')
const { app } = electron

export function getChromiumCacheDir(): string {
  return join(app.getPath('userData'), 'browser-cache')
}

async function resolveChromiumRevision(buildId: string, platform: string): Promise<string> {
  // `@puppeteer/browsers` treats Chromium buildId as a snapshot revision number.
  // The string "latest" is NOT a valid folder on Chromium snapshots, so we resolve it manually.
  if (buildId !== 'latest') return buildId

  const platformFolderMap: Record<string, string> = {
    mac: 'Mac',
    mac_arm: 'Mac_Arm',
    linux: 'Linux_x64',
    linux_arm: 'Linux_Arm',
    win32: 'Win',
    win64: 'Win_x64'
  }

  const folder = platformFolderMap[platform]
  if (!folder) throw new Error(`Unsupported platform for Chromium snapshots: ${platform}`)

  const lastChangeUrl = `https://storage.googleapis.com/chromium-browser-snapshots/${folder}/LAST_CHANGE`
  const res = await fetch(lastChangeUrl)
  if (!res.ok) throw new Error(`Failed to resolve latest Chromium revision. HTTP ${res.status} (${lastChangeUrl})`)

  const text = (await res.text()).trim()
  if (!/^\d+$/.test(text)) throw new Error(`Invalid LAST_CHANGE response: ${text}`)

  return text
}

export async function installChromium(input?: { buildId?: string }): Promise<{
  buildId: string
  executablePath: string
}> {
  const { Browser, detectBrowserPlatform, install, computeExecutablePath } = await getPuppeteerBrowsers()

  const platform = detectBrowserPlatform()
  if (!platform) throw new Error('Cannot detect current platform for Chromium download')

  const requestedBuildId = (input?.buildId?.trim() || 'latest').toLowerCase()
  const resolvedBuildId = await resolveChromiumRevision(requestedBuildId, String(platform))

  const result = await install({
    browser: Browser.CHROMIUM,
    buildId: resolvedBuildId,
    cacheDir: getChromiumCacheDir(),
    platform
  })

  // `install()` already returns the executablePath, but we compute again for consistency.
  const executablePath = computeExecutablePath({
    browser: Browser.CHROMIUM,
    buildId: result.buildId,
    cacheDir: getChromiumCacheDir(),
    platform
  })

  return { buildId: result.buildId, executablePath }
}

export async function getInstalledChromiumExecutablePath(input: { buildId: string }): Promise<string> {
  const { Browser, detectBrowserPlatform, computeExecutablePath } = await getPuppeteerBrowsers()

  const platform = detectBrowserPlatform()
  if (!platform) throw new Error('Cannot detect current platform')

  return computeExecutablePath({
    browser: Browser.CHROMIUM,
    buildId: input.buildId,
    cacheDir: getChromiumCacheDir(),
    platform
  })
}
