import type { HeatmapDay } from '../types/models'

interface HeatmapProps {
  data: HeatmapDay[]
  days?: number
}

function getColor(count: number): string {
  if (count === 0) return 'bg-gray-100'
  if (count <= 20) return 'bg-green-200'
  if (count <= 50) return 'bg-green-400'
  return 'bg-green-600'
}

const legendColors = ['bg-gray-100', 'bg-green-200', 'bg-green-400', 'bg-green-600']

export default function Heatmap({ data, days = 365 }: HeatmapProps) {
  const sorted = [...data]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-days)

  return (
    <div>
      <div className="grid grid-cols-7 gap-1">
        {sorted.map((day) => (
          <div
            key={day.date}
            className={`w-3 h-3 rounded-sm ${getColor(day.count)} transition-colors`}
            title={`${day.date}: ${day.count} 词`}
          />
        ))}
      </div>
      <div className="flex items-center gap-1.5 mt-2 text-xs text-gray-400">
        <span>少</span>
        {legendColors.map((c) => (
          <div key={c} className={`w-3 h-3 rounded-sm ${c}`} />
        ))}
        <span>多</span>
      </div>
    </div>
  )
}
