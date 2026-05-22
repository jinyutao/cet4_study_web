import type { ProficiencyLevel } from '../types/models'

interface ProficiencyBarProps {
  levels: ProficiencyLevel[]
}

const LEVEL_COLORS: Record<string, string> = {
  Lv0: 'bg-gray-300',
  Lv1: 'bg-red-400',
  Lv2: 'bg-orange-400',
  Lv3: 'bg-amber-400',
  Lv4: 'bg-blue-500',
  Lv5: 'bg-emerald-500',
}

export default function ProficiencyBar({ levels }: ProficiencyBarProps) {
  const maxCount = Math.max(...levels.map((l) => l.count), 1)

  return (
    <div className="space-y-3">
      {levels.map((level) => (
        <div key={level.level} className="flex items-center gap-3">
          <span className="w-8 text-xs font-medium text-gray-500 shrink-0">
            {level.level}
          </span>
          <span className="w-16 text-xs text-gray-400 shrink-0">
            {level.label}
          </span>
          <div className="flex-1 bg-gray-100 rounded-full h-3">
            <div
              className={`h-3 rounded-full transition-all ${
                LEVEL_COLORS[level.level] || 'bg-gray-300'
              }`}
              style={{
                width: `${(level.count / maxCount) * 100}%`,
              }}
            />
          </div>
          <span className="w-12 text-xs text-right text-gray-500 shrink-0">
            {level.count}
          </span>
        </div>
      ))}
    </div>
  )
}
