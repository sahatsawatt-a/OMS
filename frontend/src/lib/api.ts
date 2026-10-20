const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api'

/** Error from the API, with the HTTP status so callers can react to e.g. 401 */
export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    // Spread init first so passing extra headers doesn't drop Content-Type
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  })
  if (!res.ok) {
    // FastAPI puts a readable message in `detail` when it can
    const body = await res.json().catch(() => null)
    const detail = typeof body?.detail === 'string' ? body.detail : `${res.status} ${res.statusText}`
    throw new ApiError(detail, res.status)
  }
  // 204 No Content (e.g. after a delete) has no body to parse
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}
