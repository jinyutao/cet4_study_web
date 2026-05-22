import { useState } from 'react'

interface RoundData {
  name: string
  rate: number
  count: number
  total: number
  color: string
}

const rounds: RoundData[] = [
  { name: '第一轮', rate: 85, count: 1870, total: 2200, color: 'text-blue-600' },
  { name: '第二轮', rate: 62, count: 720, total: 1160, color: 'text-emerald-600' },
]

const dailyData = [
  { day: '周一', count: 45 },
  { day: '周二', count: 52 },
  { day: '周三', count: 38 },
  { day: '周四', count: 61 },
  { day: '周五', count: 47 },
]

const DISTRIBUTION_COLORS: Record<string, string> = {
  Lv5: 'bg-emerald-500',
  Lv4: 'bg-blue-500',
  Lv3: 'bg-amber-400',
  Lv2: 'bg-orange-400',
  Lv1: 'bg-red-400',
}

export default function ProgressPage() {
  const [activeRound, setActiveRound] = useState(0)
  const maxDaily = Math.max(...dailyData.map((d) => d.count))

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-xl font-bold text-gray-800">学习进度</h2>
        <p className="text-sm text-gray-500 mt-0.5">你的坚持，终有回报</p>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {rounds.map((round, idx) => (
          <button
            key={round.name}
            onClick={() => setActiveRound(idx)}
            className={`bg-white rounded-2xl p-5 shadow-sm border text-left transition-all ${
              activeRound === idx
                ? 'border-blue-200 ring-2 ring-blue-100'
                : 'border-gray-100 hover:border-gray-200'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="font-semibold text-gray-800">{round.name}</span>
              <span className={`text-2xl font-bold ${round.color}`}>
                {round.rate}%
              </span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2.5 mb-2">
              <div
                className={`h-2.5 rounded-full bg-gradient-to-r ${
                  idx === 0
                    ? 'from-blue-500 to-indigo-500'
                    : 'from-emerald-500 to-teal-500'
                } transition-all`}
                style={{ width: `${round.rate}%` }}
              />
            </div>
            <p className="text-xs text-gray-400">
              {round.count} / {round.total} 词
            </p>
          </button>
        ))}
      </section>

      <section className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <h3 className="font-semibold text-gray-800 mb-4">本周学习</h3>
        <div className="flex items-end justify-between gap-2 sm:gap-4">
          {dailyData.map((d) => (
            <div key={d.day} className="flex-1 flex flex-col items-center gap-1.5">
              <span className="text-xs font-medium text-gray-500">{d.count}</span>
              <div
                className="w-full bg-blue-500 rounded-md transition-all hover:bg-blue-600"
                style={{
                  height: `${Math.max((d.count / maxDaily) * 120, 16)}px`,
                }}
              />
              <span className="text-xs text-gray-400">{d.day}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <h3 className="font-semibold text-gray-800 mb-4">熟练度分布</h3>
        <div className="space-y-3">
          {Object.entries(DISTRIBUTION_COLORS).map(([level, color]) => {
            const data = {
              Lv5: { label: '已掌握', count: 1840, max: 1840 },
              Lv4: { label: '较熟', count: 960, max: 1840 },
              Lv3: { label: '认识', count: 480, max: 1840 },
              Lv2: { label: '模糊', count: 180, max: 1840 },
              Lv1: { label: '生词', count: 60, max: 1840 },
            }[level]!

            const barWidth = (data.count / data.max) * 100
            return (
              <div key={level} className="flex items-center gap-3">
                <span className="w-8 text-xs font-medium text-gray-500 shrink-0">
                  {level}
                </span>
                <span className="w-8 text-xs text-gray-400 shrink-0">
                  {data.label}
                </span>
                <div className="flex-1 bg-gray-100 rounded-full h-2.5">
                  <div
                    className={`h-2.5 rounded-full ${color} transition-all`}
                    style={{ width: `${barWidth}%` }}
                  />
                </div>
                <span className="w-10 text-xs text-right text-gray-500 shrink-0">
                  {data.count}
                </span>
              </div>
            )
          })}
        </div>
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: '平均熟练度', value: '85', unit: '/100', color: 'text-blue-600' },
          { label: '平均反应', value: '3.2', unit: 's', color: 'text-emerald-600' },
          { label: '累计学习', value: '37', unit: '天', color: 'text-amber-600' },
        ].map((stat) => (
          <div
            key={stat.label}
            className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 text-center"
          >
            <p className="text-xs text-gray-400 mb-1">{stat.label}</p>
            <p className={`text-2xl font-bold ${stat.color}`}>
              {stat.value}
              <span className="text-sm font-normal text-gray-400 ml-0.5">
                {stat.unit}
              </span>
            </p>
          </div>
        ))}
      </section>
    </div>
  )
}
