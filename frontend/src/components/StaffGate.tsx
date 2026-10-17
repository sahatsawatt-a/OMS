import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { api, ApiError, setStaffKey } from '../lib/api'
import { RESTAURANT_NAME } from '../demo/mockData'
import { useActionError, useHasStaffKey, useStaffError, useStaffState } from '../demo/store'
import { Icon } from './Icon'
import { DemoBanner } from './shared'

/**
 * Staff and admin screens: ask for the staff key once on this device, then wait for the
 * restaurant's live state before showing the screen.
 */
export function StaffGate({ title, children }: { title: string; children: ReactNode }) {
  const hasKey = useHasStaffKey()
  if (!hasKey) return <StaffSignIn title={title} />
  return <Loaded>{children}</Loaded>
}

function Loaded({ children }: { children: ReactNode }) {
  const state = useStaffState()
  const error = useStaffError()
  const [actionError, dismiss] = useActionError()
  if (!state) {
    return (
      <div className="gate">
        <p className="muted">{error ? error.message : 'Loading…'}</p>
      </div>
    )
  }
  return (
    <>
      <DemoBanner />
      {error && <div className="gate-banner">{error.message}</div>}
      {actionError && (
        <div className="gate-banner gate-banner-error" role="alert">
          <span className="grow">{actionError}</span>
          <button className="icon-btn" onClick={dismiss} aria-label="Dismiss">
            <Icon name="x" size={16} />
          </button>
        </div>
      )}
      {children}
    </>
  )
}

function StaffSignIn({ title }: { title: string }) {
  const [key, setKey] = useState('')
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setChecking(true)
    setError(null)
    // Try the key before keeping it; keeping it swaps this form for the screen
    try {
      await api('/staff/check', { headers: { 'X-Staff-Key': key.trim() } })
      setStaffKey(key.trim())
    } catch (err) {
      setError(err instanceof ApiError && err.status === 401 ? 'That key is not right.' : 'The server is not reachable.')
      setChecking(false)
    }
  }

  return (
    <div className="gate">
      <form className="gate-card card" onSubmit={submit}>
        <div className="gate-brand">{RESTAURANT_NAME}</div>
        <h1>{title}</h1>
        <p className="muted small">Staff only. Enter the staff key once; this device remembers it.</p>
        <label className="field">
          <span>Staff key</span>
          <input
            type="password"
            autoComplete="current-password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            autoFocus
          />
        </label>
        {error && <p className="gate-error">{error}</p>}
        <button className="btn btn-primary btn-block gate-submit" disabled={!key.trim() || checking}>
          {checking ? 'Checking…' : 'Sign in'}
        </button>
        <Link to="/" className="muted small gate-back">
          Back to home
        </Link>
      </form>
    </div>
  )
}

/** Forget the staff key on this device */
export function SignOutButton() {
  return (
    <button className="btn btn-ghost btn-sm" onClick={() => setStaffKey('')}>
      Sign out
    </button>
  )
}
