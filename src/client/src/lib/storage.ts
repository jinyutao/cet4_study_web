const PREFIX = 'cet4_'

export function getItem<T = string>(key: string): T | null {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    if (raw === null) return null
    return JSON.parse(raw) as T
  } catch {
    return localStorage.getItem(PREFIX + key) as T | null
  }
}

export function setItem(key: string, value: unknown): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value))
  } catch {
    localStorage.setItem(PREFIX + key, String(value))
  }
}

export function removeItem(key: string): void {
  localStorage.removeItem(PREFIX + key)
}
