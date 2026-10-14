const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api'

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    ...init,
  })
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText}`)
  }
  return res.json() as Promise<T>
}
