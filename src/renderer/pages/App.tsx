import React, { useEffect, useMemo, useState } from 'react'
import type { ProfileRecord, ProxyRecord, Settings } from '../../shared/types'
import TotpModal from '../components/TotpModal'
import TotpCodeModal from '../components/TotpCodeModal'
import ExportModal from '../components/ExportModal'
import ImportModal from '../components/ImportModal'
import logo from '../../../assets/icon.png'

type Tab = 'profiles' | 'proxies' | 'settings'

const inputClass =
  'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200'

const buttonBase = 'rounded-lg px-3 py-2 text-sm font-medium transition'
const buttonPrimary = `${buttonBase} bg-indigo-600 text-white hover:bg-indigo-700`
const buttonOutline = `${buttonBase} border border-slate-200 text-slate-700 hover:border-indigo-200 hover:text-indigo-600`
const buttonGhost = `${buttonBase} text-slate-600 hover:bg-slate-100 hover:text-slate-900`
const buttonDanger = `${buttonBase} border border-rose-200 text-rose-600 hover:bg-rose-50`

const cardClass = 'rounded-2xl border border-slate-100 bg-white p-6 shadow-panel'

function fmtDate(s?: string | null) {
  if (!s) return ''
  try {
    return new Date(s).toLocaleString()
  } catch {
    return s
  }
}

export default function App() {
  const [tab, setTab] = useState<Tab>('profiles')
  const [profiles, setProfiles] = useState<ProfileRecord[]>([])
  const [proxies, setProxies] = useState<ProxyRecord[]>([])
  const [settings, setSettings] = useState<Settings>({})
  const [exportOpen, setExportOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)

  const proxyById = useMemo(() => {
    const m = new Map<string, ProxyRecord>()
    for (const p of proxies) m.set(p.id, p)
    return m
  }, [proxies])

  async function refreshAll() {
    const [pfs, pxs, st] = await Promise.all([
      window.api.profilesList(),
      window.api.proxiesList(),
      window.api.settingsGet()
    ])
    setProfiles(pfs)
    setProxies(pxs)
    setSettings(st)
  }

  useEffect(() => {
    if (!window.api) {
      alert('Preload API not available (window.api is undefined). Check preload path/build.')
      return
    }
    refreshAll().catch((e) => alert(String(e?.message ?? e)))
  }, [])

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="flex min-h-screen">
        <aside className="w-64 border-r border-slate-200 bg-white px-6 py-8">
          <div className="flex items-center gap-3">
            <img
              src={logo}
              alt="Chrome Profile Tool"
              className="h-10 w-10 rounded-xl border border-slate-200 bg-white object-contain"
            />
            <div>
              <div className="text-sm font-semibold text-slate-900">Chrome Profile Tool</div>
              <div className="text-xs text-slate-500">Dashboard</div>
            </div>
          </div>

          <nav className="mt-10 space-y-2">
            <button
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-medium ${
                tab === 'profiles' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'
              }`}
              onClick={() => setTab('profiles')}
            >
              <span>Profiles</span>
            </button>
            <button
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-medium ${
                tab === 'proxies' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'
              }`}
              onClick={() => setTab('proxies')}
            >
              <span>Proxies</span>
            </button>
            <button
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-medium ${
                tab === 'settings' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'
              }`}
              onClick={() => setTab('settings')}
            >
              <span>Settings</span>
            </button>
          </nav>
        </aside>

        <main className="flex-1 px-8 py-10">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Control Panel</div>
              <h1 className="text-2xl font-semibold text-slate-900">
                {tab === 'profiles' && 'Profile Management'}
                {tab === 'proxies' && 'Proxy Manager'}
                {tab === 'settings' && 'Settings'}
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                {tab === 'profiles' && 'Create isolated profiles and manage launch settings.'}
                {tab === 'proxies' && 'Add and verify proxy endpoints used by profiles.'}
                {tab === 'settings' && 'Configure Chrome paths and Chromium downloads.'}
              </p>
            </div>
            <button className={buttonOutline} onClick={() => refreshAll().catch((e) => alert(String(e?.message ?? e)))}>
              Refresh
            </button>
          </div>

          <div className="mt-8 space-y-6">
            {tab === 'profiles' && (
              <ProfilesTab
                profiles={profiles}
                proxies={proxies}
                proxyById={proxyById}
                onChanged={refreshAll}
              />
            )}

            {tab === 'proxies' && <ProxiesTab proxies={proxies} onChanged={refreshAll} />}

            {tab === 'settings' && (
              <SettingsTab
                settings={settings}
                onSave={async (patch) => {
                  await window.api.settingsSet(patch)
                  await refreshAll()
                }}
                onExport={() => setExportOpen(true)}
                onImport={() => setImportOpen(true)}
              />
            )}
          </div>

          <ExportModal
            open={exportOpen}
            profiles={profiles}
            proxies={proxies}
            onClose={() => setExportOpen(false)}
            onExport={async (input) => {
              const result = await window.api.dataExport(input)
              if (!result.canceled) {
                alert(`Exported to ${result.path}`)
              }
            }}
          />

          <ImportModal
            open={importOpen}
            onClose={() => setImportOpen(false)}
            onImport={async (input) => {
              const result = await window.api.dataImport(input)
              if (!result.canceled) {
                await refreshAll()
                alert(`Imported ${result.profiles} profiles and ${result.proxies} proxies`)
              }
            }}
          />

          <div className="mt-10 text-xs text-slate-500">
            Note: Chrome proxy auth (username/password) via CLI is limited. Proxy auth is supported for “Check proxy”.
          </div>
        </main>
      </div>
    </div>
  )
}

function ProfilesTab(props: {
  profiles: ProfileRecord[]
  proxies: ProxyRecord[]
  proxyById: Map<string, ProxyRecord>
  onChanged: () => Promise<void>
}) {
  const [name, setName] = useState('')
  const [totpOpen, setTotpOpen] = useState(false)
  const [totpProfileId, setTotpProfileId] = useState<string | null>(null)
  const [totpProfileName, setTotpProfileName] = useState<string | undefined>(undefined)
  const [totpCodeOpen, setTotpCodeOpen] = useState(false)
  const [totpCodeProfileId, setTotpCodeProfileId] = useState<string | null>(null)
  const [totpCodeProfileName, setTotpCodeProfileName] = useState<string | undefined>(undefined)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const pageSize = 20
  const normalizedQuery = search.trim().toLowerCase()
  const filteredProfiles = useMemo(() => {
    if (!normalizedQuery) return props.profiles
    return props.profiles.filter((profile) => profile.name.toLowerCase().includes(normalizedQuery))
  }, [normalizedQuery, props.profiles])

  const totalPages = Math.max(1, Math.ceil(filteredProfiles.length / pageSize))
  const pageStart = (page - 1) * pageSize
  const pagedProfiles = filteredProfiles.slice(pageStart, pageStart + pageSize)

  useEffect(() => {
    setPage(1)
  }, [search, props.profiles.length])

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  return (
    <div className="space-y-6">
      <section className={cardClass}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Create new profile</h2>
            <p className="mt-1 text-sm text-slate-500">Each profile has its own isolated user-data directory.</p>
          </div>
          <div className="flex flex-1 flex-wrap items-center gap-3 md:justify-end">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="New profile name"
              className={`${inputClass} max-w-md`}
            />
            <button
              className={buttonPrimary}
              onClick={async () => {
                await window.api.profilesCreate({ name: name.trim() })
                setName('')
                await props.onChanged()
              }}
              disabled={!name.trim()}
            >
              Create profile
            </button>
          </div>
        </div>
      </section>

      <section className={cardClass}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Profiles</h2>
            <p className="mt-1 text-sm text-slate-500">Launch, close, and manage assigned proxies and 2FA.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="text-sm text-slate-500">
              Showing {pagedProfiles.length} of {filteredProfiles.length}
            </div>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name"
              className="w-60 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            />
          </div>
        </div>

        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wider text-slate-400">
              <tr className="border-b border-slate-200">
                <th className="pb-3 font-semibold">Profile</th>
                <th className="pb-3 font-semibold">Proxy</th>
                <th className="pb-3 font-semibold">Created</th>
                <th className="pb-3 font-semibold">Last launch</th>
                <th className="pb-3 font-semibold">PID</th>
                <th className="pb-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pagedProfiles.map((p) => (
                <tr key={p.id} className="align-top">
                  <td className="py-4 pr-4">
                    <div className="font-semibold text-slate-900">{p.name}</div>
                    <div className="mt-1 text-xs text-slate-400">{p.id}</div>
                  </td>
                  <td className="py-4 pr-4">
                    <select
                      value={p.proxyId ?? ''}
                      onChange={async (e) => {
                        const v = e.target.value
                        await window.api.profilesSetProxy({ profileId: p.id, proxyId: v ? v : null })
                        await props.onChanged()
                      }}
                      className="w-full min-w-[160px] rounded-lg border border-slate-200 px-2 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                    >
                      <option value="">(none)</option>
                      {props.proxies.map((px) => (
                        <option key={px.id} value={px.id}>
                          {px.label}
                        </option>
                      ))}
                    </select>
                    {p.proxyId && props.proxyById.get(p.proxyId)?.lastCheckOk === 0 && (
                      <div className="mt-1 text-xs text-rose-600">proxy last check failed</div>
                    )}
                  </td>
                  <td className="py-4 pr-4 text-slate-600">{fmtDate(p.createdAt)}</td>
                  <td className="py-4 pr-4 text-slate-600">{fmtDate(p.lastLaunchedAt)}</td>
                  <td className="py-4 pr-4 text-slate-600">{p.lastPid ?? ''}</td>
                  <td className="py-4">
                    <div className="flex flex-wrap gap-2">
                      <button
                        className={buttonPrimary}
                        onClick={async () => {
                          const r = await window.api.profilesLaunch({ id: p.id })
                          alert(`Started Chrome PID ${r.pid}`)
                          await props.onChanged()
                        }}
                      >
                        Launch
                      </button>
                      <button
                        className={buttonOutline}
                        onClick={async () => {
                          await window.api.profilesClose({ id: p.id })
                          await props.onChanged()
                        }}
                      >
                        Close
                      </button>

                      <button
                        className={buttonGhost}
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          setTotpProfileId(p.id)
                          setTotpProfileName(p.name)
                          setTotpOpen(true)
                        }}
                      >
                        Set 2FA
                      </button>

                      <button
                        className={buttonOutline}
                        onClick={() => {
                          setTotpCodeProfileId(p.id)
                          setTotpCodeProfileName(p.name)
                          setTotpCodeOpen(true)
                        }}
                      >
                        Get 2FA
                      </button>

                      <button
                        className={buttonDanger}
                        onClick={async () => {
                          if (!confirm('Delete profile and its folder?')) return
                          await window.api.profilesDelete({ id: p.id })
                          await props.onChanged()
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredProfiles.length === 0 && (
            <div className="mt-6 text-sm text-slate-500">
              {props.profiles.length === 0 ? 'No profiles yet.' : 'No profiles match the search.'}
            </div>
          )}

          {filteredProfiles.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500">
              <div>
                Page {page} of {totalPages}
              </div>
              <div className="flex gap-2">
                <button
                  className={buttonOutline}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                >
                  Previous
                </button>
                <button
                  className={buttonOutline}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>

        <TotpModal
          open={totpOpen}
          profileName={totpProfileName}
          onClose={() => {
            setTotpOpen(false)
            setTotpProfileId(null)
            setTotpProfileName(undefined)
          }}
          onSave={async ({ secret, issuer, accountName }) => {
            if (!totpProfileId) throw new Error('No profile selected')
            try {
              await window.api.totpSetSecret({ profileId: totpProfileId, secret, issuer, accountName })
              alert('TOTP secret saved')
            } catch (e: any) {
              alert(String(e?.message ?? e))
              throw e
            }
          }}
        />

        <TotpCodeModal
          open={totpCodeOpen}
          profileId={totpCodeProfileId}
          profileName={totpCodeProfileName}
          onClose={() => {
            setTotpCodeOpen(false)
            setTotpCodeProfileId(null)
            setTotpCodeProfileName(undefined)
          }}
        />
      </section>
    </div>
  )
}

function ProxiesTab(props: { proxies: ProxyRecord[]; onChanged: () => Promise<void> }) {
  const [label, setLabel] = useState('')
  const [type, setType] = useState<ProxyRecord['type']>('http')
  const [host, setHost] = useState('')
  const [port, setPort] = useState(8000)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  return (
    <div className="space-y-6">
      <section className={cardClass}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Add proxy</h2>
            <p className="mt-1 text-sm text-slate-500">Configure proxy endpoints used by profiles.</p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-[160px_1fr]">
          <label className="text-sm font-medium text-slate-600">Label</label>
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="My proxy" className={inputClass} />

          <label className="text-sm font-medium text-slate-600">Type</label>
          <select value={type} onChange={(e) => setType(e.target.value as any)} className={inputClass}>
            <option value="http">http</option>
            <option value="https">https</option>
            <option value="socks5">socks5</option>
          </select>

          <label className="text-sm font-medium text-slate-600">Host</label>
          <input value={host} onChange={(e) => setHost(e.target.value)} placeholder="1.2.3.4" className={inputClass} />

          <label className="text-sm font-medium text-slate-600">Port</label>
          <input
            type="number"
            value={port}
            onChange={(e) => setPort(Number(e.target.value))}
            min={1}
            max={65535}
            className={inputClass}
          />

          <label className="text-sm font-medium text-slate-600">Username (optional)</label>
          <input value={username} onChange={(e) => setUsername(e.target.value)} className={inputClass} />

          <label className="text-sm font-medium text-slate-600">Password (optional)</label>
          <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" className={inputClass} />

          <div />
          <button
            className={buttonPrimary}
            onClick={async () => {
              await window.api.proxiesCreate({
                label: label.trim(),
                type,
                host: host.trim(),
                port,
                username: username.trim() || null,
                password: password || null
              })
              setLabel('')
              setHost('')
              setPort(8000)
              setUsername('')
              setPassword('')
              await props.onChanged()
            }}
            disabled={!label.trim() || !host.trim() || !port}
          >
            Add proxy
          </button>
        </div>
      </section>

      <section className={cardClass}>
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Proxy list</h2>
          <p className="mt-1 text-sm text-slate-500">Test connectivity and inspect latency.</p>
        </div>

        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wider text-slate-400">
              <tr className="border-b border-slate-200">
                <th className="pb-3 font-semibold">Label</th>
                <th className="pb-3 font-semibold">Proxy</th>
                <th className="pb-3 font-semibold">Last check</th>
                <th className="pb-3 font-semibold">Latency</th>
                <th className="pb-3 font-semibold">IP</th>
                <th className="pb-3 font-semibold">Error</th>
                <th className="pb-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {props.proxies.map((px) => (
                <tr key={px.id} className="align-top">
                  <td className="py-4 pr-4">
                    <div className="font-semibold text-slate-900">{px.label}</div>
                    <div className="mt-1 text-xs text-slate-400">{px.id}</div>
                  </td>
                  <td className="py-4 pr-4 text-slate-600">
                    {px.type}://{px.host}:{px.port}
                  </td>
                  <td className="py-4 pr-4 text-slate-600">{fmtDate(px.lastCheckAt)}</td>
                  <td className="py-4 pr-4 text-slate-600">{px.lastCheckLatencyMs ?? ''}</td>
                  <td className="py-4 pr-4 text-slate-600">{px.lastCheckIp ?? ''}</td>
                  <td className={`py-4 pr-4 ${px.lastCheckOk === 0 ? 'text-rose-600' : 'text-slate-500'}`}>
                    {px.lastCheckError ?? ''}
                  </td>
                  <td className="py-4">
                    <div className="flex flex-wrap gap-2">
                      <button
                        className={buttonOutline}
                        onClick={async () => {
                          await window.api.proxiesCheck({ id: px.id })
                          await props.onChanged()
                        }}
                      >
                        Check
                      </button>
                      <button
                        className={buttonDanger}
                        onClick={async () => {
                          if (!confirm('Delete proxy?')) return
                          await window.api.proxiesDelete({ id: px.id })
                          await props.onChanged()
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {props.proxies.length === 0 && <div className="mt-6 text-sm text-slate-500">No proxies yet.</div>}
        </div>
      </section>
    </div>
  )
}

function SettingsTab(props: {
  settings: Settings
  onSave: (patch: Partial<Settings>) => Promise<void>
  onExport: () => void
  onImport: () => void
}) {
  const [chromePath, setChromePath] = useState(props.settings.chromePath ?? '')
  const [ipCheckUrl, setIpCheckUrl] = useState(props.settings.ipCheckUrl ?? '')
  const [installingChromium, setInstallingChromium] = useState(false)
  const [chromiumInfo, setChromiumInfo] = useState<string>('')

  useEffect(() => {
    setChromePath(props.settings.chromePath ?? '')
    setIpCheckUrl(props.settings.ipCheckUrl ?? '')
  }, [props.settings.chromePath, props.settings.ipCheckUrl])

  return (
    <div className="space-y-6">
      <section className={cardClass}>
        <div>
          <h2 className="text-lg font-semibold text-slate-900">App settings</h2>
          <p className="mt-1 text-sm text-slate-500">Point to Chrome and configure proxy check URLs.</p>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-[160px_1fr]">
          <label className="text-sm font-medium text-slate-600">Chrome path</label>
          <input
            value={chromePath}
            onChange={(e) => setChromePath(e.target.value)}
            placeholder="Leave empty to auto-detect"
            className={inputClass}
          />

          <label className="text-sm font-medium text-slate-600">IP check URL</label>
          <input value={ipCheckUrl} onChange={(e) => setIpCheckUrl(e.target.value)} className={inputClass} />

          <div />
          <button
            className={buttonPrimary}
            onClick={async () => {
              await props.onSave({
                chromePath: chromePath.trim() ? chromePath.trim() : null,
                ipCheckUrl: ipCheckUrl.trim() ? ipCheckUrl.trim() : null
              })
              alert('Saved')
            }}
          >
            Save settings
          </button>
        </div>
      </section>

      <section className={cardClass}>
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Install open-source Chromium</h2>
          <p className="mt-1 text-sm text-slate-500">
            This downloads Chromium to the app cache folder and sets it as Chrome path.
          </p>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            className={buttonPrimary}
            onClick={async () => {
              setInstallingChromium(true)
              setChromiumInfo('Downloading...')
              try {
                const r = await window.api.chromiumInstall()
                setChromePath(r.executablePath)
                setChromiumInfo(`Installed chromium@${r.buildId}`)
                await props.onSave({ chromePath: r.executablePath })
              } catch (e: any) {
                setChromiumInfo(String(e?.message ?? e))
                alert(String(e?.message ?? e))
              } finally {
                setInstallingChromium(false)
              }
            }}
            disabled={installingChromium}
          >
            {installingChromium ? 'Installing...' : 'Download & Install Chromium'}
          </button>
          {chromiumInfo && <span className="text-sm text-slate-500">{chromiumInfo}</span>}
        </div>
      </section>

      <section className={cardClass}>
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Export / Import</h2>
          <p className="mt-1 text-sm text-slate-500">
            Move profiles and proxies between machines. Exports are password-protected and portable across OS.
          </p>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button className={buttonPrimary} onClick={props.onExport}>
            Export data
          </button>
          <button className={buttonOutline} onClick={props.onImport}>
            Import data
          </button>
        </div>
      </section>

      <section className={cardClass}>
        <details>
          <summary className="cursor-pointer text-sm font-medium text-slate-700">How to find Chrome path</summary>
          <pre className="mt-3 whitespace-pre-wrap rounded-lg bg-slate-50 p-4 text-xs text-slate-500">
macOS: /Applications/Google Chrome.app/Contents/MacOS/Google Chrome
Windows: C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe
Linux: /usr/bin/google-chrome
          </pre>
        </details>
      </section>
    </div>
  )
}
