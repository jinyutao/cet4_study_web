import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

const proficiencyLevels = [
  { level: 'Lv5', label: '已掌握', count: 1840, color: 'bg-emerald-500' },
  { level: 'Lv4', label: '较熟', count: 960, color: 'bg-blue-500' },
  { level: 'Lv3', label: '认识', count: 480, color: 'bg-amber-400' },
  { level: 'Lv2', label: '模糊', count: 180, color: 'bg-orange-400' },
  { level: 'Lv1', label: '生词', count: 60, color: 'bg-red-400' },
]

const HEATMAP_COLORS = ['bg-gray-100', 'bg-green-200', 'bg-green-300', 'bg-green-400', 'bg-green-500'] as const

export default function DashboardPage() {
  const navigate = useNavigate()
  const [heatmap] = useState(() =>
    Array.from({ length: 30 }, (_, i) => {
      if (i < 7) return 0
      return (i % 5 === 0 ? 4 : i % 3 === 0 ? 3 : i % 2 === 0 ? 2 : 1) as 0 | 1 | 2 | 3 | 4
    })
  )

  const totalWords = 4526
  const learnedWords = 3520
  const progressPct = Math.round((learnedWords / totalWords) * 100)

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-xl font-bold text-gray-800">学习概览</h2>
        <p className="text-sm text-gray-500 mt-0.5">坚持学习，每天进步</p>
      </header>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-start justify-between mb-4">
            <div>
              <span className="inline-block px-2.5 py-0.5 bg-blue-50 text-blue-700 text-xs font-medium rounded-full">
                今日任务
              </span>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-gray-800">24</p>
              <p className="text-xs text-gray-400">待复习</p>
            </div>
          </div>

          <div className="flex gap-4 mb-4">
            <div className="flex-1 bg-gray-50 rounded-xl p-3 text-center">
              <p className="text-lg font-bold text-amber-600">10</p>
              <p className="text-xs text-gray-500">新词</p>
            </div>
            <div className="flex-1 bg-gray-50 rounded-xl p-3 text-center">
              <p className="text-lg font-bold text-blue-600">15</p>
              <p className="text-xs text-gray-500">分钟</p>
            </div>
          </div>

          <button
            onClick={() => navigate('/learn')}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold rounded-xl transition-colors shadow-sm"
          >
            开始学习
          </button>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-800">总进度</h3>
            <span className="text-2xl font-bold text-blue-600">{progressPct}%</span>
          </div>

          <div className="w-full bg-gray-100 rounded-full h-3 mb-3">
            <div
              className="h-3 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all"
              style={{ width: `${progressPct}%` }}
            />
          </div>

          <p className="text-sm text-gray-500">
            已学 <span className="font-semibold text-gray-700">{learnedWords}</span> / {totalWords} 词
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            目标掌握率 <span className="text-emerald-600 font-medium">90%</span>
          </p>
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h3 className="font-semibold text-gray-800 mb-3">学习热力图</h3>
          <div className="flex flex-wrap gap-1">
            {heatmap.map((val, i) => (
              <div
                key={i}
                className={`w-3 h-3 sm:w-4 sm:h-4 rounded-sm ${HEATMAP_COLORS[val]} transition-colors`}
                title={`第 ${i + 1} 天`}
              />
            ))}
          </div>
          <div className="flex items-center gap-2 mt-3 text-xs text-gray-400">
            <span>少</span>
            {HEATMAP_COLORS.map((c) => (
              <div key={c} className={`w-3 h-3 rounded-sm ${c}`} />
            ))}
            <span>多</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h3 className="font-semibold text-gray-800 mb-3">熟练度分布</h3>
          <div className="space-y-3">
            {proficiencyLevels.map((item) => {
              const maxCount = proficiencyLevels[0].count
              const barWidth = (item.count / maxCount) * 100
              return (
                <div key={item.level} className="flex items-center gap-3">
                  <span className="w-8 text-xs font-medium text-gray-500 shrink-0">
                    {item.level}
                  </span>
                  <span className="w-8 text-xs text-gray-400 shrink-0">
                    {item.label}
                  </span>
                  <div className="flex-1 bg-gray-100 rounded-full h-2.5">
                    <div
                      className={`h-2.5 rounded-full ${item.color} transition-all`}
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                  <span className="w-10 text-xs text-right text-gray-500 shrink-0">
                    {item.count}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </section>
    </div>
  )
}
