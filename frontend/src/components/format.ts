import { useEffect, useState } from 'react'

/** Current time, refreshed every `intervalMs` so elapsed times stay live */
export function useNow(intervalMs = 15000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}

export function formatElapsed(from: number, now: number): string {
  const mins = Math.max(0, Math.floor((now - from) / 60000))
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  return `${Math.floor(mins / 60)} h ${mins % 60} min ago`
}

export function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

/** Link encoded in the table QR code: table number (for reference) + session token */
export function sessionUrl(tableNumber: number, token: string): string {
  const base = import.meta.env.VITE_PUBLIC_BASE_URL || window.location.origin
  return `${base.replace(/\/$/, '')}/order?table=${tableNumber}&session=${encodeURIComponent(token)}`
}
