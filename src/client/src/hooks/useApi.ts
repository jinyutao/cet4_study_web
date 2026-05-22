import { useState, useCallback } from 'react'

interface UseApiState<T> {
  data: T | null
  loading: boolean
  error: Error | null
}

interface UseApiReturn<T> extends UseApiState<T> {
  execute: (fetcher: () => Promise<T>) => Promise<T | null>
}

export function useApi<T>(): UseApiReturn<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const execute = useCallback(async (fetcher: () => Promise<T>): Promise<T | null> => {
    setLoading(true)
    setError(null)
    setData(null)

    try {
      const result = await fetcher()
      setData(result)
      return result
    } catch (err) {
      const normalized = err instanceof Error ? err : new Error(String(err))
      setError(normalized)
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  return { data, loading, error, execute }
}
