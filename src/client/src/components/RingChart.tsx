interface RingChartProps {
  percent: number
  size?: number
}

const RADIUS = 52
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

export default function RingChart({ percent, size = 112 }: RingChartProps) {
  const clamped = Math.min(Math.max(percent, 0), 100)
  const isComplete = clamped >= 100

  let strokeColor: string
  if (isComplete) {
    strokeColor = 'url(#goldGradient)'
  } else if (clamped >= 90) {
    strokeColor = '#10b981'
  } else if (clamped >= 70) {
    strokeColor = '#f59e0b'
  } else {
    strokeColor = '#ef4444'
  }

  return (
    <svg width={size} height={size} viewBox="0 0 120 120" className="ring-chart">
      {isComplete && (
        <defs>
          <linearGradient id="goldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fbbf24" />
            <stop offset="50%" stopColor="#facc15" />
            <stop offset="100%" stopColor="#f59e0b" />
          </linearGradient>
        </defs>
      )}
      <circle
        cx="60"
        cy="60"
        r={RADIUS}
        fill="none"
        stroke="#e5e7eb"
        strokeWidth={8}
      />
      <circle
        cx="60"
        cy="60"
        r={RADIUS}
        fill="none"
        stroke={strokeColor}
        strokeWidth={8}
        strokeDasharray={`${(clamped / 100) * CIRCUMFERENCE} ${CIRCUMFERENCE}`}
        strokeLinecap="round"
        className="transition-all duration-700"
        transform="rotate(-90 60 60)"
      />
      <text
        x="60"
        y="60"
        textAnchor="middle"
        dominantBaseline="central"
        className="text-lg font-bold"
        fill={
          isComplete
            ? '#f59e0b'
            : clamped >= 90
              ? '#10b981'
              : clamped >= 70
                ? '#f59e0b'
                : '#ef4444'
        }
      >
        {clamped}%
      </text>
    </svg>
  )
}
