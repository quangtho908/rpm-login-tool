import { join } from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { existsSync } from 'node:fs'
import { registerIpc } from './ipc/registerIpc'
import { ensureProfilesRoot } from './services/ProfileService'
import { getDb } from './db/db'

// Avoid ESM named-exports interop issues: load Electron via require.
const require = createRequire(import.meta.url)
const electron = require('electron') as typeof import('electron')
const { app, BrowserWindow } = electron

process.on('uncaughtException', (err) => {
  // eslint-disable-next-line no-console
  console.error('[main] uncaughtException', err)
})
process.on('unhandledRejection', (err) => {
  // eslint-disable-next-line no-console
  console.error('[main] unhandledRejection', err)
})

let mainWindow: import('electron').BrowserWindow | null = null

async function createWindow() {
  const preloadPath = fileURLToPath(new URL('../preload/index.cjs', import.meta.url))
  const rendererIndexPath = fileURLToPath(new URL('../renderer/index.html', import.meta.url))

  // eslint-disable-next-line no-console
  console.log('[main] preloadPath =', preloadPath, 'exists=', existsSync(preloadPath))

  mainWindow = new BrowserWindow({
    width: 1100,
    height: 750,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  mainWindow.webContents.on('preload-error', (_event, path, error) => {
    // eslint-disable-next-line no-console
    console.error('[main] preload-error', path, error)
  })

  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    // eslint-disable-next-line no-console
    console.error('[main] render-process-gone', details)
  })

  mainWindow.webContents.on('did-finish-load', async () => {
    try {
      const t = await mainWindow!.webContents.executeJavaScript('typeof window.api', true)
      // eslint-disable-next-line no-console
      console.log('[main] renderer typeof window.api =', t)
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[main] executeJavaScript failed', e)
    }
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    await mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    await mainWindow.loadFile(rendererIndexPath)
  }
}

app.whenReady().then(async () => {
  // Ensure DB and folders
  getDb()
  await ensureProfilesRoot()

  registerIpc()
  await createWindow()

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) await createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
