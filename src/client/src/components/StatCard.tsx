interface StatCardProps {
  label: string
  value: string | number
  icon?: string
  color?: string
  compact?: boolean
}

export default function StatCard({
  label,
  value,
  icon,
  color = 'text-gray-800',
  compact,
}: StatCardProps) {
  if (compact) {
    return (
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
        <div className="flex items-center gap-3">
          {icon && <span className="text-lg">{icon}</span>}
          <span className="text-xs text-gray-500">{label}</span>
          <span className={`text-sm font-bold ${color} ml-auto`}>{value}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 text-center">
      {icon && <div className="text-2xl mb-1">{icon}</div>}
      <p className={`text-xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
    </div>
  )
}
