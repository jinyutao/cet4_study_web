import { useMemo } from 'react'
import type { HeatmapDay } from '../types/models'

interface UseHeatmapReturn {
  weekDays: HeatmapDay[]
  colorLevel: (count: number) => string
}

export function useHeatmap(heatmap: HeatmapDay[], days: number = 7): UseHeatmapReturn {
  const weekDays = useMemo(() => {
    return heatmap.slice(-days)
  }, [heatmap, days])

  const colorLevel = (count: number): string => {
    if (count === 0) return 'bg-gray-100'
    if (count <= 20) return 'bg-green-200'
    if (count <= 50) return 'bg-green-400'
    return 'bg-green-600'
  }

  return { weekDays, colorLevel }
}
