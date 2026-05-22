import { useRef, useCallback } from 'react'

export function useTimer() {
  const startTimeRef = useRef<number>(Date.now())

  const reset = useCallback(() => {
    startTimeRef.current = Date.now()
  }, [])

  const getElapsed = useCallback((): number => {
    return Date.now() - startTimeRef.current
  }, [])

  return { reset, getElapsed }
}
