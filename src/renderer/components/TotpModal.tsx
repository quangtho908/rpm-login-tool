import React, { useEffect, useState } from 'react'

async function generateSecretInUi(): Promise<string> {
  const r = await window.api.totpGenerateSecret()
  return r.secret
}

export default function TotpModal(props: {
  open: boolean
  profileName?: string
  onClose: () => void
  onSave: (input: { secret: string; issuer?: string | null; accountName?: string | null }) => Promise<void>
}) {
  const [secret, setSecret] = useState('')
  const [issuer, setIssuer] = useState('')
  const [accountName, setAccountName] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!props.open) return

    setIssuer('')
    setAccountName('')
    setSaving(false)

    // Auto-generate a Base32 secret when dialog opens.
    // Note: This is useful for systems you control. For 3rd-party services,
    // you must use the secret provided by that service.
    ;(async () => {
      try {
        const s = await generateSecretInUi()
        setSecret(s)
      } catch {
        setSecret('')
      }
    })()
  }, [props.open])

  if (!props.open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) props.onClose()
      }}
    >
      <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-panel">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Set 2FA (TOTP)</h3>
            {props.profileName && <div className="mt-1 text-sm text-slate-500">Profile: {props.profileName}</div>}
          </div>
          <button
            className="rounded-lg border border-slate-200 px-2 py-1 text-sm text-slate-500 hover:text-slate-700"
            onClick={props.onClose}
          >
            Close
          </button>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-[160px_1fr]">
          <label className="text-sm font-medium text-slate-600">Secret (base32)</label>
          <div className="flex flex-wrap gap-2">
            <input
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              placeholder="JBSWY3DPEHPK3PXP..."
              className="w-full flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              autoFocus
            />
            <button
              type="button"
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:border-indigo-200 hover:text-indigo-600"
              onClick={async () => {
                try {
                  const s = await generateSecretInUi()
                  setSecret(s)
                } catch (e: any) {
                  alert(String(e?.message ?? e))
                }
              }}
            >
              Generate
            </button>
          </div>

          <label className="text-sm font-medium text-slate-600">Issuer (optional)</label>
          <input
            value={issuer}
            onChange={(e) => setIssuer(e.target.value)}
            placeholder="Google / GitHub / ..."
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200"
          />

          <label className="text-sm font-medium text-slate-600">Account (optional)</label>
          <input
            value={accountName}
            onChange={(e) => setAccountName(e.target.value)}
            placeholder="email@domain.com"
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200"
          />
        </div>

        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button
            onClick={props.onClose}
            disabled={saving}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={async () => {
              const s = secret.trim()
              if (!s) return

              setSaving(true)
              try {
                await props.onSave({
                  secret: s,
                  issuer: issuer.trim() ? issuer.trim() : null,
                  accountName: accountName.trim() ? accountName.trim() : null
                })
                props.onClose()
              } finally {
                setSaving(false)
              }
            }}
            disabled={saving || !secret.trim()}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>

        <div className="mt-4 text-xs text-slate-500">
          Tip: Auto-generated secrets are for systems you control. For most services (Google/GitHub/...), you must paste the secret they provide.
        </div>
      </div>
    </div>
  )
}
