import type { ProfileRecord, ProxyRecord, Settings } from './types'

export type IpcApi = {
  settingsGet: () => Promise<Settings>
  settingsSet: (patch: Partial<Settings>) => Promise<Settings>

  profilesList: () => Promise<ProfileRecord[]>
  profilesCreate: (input: { name: string }) => Promise<ProfileRecord>
  profilesDelete: (input: { id: string }) => Promise<void>
  profilesLaunch: (input: { id: string }) => Promise<{ pid: number }>
  profilesClose: (input: { id: string }) => Promise<void>
  profilesSetProxy: (input: { profileId: string; proxyId: string | null }) => Promise<void>

  totpGenerateSecret: () => Promise<{ secret: string }>
  totpSetSecret: (input: { profileId: string; issuer?: string | null; accountName?: string | null; secret: string }) => Promise<void>
  totpGetCode: (input: { profileId: string }) => Promise<{ code: string; secondsRemaining: number }>

  chromiumInstall: (input?: { buildId?: string }) => Promise<{ buildId: string; executablePath: string }>

  dataExport: (input: { profileIds: string[]; proxyIds: string[]; includeCache: boolean; password: string }) => Promise<{
    canceled: boolean
    path?: string
  }>
  dataImport: (input: { password: string }) => Promise<{ canceled: boolean; profiles: number; proxies: number }>

  proxiesList: () => Promise<ProxyRecord[]>
  proxiesCreate: (input: {
    label: string
    type: ProxyRecord['type']
    host: string
    port: number
    username?: string | null
    password?: string | null
  }) => Promise<ProxyRecord>
  proxiesDelete: (input: { id: string }) => Promise<void>
  proxiesCheck: (input: { id: string }) => Promise<ProxyRecord>
}

declare global {
  interface Window {
    api: IpcApi
  }
}
