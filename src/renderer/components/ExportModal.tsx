import React, { useEffect, useMemo, useState } from 'react'
import type { ProfileRecord, ProxyRecord } from '../../shared/types'

export default function ExportModal(props: {
  open: boolean
  profiles: ProfileRecord[]
  proxies: ProxyRecord[]
  onClose: () => void
  onExport: (input: {
    profileIds: string[]
    proxyIds: string[]
    includeCache: boolean
    password: string
  }) => Promise<void>
}) {
  const [selectedProfiles, setSelectedProfiles] = useState<Set<string>>(new Set())
  const [selectedProxies, setSelectedProxies] = useState<Set<string>>(new Set())
  const [includeCache, setIncludeCache] = useState(true)
  const [password, setPassword] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!props.open) return
    setSelectedProfiles(new Set(props.profiles.map((p) => p.id)))
    setSelectedProxies(new Set(props.proxies.map((p) => p.id)))
    setIncludeCache(true)
    setPassword('')
    setSaving(false)
  }, [props.open, props.profiles, props.proxies])

  const selectedProfilesCount = selectedProfiles.size
  const selectedProxiesCount = selectedProxies.size

  const canExport = useMemo(
    () => (selectedProfilesCount > 0 || selectedProxiesCount > 0) && password.trim().length > 0,
    [selectedProfilesCount, selectedProxiesCount, password]
  )

  if (!props.open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-4xl rounded-2xl bg-white p-6 shadow-panel">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Export data</h3>
            <p className="mt-1 text-sm text-slate-500">
              Select profiles and proxies to export. Export file will be password-protected.
            </p>
          </div>
          <button
            className="rounded-lg border border-slate-200 px-2 py-1 text-sm text-slate-500 hover:text-slate-700"
            onClick={props.onClose}
          >
            Close
          </button>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-slate-100 p-4">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-slate-700">Profiles</div>
              <div className="flex gap-2 text-xs">
                <button
                  className="text-indigo-600 hover:text-indigo-700"
                  onClick={() => setSelectedProfiles(new Set(props.profiles.map((p) => p.id)))}
                >
                  Select all
                </button>
                <button
                  className="text-slate-400 hover:text-slate-600"
                  onClick={() => setSelectedProfiles(new Set())}
                >
                  Clear
                </button>
              </div>
            </div>
            <div className="mt-3 max-h-64 space-y-2 overflow-auto pr-2">
              {props.profiles.map((profile) => (
                <label key={profile.id} className="flex items-center gap-2 text-sm text-slate-600">
                  <input
                    type="checkbox"
                    checked={selectedProfiles.has(profile.id)}
                    onChange={(e) => {
                      const next = new Set(selectedProfiles)
                      if (e.target.checked) {
                        next.add(profile.id)
                      } else {
                        next.delete(profile.id)
                      }
                      setSelectedProfiles(next)
                    }}
                  />
                  <span className="font-medium text-slate-700">{profile.name}</span>
                  <span className="truncate text-xs text-slate-400">{profile.id}</span>
                </label>
              ))}
              {props.profiles.length === 0 && <div className="text-xs text-slate-400">No profiles yet.</div>}
            </div>
          </div>

          <div className="rounded-xl border border-slate-100 p-4">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-slate-700">Proxies</div>
              <div className="flex gap-2 text-xs">
                <button
                  className="text-indigo-600 hover:text-indigo-700"
                  onClick={() => setSelectedProxies(new Set(props.proxies.map((p) => p.id)))}
                >
                  Select all
                </button>
                <button
                  className="text-slate-400 hover:text-slate-600"
                  onClick={() => setSelectedProxies(new Set())}
                >
                  Clear
                </button>
              </div>
            </div>
            <div className="mt-3 max-h-64 space-y-2 overflow-auto pr-2">
              {props.proxies.map((proxy) => (
                <label key={proxy.id} className="flex items-center gap-2 text-sm text-slate-600">
                  <input
                    type="checkbox"
                    checked={selectedProxies.has(proxy.id)}
                    onChange={(e) => {
                      const next = new Set(selectedProxies)
                      if (e.target.checked) {
                        next.add(proxy.id)
                      } else {
                        next.delete(proxy.id)
                      }
                      setSelectedProxies(next)
                    }}
                  />
                  <span className="font-medium text-slate-700">{proxy.label}</span>
                  <span className="truncate text-xs text-slate-400">
                    {proxy.type}://{proxy.host}:{proxy.port}
                  </span>
                </label>
              ))}
              {props.proxies.length === 0 && <div className="text-xs text-slate-400">No proxies yet.</div>}
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-[1fr_auto]">
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={includeCache}
                onChange={(e) => setIncludeCache(e.target.checked)}
              />
              Include browser cache data (recommended)
            </label>
            <div>
              <label className="text-sm font-medium text-slate-600">Export password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Required"
                className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              />
            </div>
          </div>
          <div className="flex items-end justify-end gap-2">
            <button
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800"
              onClick={props.onClose}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
              disabled={!canExport || saving}
              onClick={async () => {
                setSaving(true)
                try {
                  await props.onExport({
                    profileIds: Array.from(selectedProfiles),
                    proxyIds: Array.from(selectedProxies),
                    includeCache,
                    password: password.trim()
                  })
                  props.onClose()
                } finally {
                  setSaving(false)
                }
              }}
            >
              {saving ? 'Exporting...' : 'Export'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
