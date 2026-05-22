import { getToken, clearToken } from './auth'

const BASE_URL = '/api'

interface ApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  body?: unknown
  query?: Record<string, string | number | undefined>
  authenticated?: boolean
}

export async function apiClient<T>(endpoint: string, options: ApiOptions = {}): Promise<T> {
  const { method = 'GET', body, query, authenticated = true } = options

  let url = `${BASE_URL}${endpoint}`
  if (query) {
    const params = new URLSearchParams()
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined) params.set(k, String(v))
    }
    const qs = params.toString()
    if (qs) url += `?${qs}`
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (authenticated) {
    const token = getToken()
    if (token) headers['Authorization'] = `Bearer ${token}`
  }

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })

  const json = await res.json()

  if (!res.ok) {
    const err = json.error || { code: 'UNKNOWN', message: `HTTP ${res.status}` }

    if (err.code === 'INVALID_TOKEN') {
      clearToken()
      window.location.href = '/login'
    }

    throw err
  }

  return json.data as T
}

export const api = {
  get: <T>(endpoint: string, query?: Record<string, string | number | undefined>) =>
    apiClient<T>(endpoint, { query }),
  post: <T>(endpoint: string, body?: unknown) =>
    apiClient<T>(endpoint, { method: 'POST', body }),
  put: <T>(endpoint: string, body?: unknown) =>
    apiClient<T>(endpoint, { method: 'PUT', body }),
  delete: <T>(endpoint: string) =>
    apiClient<T>(endpoint, { method: 'DELETE' }),
}
