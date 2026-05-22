import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { useApi } from '../hooks/useApi'
import type { TodayTask, ProgressOverview, HeatmapResponse, ProficiencyDistribution } from '../types/api'
import type { HeatmapDay, ProficiencyLevel } from '../types/models'

interface DashboardState {
  todayTask: TodayTask
  overview: ProgressOverview
  heatmap: HeatmapResponse
  distribution: ProficiencyDistribution
}

function LoadingSkeleton({ type }: { type: 'card' | 'chart' }) {
  if (type === 'card') {
    return (
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-1/3 mb-4" />
        <div className="h-8 bg-gray-200 rounded w-1/4 mb-3" />
        <div className="h-3 bg-gray-200 rounded w-full mb-2" />
        <div className="h-3 bg-gray-200 rounded w-2/3" />
      </div>
    )
  }
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 animate-pulse">
      <div className="h-4 bg-gray-200 rounded w-1/4 mb-4" />
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-3 bg-gray-200 rounded w-full" />
        ))}
      </div>
    </div>
  )
}

function RingChart({
  percent,
  size = 72,
  strokeWidth = 6,
}: {
  percent: number
  size?: number
  strokeWidth?: number
}) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (Math.min(percent, 100) / 100) * circumference

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="#f3f4f6"
        strokeWidth={strokeWidth}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="#3b82f6"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        className="transition-all duration-700 ease-out"
      />
    </svg>
  )
}

function ProgressBar({ percent }: { percent: number }) {
  return (
    <div className="w-full bg-gray-100 rounded-full h-2.5">
      <div
        className="h-2.5 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-700 ease-out"
        style={{ width: `${Math.min(percent, 100)}%` }}
      />
    </div>
  )
}

function HeatmapGrid({ data }: { data: HeatmapDay[] }) {
  const maxCount = Math.max(...data.map((d) => d.count), 1)
  const getColor = (count: number) => {
    if (count === 0) return 'bg-gray-100'
    const ratio = count / maxCount
    if (ratio > 0.75) return 'bg-blue-500'
    if (ratio > 0.5) return 'bg-blue-400'
    if (ratio > 0.25) return 'bg-blue-300'
    return 'bg-blue-200'
  }

  return (
    <div>
      <div className="flex flex-wrap gap-1">
        {data.map((day, i) => (
          <div
            key={day.date || i}
            className={`w-3 h-3 sm:w-4 sm:h-4 rounded-sm ${getColor(day.count)} transition-colors`}
            title={`${day.date}: ${day.count} 次学习`}
          />
        ))}
      </div>
      <div className="flex items-center gap-2 mt-3 text-xs text-gray-400">
        <span>少</span>
        <div className="w-3 h-3 rounded-sm bg-gray-100" />
        <div className="w-3 h-3 rounded-sm bg-blue-200" />
        <div className="w-3 h-3 rounded-sm bg-blue-300" />
        <div className="w-3 h-3 rounded-sm bg-blue-400" />
        <div className="w-3 h-3 rounded-sm bg-blue-500" />
        <span>多</span>
      </div>
    </div>
  )
}

function ProficiencyBars({ distribution }: { distribution: ProficiencyLevel[] }) {
  const maxCount = Math.max(...distribution.map((d) => d.count), 1)
  const LEVEL_COLORS: Record<string, string> = {
    Lv5: 'bg-emerald-500',
    Lv4: 'bg-blue-500',
    Lv3: 'bg-amber-400',
    Lv2: 'bg-orange-400',
    Lv1: 'bg-red-400',
  }

  if (distribution.length === 0) {
    return <p className="text-sm text-gray-400 py-4 text-center">暂无熟练度数据</p>
  }

  return (
    <div className="space-y-3">
      {distribution.map((item) => (
        <div key={item.level} className="flex items-center gap-3">
          <span className="w-8 text-xs font-medium text-gray-500 shrink-0">{item.level}</span>
          <span className="w-8 text-xs text-gray-400 shrink-0">{item.label}</span>
          <div className="flex-1 bg-gray-100 rounded-full h-2.5">
            <div
              className={`h-2.5 rounded-full ${LEVEL_COLORS[item.level] || 'bg-blue-500'} transition-all duration-500`}
              style={{ width: `${(item.count / maxCount) * 100}%` }}
            />
          </div>
          <span className="w-10 text-xs text-right text-gray-500 shrink-0">{item.count}</span>
        </div>
      ))}
    </div>
  )
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const { data, loading, error, execute } = useApi<DashboardState>()
  const [retryKey, setRetryKey] = useState(0)

  useEffect(() => {
    execute(async () => {
      const [todayTask, overview, heatmap, distribution] = await Promise.all([
        api.get<TodayTask>('/learn/today'),
        api.get<ProgressOverview>('/progress/overview'),
        api.get<HeatmapResponse>('/progress/heatmap', { days: 30 }),
        api.get<ProficiencyDistribution>('/progress/distribution'),
      ])
      return { todayTask, overview, heatmap, distribution }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retryKey])

  if (loading) {
    return (
      <div className="space-y-6">
        <header>
          <div className="h-6 bg-gray-200 rounded w-32 animate-pulse mb-2" />
          <div className="h-4 bg-gray-200 rounded w-48 animate-pulse" />
        </header>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <LoadingSkeleton type="card" />
          <LoadingSkeleton type="card" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <LoadingSkeleton type="chart" />
          <LoadingSkeleton type="chart" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <p className="text-gray-600 font-medium mb-1">数据加载失败</p>
        <p className="text-sm text-gray-400 mb-5">{error.message}</p>
        <button
          onClick={() => setRetryKey((k) => k + 1)}
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm"
        >
          重新加载
        </button>
      </div>
    )
  }

  if (!data) return null

  const { todayTask, overview, heatmap, distribution } = data

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-xl font-bold text-gray-800">学习概览</h2>
        <p className="text-sm text-gray-500 mt-0.5">坚持学习，每天进步</p>
      </header>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="mb-4">
            <span className="inline-block px-2.5 py-0.5 bg-blue-50 text-blue-700 text-xs font-medium rounded-full">
              今日任务
            </span>
          </div>

          <div className="flex gap-3 mb-4">
            <div className="flex-1 bg-gray-50 rounded-xl p-3 text-center">
              <p className="text-lg font-bold text-gray-800">{todayTask.dueReviewCount}</p>
              <p className="text-xs text-gray-500 mt-0.5">待复习</p>
            </div>
            <div className="flex-1 bg-gray-50 rounded-xl p-3 text-center">
              <p className="text-lg font-bold text-amber-600">{todayTask.newWordsAvailable}</p>
              <p className="text-xs text-gray-500 mt-0.5">新词</p>
            </div>
            <div className="flex-1 bg-gray-50 rounded-xl p-3 text-center">
              <p className="text-lg font-bold text-blue-600">{todayTask.estimatedMinutes}</p>
              <p className="text-xs text-gray-500 mt-0.5">分钟</p>
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
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-800">总进度</h3>
            <span className="text-2xl font-bold text-blue-600">{overview.progressPercent}%</span>
          </div>

          <div className="flex justify-center py-2 mb-3">
            <RingChart percent={overview.progressPercent} />
          </div>

          <ProgressBar percent={overview.progressPercent} />

          <p className="text-sm text-gray-500 mt-2">
            已学 <span className="font-semibold text-gray-700">{overview.wordsLearned}</span> / {overview.totalWords} 词
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            目标掌握率 <span className="text-emerald-600 font-medium">{overview.targetProficiency}%</span>
          </p>
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h3 className="font-semibold text-gray-800 mb-3">学习热力图</h3>
          <HeatmapGrid data={heatmap.heatmap} />
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h3 className="font-semibold text-gray-800 mb-3">熟练度分布</h3>
          <ProficiencyBars distribution={distribution.distribution} />
        </div>
      </section>
    </div>
  )
}
