import React, { useEffect, useState } from 'react'

export default function ImportModal(props: {
  open: boolean
  onClose: () => void
  onImport: (input: { password: string }) => Promise<void>
}) {
  const [password, setPassword] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!props.open) return
    setPassword('')
    setSaving(false)
  }, [props.open])

  if (!props.open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-panel">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Import data</h3>
            <p className="mt-1 text-sm text-slate-500">Choose an export file and enter its password.</p>
          </div>
          <button
            className="rounded-lg border border-slate-200 px-2 py-1 text-sm text-slate-500 hover:text-slate-700"
            onClick={props.onClose}
          >
            Close
          </button>
        </div>

        <div className="mt-5">
          <label className="text-sm font-medium text-slate-600">Export password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Required"
            className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200"
          />
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800"
            onClick={props.onClose}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
            disabled={!password.trim() || saving}
            onClick={async () => {
              setSaving(true)
              try {
                await props.onImport({ password: password.trim() })
                props.onClose()
              } finally {
                setSaving(false)
              }
            }}
          >
            {saving ? 'Importing...' : 'Import'}
          </button>
        </div>
      </div>
    </div>
  )
}
