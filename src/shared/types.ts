export type ProxyType = 'http' | 'https' | 'socks5'

export type ProxyRecord = {
  id: string
  label: string
  type: ProxyType
  host: string
  port: number
  username?: string | null
  password?: string | null
  lastCheckAt?: string | null
  lastCheckOk?: number | null
  lastCheckLatencyMs?: number | null
  lastCheckIp?: string | null
  lastCheckError?: string | null
}

export type ProfileRecord = {
  id: string
  name: string
  tags?: string | null
  notes?: string | null
  userDataDir: string
  proxyId?: string | null
  createdAt: string
  lastLaunchedAt?: string | null
  lastPid?: number | null
}

export type Settings = {
  chromePath?: string | null
  ipCheckUrl?: string | null
}
