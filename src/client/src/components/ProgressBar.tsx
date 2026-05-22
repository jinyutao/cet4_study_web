interface ProgressBarProps {
  value: number
  max: number
  color?: string
  size?: 'sm' | 'md' | 'lg'
  animate?: boolean
}

const sizeMap = {
  sm: 'h-2',
  md: 'h-3',
  lg: 'h-4',
} as const

export default function ProgressBar({
  value,
  max,
  color = 'bg-blue-500',
  size = 'md',
  animate,
}: ProgressBarProps) {
  const pct = Math.min(Math.round((value / max) * 100), 100)
  const isComplete = pct >= 100
  const hClass = sizeMap[size]

  return (
    <div className={`w-full bg-gray-100 rounded-full ${hClass}`}>
      <div
        className={`${hClass} rounded-full transition-all duration-500 ${
          isComplete
            ? 'bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 shadow-lg shadow-amber-200'
            : color
        } ${animate && isComplete ? 'animate-pulse' : ''}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}
