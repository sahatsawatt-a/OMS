// How a guest's phone gets into its table (REQ-36, REQ-37).
// The QR code opens /order?table=N#s=QR_TOKEN. The page swaps the QR token for this phone's own
// device token once (POST /api/guest/join), keeps that in localStorage, and takes the QR token out
// of the address, so it never sits in browser history, a copied link, a server log or a Referer.
// Reloading, or coming back from a Stripe redirect, finds the device token in storage.
import { useEffect, useState } from 'react'
import { api, ApiError } from './api'

type Saved = { token: string; label: string }

export type GuestAccess =
  | { status: 'joining' }
  | { status: 'ready'; deviceToken: string; label: string }
  /** No QR token in the address and nothing saved on this phone */
  | { status: 'missing' }
  /** The join was refused (unknown QR, visit ended, phone removed) or the server was unreachable */
  | { status: 'failed'; code: number; message: string }

const storageKey = (table: string) => `oms-device:${table}`

function load(table: string): Saved | null {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey(table)) ?? 'null') as Saved | null
    return saved && typeof saved.token === 'string' ? saved : null
  } catch {
    return null
  }
}

function save(table: string, saved: Saved) {
  try {
    localStorage.setItem(storageKey(table), JSON.stringify(saved))
  } catch {
    // Storage blocked: this phone works until the page is reloaded
  }
}

/** Forget this phone's device at a table, e.g. once the server no longer knows it */
export function forgetDevice(table: string) {
  try {
    localStorage.removeItem(storageKey(table))
  } catch {
    // Nothing saved
  }
}

/** The QR token from the address (#s=..., or ?session=... from older QR codes), removed from it */
function takeQrToken(): string | null {
  const url = new URL(window.location.href)
  const hash = new URLSearchParams(url.hash.replace(/^#/, ''))
  const token = hash.get('s') ?? url.searchParams.get('session')
  if (!token) return null
  hash.delete('s')
  url.searchParams.delete('session')
  url.hash = hash.toString()
  window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`)
  return token
}

// Taken as soon as the app loads, before anything can copy the address
let pendingQr = window.location.pathname === '/order' ? takeQrToken() : null
// Kept in memory only, so "Try again" works after a failed join without the token being in the URL
const qrByTable = new Map<string, string>()
const joining = new Map<string, Promise<Saved>>()

function startJoin(table: string, qr: string): Promise<Saved> {
  const known = load(table)
  const headers: Record<string, string> = { 'X-Session-Token': qr }
  if (known) headers['X-Device-Token'] = known.token
  const join = api<{ deviceToken: string; label: string }>('/guest/join', { method: 'POST', headers })
    .then((res) => {
      const saved = { token: res.deviceToken, label: res.label }
      save(table, saved)
      qrByTable.delete(table)
      return saved
    })
    .finally(() => joining.delete(table))
  joining.set(table, join)
  return join
}

/** This phone's access to the table in the address: joins with a QR token if there is one */
export function useGuestAccess(table: string): [GuestAccess, () => void] {
  const [access, setAccess] = useState<GuestAccess>({ status: 'joining' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let alive = true
    const fresh = pendingQr ?? takeQrToken()
    pendingQr = null
    if (fresh) qrByTable.set(table, fresh)
    const qr = qrByTable.get(table)
    const join = joining.get(table) ?? (qr ? startJoin(table, qr) : null)
    if (join) {
      setAccess({ status: 'joining' })
      join
        .then((s) => alive && setAccess({ status: 'ready', deviceToken: s.token, label: s.label }))
        .catch((e: unknown) => {
          if (!alive) return
          const err = e instanceof ApiError ? e : new ApiError('The restaurant could not be reached.', 0)
          // A refused QR code can't be retried; a network problem can
          if (err.status !== 0) qrByTable.delete(table)
          setAccess({ status: 'failed', code: err.status, message: err.message })
        })
    } else {
      const saved = load(table)
      setAccess(saved ? { status: 'ready', deviceToken: saved.token, label: saved.label } : { status: 'missing' })
    }
    return () => {
      alive = false
    }
  }, [table, attempt])

  return [access, () => setAttempt((n) => n + 1)]
}
