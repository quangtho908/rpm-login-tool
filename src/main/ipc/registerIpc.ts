import { createRequire } from 'node:module'
import { z } from 'zod'
import { getSettings, setSettings } from '../services/SettingsService'
import { createProfile, deleteProfile, listProfiles, setProfileProxy } from '../services/ProfileService'
import { closeProfile, launchProfile } from '../services/ChromeLauncher'
import { checkProxy, createProxy, deleteProxy, listProxies } from '../services/ProxyService'
import { generateTotpSecret, getTotpCode, setTotpSecret } from '../services/TotpService'
import { installChromium } from '../services/ChromiumService'
import { exportData, importData } from '../services/ExportService'

const require = createRequire(import.meta.url)
const electron = require('electron') as typeof import('electron')
const { ipcMain, dialog } = electron

export function registerIpc() {
  ipcMain.handle('settings:get', async () => getSettings())
  ipcMain.handle('settings:set', async (_evt, patch) => {
    const schema = z.object({
      chromePath: z.string().nullable().optional(),
      ipCheckUrl: z.string().nullable().optional()
    })
    return setSettings(schema.parse(patch))
  })

  ipcMain.handle('profiles:list', async () => listProfiles())
  ipcMain.handle('profiles:create', async (_evt, input) => {
    const schema = z.object({ name: z.string().min(1).max(80) })
    return createProfile(schema.parse(input))
  })
  ipcMain.handle('profiles:delete', async (_evt, input) => {
    const schema = z.object({ id: z.string().uuid() })
    await deleteProfile(schema.parse(input))
  })
  ipcMain.handle('profiles:launch', async (_evt, input) => {
    const schema = z.object({ id: z.string().uuid() })
    return launchProfile({ profileId: schema.parse(input).id })
  })
  ipcMain.handle('profiles:close', async (_evt, input) => {
    const schema = z.object({ id: z.string().uuid() })
    await closeProfile({ profileId: schema.parse(input).id })
  })
  ipcMain.handle('profiles:setProxy', async (_evt, input) => {
    const schema = z.object({
      profileId: z.string().uuid(),
      proxyId: z.string().uuid().nullable()
    })
    setProfileProxy(schema.parse(input))
  })

  ipcMain.handle('totp:generateSecret', async () => generateTotpSecret())

  ipcMain.handle('totp:setSecret', async (_evt, input) => {
    const schema = z.object({
      profileId: z.string().uuid(),
      issuer: z.string().max(200).nullable().optional(),
      accountName: z.string().max(200).nullable().optional(),
      secret: z.string().min(4).max(256)
    })
    setTotpSecret(schema.parse(input))
  })

  ipcMain.handle('totp:getCode', async (_evt, input) => {
    const schema = z.object({ profileId: z.string().uuid() })
    return getTotpCode(schema.parse(input))
  })

  ipcMain.handle('chromium:install', async (_evt, input) => {
    const schema = z
      .object({ buildId: z.string().max(40).optional() })
      .optional()
    const r = await installChromium(schema.parse(input))

    // Store path as chromePath so launcher can use it.
    setSettings({ chromePath: r.executablePath })

    return r
  })

  ipcMain.handle('data:export', async (_evt, input) => {
    const schema = z.object({
      profileIds: z.array(z.string().uuid()),
      proxyIds: z.array(z.string().uuid()),
      includeCache: z.boolean(),
      password: z.string().min(1)
    })
    const payload = schema.parse(input)

    const defaultName = `chrome-profile-tool-export-${new Date().toISOString().replace(/[:.]/g, '-')}.zip`
    const dialogResult = await dialog.showSaveDialog({
      title: 'Export data',
      defaultPath: defaultName,
      filters: [{ name: 'Zip Archive', extensions: ['zip'] }]
    })

    if (dialogResult.canceled || !dialogResult.filePath) {
      return { canceled: true }
    }

    const result = await exportData({ ...payload, outputPath: dialogResult.filePath })
    return { canceled: false, path: result.path }
  })

  ipcMain.handle('data:import', async (_evt, input) => {
    const schema = z.object({ password: z.string().min(1) })
    const payload = schema.parse(input)

    const dialogResult = await dialog.showOpenDialog({
      title: 'Import data',
      filters: [{ name: 'Zip Archive', extensions: ['zip'] }],
      properties: ['openFile']
    })

    if (dialogResult.canceled || dialogResult.filePaths.length === 0) {
      return { canceled: true, profiles: 0, proxies: 0 }
    }

    const result = await importData({ ...payload, zipPath: dialogResult.filePaths[0] })
    return { canceled: false, profiles: result.profiles, proxies: result.proxies }
  })

  ipcMain.handle('proxies:list', async () => listProxies())
  ipcMain.handle('proxies:create', async (_evt, input) => {
    const schema = z.object({
      label: z.string().min(1).max(120),
      type: z.enum(['http', 'https', 'socks5']),
      host: z.string().min(1).max(255),
      port: z.number().int().min(1).max(65535),
      username: z.string().max(255).nullable().optional(),
      password: z.string().max(255).nullable().optional()
    })
    return createProxy(schema.parse(input))
  })
  ipcMain.handle('proxies:delete', async (_evt, input) => {
    const schema = z.object({ id: z.string().uuid() })
    deleteProxy(schema.parse(input))
  })
  ipcMain.handle('proxies:check', async (_evt, input) => {
    const schema = z.object({ id: z.string().uuid() })
    return checkProxy(schema.parse(input))
  })
}
