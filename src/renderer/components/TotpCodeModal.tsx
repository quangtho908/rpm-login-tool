import React, { useCallback, useEffect, useRef, useState } from 'react'

export default function TotpCodeModal(props: {
  open: boolean
  profileId: string | null
  profileName?: string
  onClose: () => void
}) {
  const [code, setCode] = useState('')
  const [secondsRemaining, setSecondsRemaining] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const refreshingRef = useRef(false)

  const loadCode = useCallback(async () => {
    if (!props.profileId) return
    setLoading(true)
    setError(null)
    try {
      const r = await window.api.totpGetCode({ profileId: props.profileId })
      setCode(r.code)
      setSecondsRemaining(Math.max(0, r.secondsRemaining))
    } catch (e: any) {
      const message = String(e?.message ?? e)
      setCode('')
      setSecondsRemaining(0)
      if (message.toLowerCase().includes('no totp secret set')) {
        setError('Bạn chưa có 2FA. Hãy Set 2FA trước.')
      } else {
        setError(message)
      }
    } finally {
      setLoading(false)
      refreshingRef.current = false
    }
  }, [props.profileId])

  useEffect(() => {
    if (!props.open) {
      setCode('')
      setSecondsRemaining(0)
      setError(null)
      setCopied(false)
      refreshingRef.current = false
      return
    }
    void loadCode()
  }, [props.open, loadCode])

  useEffect(() => {
    if (!props.open || !code || loading || error) return

    const timer = window.setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          if (!refreshingRef.current) {
            refreshingRef.current = true
            void loadCode()
          }
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => window.clearInterval(timer)
  }, [props.open, code, loading, error, loadCode])

  useEffect(() => {
    if (!copied) return
    const timer = window.setTimeout(() => setCopied(false), 1200)
    return () => window.clearTimeout(timer)
  }, [copied])

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
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-panel">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">2FA Code</h3>
            {props.profileName && <div className="mt-1 text-sm text-slate-500">Profile: {props.profileName}</div>}
          </div>
          <button
            className="rounded-lg border border-slate-200 px-2 py-1 text-sm text-slate-500 hover:text-slate-700"
            onClick={props.onClose}
          >
            Close
          </button>
        </div>

        <div className="mt-5 space-y-4">
          {loading && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              Loading code...
            </div>
          )}

          {!loading && error && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
          )}

          {!loading && !error && (
            <div className="space-y-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-center">
                <div className="font-mono text-3xl font-semibold tracking-[0.2em] text-slate-900">{code}</div>
              </div>
              <div className="text-center text-sm text-slate-500">
                Expires in <span className="font-semibold text-slate-700">{secondsRemaining}s</span>
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          {!loading && !error && (
            <button
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:border-indigo-200 hover:text-indigo-600"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(code)
                  setCopied(true)
                } catch {
                  alert('Copy failed. Please copy manually.')
                }
              }}
            >
              {copied ? 'Copied' : 'Copy code'}
            </button>
          )}
          <button
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
            onClick={() => {
              refreshingRef.current = true
              void loadCode()
            }}
            disabled={loading || !props.profileId}
          >
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
      </div>
    </div>
  )
}
