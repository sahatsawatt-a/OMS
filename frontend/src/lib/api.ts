const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api'

// The staff key is typed in once on a staff device and kept there; it is never built into the app
const STAFF_KEY_STORAGE = 'oms-staff-key'

export class ApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

export function getStaffKey(): string {
  try {
    return localStorage.getItem(STAFF_KEY_STORAGE) ?? ''
  } catch {
    return ''
  }
}

const keyListeners = new Set<() => void>()

export function setStaffKey(key: string) {
  try {
    if (key) localStorage.setItem(STAFF_KEY_STORAGE, key)
    else localStorage.removeItem(STAFF_KEY_STORAGE)
  } catch {
    // Storage blocked: the key works until the page is reloaded
  }
  memoryKey = key
  keyListeners.forEach((l) => l())
}

let memoryKey = getStaffKey()

export function currentStaffKey() {
  return memoryKey
}

export function onStaffKeyChange(listener: () => void) {
  keyListeners.add(listener)
  return () => keyListeners.delete(listener)
}

export async function api<T>(path: string, init?: RequestInit & { staff?: boolean; json?: unknown }): Promise<T> {
  const { staff, json, ...rest } = init ?? {}
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (staff) headers['X-Staff-Key'] = memoryKey
  const res = await fetch(`${BASE_URL}${path}`, {
    ...rest,
    headers: { ...headers, ...(rest.headers as Record<string, string>) },
    body: json === undefined ? rest.body : JSON.stringify(json),
  })
  if (!res.ok) {
    // FastAPI puts a readable message in `detail` when it can
    const body = await res.json().catch(() => null)
    const detail =
      typeof body?.detail === 'string'
        ? body.detail
        : Array.isArray(body?.detail)
          ? 'Some details were not accepted. Please check and try again.'
          : `${res.status} ${res.statusText}`
    // A wrong or changed staff key: forget it so the sign-in shows again
    if (staff && res.status === 401) setStaffKey('')
    throw new ApiError(detail, res.status)
  }
  return res.json() as Promise<T>
}
