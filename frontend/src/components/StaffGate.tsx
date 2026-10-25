import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { api, ApiError, currentStaffKey, onStaffKeyChange, setStaffKey } from '../lib/api'
import { RESTAURANT_NAME } from '../demo/mockData'
import { useActionError, useHasStaffKey, useStaffError, useStaffState } from '../demo/store'
import { Icon } from './Icon'
import { DemoBanner } from './shared'

/**
 * Staff and admin screens: ask for the staff key once on this device, then wait for the
 * restaurant's live state before showing the screen.
 */
export function StaffGate({ title, admin = false, children }: { title: string; admin?: boolean; children: ReactNode }) {
  const hasKey = useHasStaffKey()
  const access = useAdminAccess(admin && hasKey)
  if (!hasKey || access === 'denied') return <StaffSignIn title={title} admin={admin} />
  if (access === 'checking') {
    return (
      <div className="gate">
        <p className="muted">Checking…</p>
      </div>
    )
  }
  return <Loaded>{children}</Loaded>
}

/** Admin screens: does this device's key open them? A staff key doesn't once ADMIN_API_KEY is set */
function useAdminAccess(needed: boolean): 'checking' | 'ok' | 'denied' {
  // The key itself, not just whether there is one: signing in with the admin key on a device
  // that has the staff key must check again
  const key = useSyncExternalStore((l) => {
    const off = onStaffKeyChange(l)
    return () => {
      off()
    }
  }, currentStaffKey)
  const [result, setResult] = useState<{ key: string; ok: boolean } | null>(null)
  useEffect(() => {
    if (!needed) return
    let alive = true
    api('/admin/check', { staff: true })
      .then(() => alive && setResult({ key, ok: true }))
      .catch((e: unknown) => alive && setResult({ key, ok: !(e instanceof ApiError && (e.status === 403 || e.status === 401)) }))
    return () => {
      alive = false
    }
  }, [needed, key])
  if (!needed) return 'ok'
  if (!result || result.key !== key) return 'checking'
  return result.ok ? 'ok' : 'denied'
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

function StaffSignIn({ title, admin }: { title: string; admin: boolean }) {
  const [key, setKey] = useState('')
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setChecking(true)
    setError(null)
    // Try the key before keeping it; keeping it swaps this form for the screen
    try {
      await api(admin ? '/admin/check' : '/staff/check', { headers: { 'X-Staff-Key': key.trim() } })
      setStaffKey(key.trim())
    } catch (err) {
      const status = err instanceof ApiError ? err.status : 0
      setError(
        status === 403
          ? 'That is a staff key. Admin needs the admin key.'
          : status === 401
            ? 'That key is not right.'
            : 'The server is not reachable.',
      )
      setChecking(false)
    }
  }

  return (
    <div className="gate">
      <form className="gate-card card" onSubmit={submit}>
        <div className="gate-brand">{RESTAURANT_NAME}</div>
        <h1>{title}</h1>
        <p className="muted small">
          {admin ? 'Admins only. Enter the admin key once; this device remembers it.' : 'Staff only. Enter the staff key once; this device remembers it.'}
        </p>
        <label className="field">
          <span>{admin ? 'Admin key' : 'Staff key'}</span>
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
