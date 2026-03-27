import { createRequire } from 'node:module'
import type { IpcApi } from '../shared/ipc'

const require = createRequire(import.meta.url)
const electron = require('electron') as typeof import('electron')
const { contextBridge, ipcRenderer } = electron

const api: IpcApi = {
  settingsGet: () => ipcRenderer.invoke('settings:get'),
  settingsSet: (patch) => ipcRenderer.invoke('settings:set', patch),

  profilesList: () => ipcRenderer.invoke('profiles:list'),
  profilesCreate: (input) => ipcRenderer.invoke('profiles:create', input),
  profilesDelete: (input) => ipcRenderer.invoke('profiles:delete', input),
  profilesLaunch: (input) => ipcRenderer.invoke('profiles:launch', input),
  profilesClose: (input) => ipcRenderer.invoke('profiles:close', input),
  profilesSetProxy: (input) => ipcRenderer.invoke('profiles:setProxy', input),

  totpGenerateSecret: () => ipcRenderer.invoke('totp:generateSecret'),
  totpSetSecret: (input) => ipcRenderer.invoke('totp:setSecret', input),
  totpGetCode: (input) => ipcRenderer.invoke('totp:getCode', input),

  chromiumInstall: (input) => ipcRenderer.invoke('chromium:install', input),

  dataExport: (input) => ipcRenderer.invoke('data:export', input),
  dataImport: (input) => ipcRenderer.invoke('data:import', input),

  proxiesList: () => ipcRenderer.invoke('proxies:list'),
  proxiesCreate: (input) => ipcRenderer.invoke('proxies:create', input),
  proxiesDelete: (input) => ipcRenderer.invoke('proxies:delete', input),
  proxiesCheck: (input) => ipcRenderer.invoke('proxies:check', input)
}

try {
  contextBridge.exposeInMainWorld('api', api)
  // eslint-disable-next-line no-console
  console.log('[preload] api exposed')
} catch (e) {
  // eslint-disable-next-line no-console
  console.error('[preload] failed to expose api', e)
}
