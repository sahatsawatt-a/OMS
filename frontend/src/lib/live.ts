// One WebSocket per page that says "something changed" (backend/app/services/live.py).
// Screens re-run their usual GET when it does, and each time the socket (re)connects, so a phone
// that slept or lost Wi-Fi catches up. The socket carries no data and needs no key.
const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api'

const FIRST_RETRY_MS = 1000
const MAX_RETRY_MS = 30_000
// Keep the socket briefly when the last screen goes, as the next one usually takes over
// (e.g. a loading screen handing over to the menu)
const CLOSE_GRACE_MS = 2000

type Listener = () => void
const listeners = new Set<Listener>()
let socket: WebSocket | null = null
let retryMs = FIRST_RETRY_MS
let retryTimer: number | undefined
let closeTimer: number | undefined

const notify = () => listeners.forEach((l) => l())

function socketUrl(): string {
  const url = new URL(`${BASE_URL}/ws`, window.location.href)
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  return url.toString()
}

function connect() {
  if (socket || listeners.size === 0) return
  const ws = new WebSocket(socketUrl())
  socket = ws
  ws.onopen = () => {
    retryMs = FIRST_RETRY_MS
    // Anything may have changed while we were away
    notify()
  }
  ws.onmessage = (e) => {
    try {
      if (JSON.parse(e.data).type === 'changed') notify()
    } catch {
      // Not ours; ignore
    }
  }
  ws.onclose = () => {
    if (socket !== ws) return
    socket = null
    if (listeners.size > 0) {
      retryTimer = window.setTimeout(connect, retryMs)
      retryMs = Math.min(retryMs * 2, MAX_RETRY_MS)
    }
  }
}

// A phone coming back to the page may hold a dead socket: reconnect now, and catch up
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible' || listeners.size === 0) return
  if (socket?.readyState === WebSocket.OPEN) {
    notify()
  } else {
    window.clearTimeout(retryTimer)
    retryMs = FIRST_RETRY_MS
    socket?.close()
    socket = null
    connect()
  }
})

/** Call `listener` whenever the server's data may have changed; returns an unsubscribe */
export function onLiveChange(listener: Listener): () => void {
  window.clearTimeout(closeTimer)
  listeners.add(listener)
  connect()
  return () => {
    listeners.delete(listener)
    if (listeners.size > 0) return
    window.clearTimeout(closeTimer)
    closeTimer = window.setTimeout(() => {
      if (listeners.size > 0) return
      window.clearTimeout(retryTimer)
      const ws = socket
      socket = null
      ws?.close()
    }, CLOSE_GRACE_MS)
  }
}
