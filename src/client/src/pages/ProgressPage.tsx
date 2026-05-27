import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { useApi } from '../hooks/useApi'
import type { RoundsResponse, ProficiencyDistribution, HeatmapResponse } from '../types/api'
import type { ProficiencyLevel } from '../types/models'

interface ProgressState {
  rounds: RoundsResponse
  distribution: ProficiencyDistribution
  heatmap: HeatmapResponse
}

const DAY_LABELS = ['日', '一', '二', '三', '四', '五', '六']

const LEVEL_COLORS: Record<string, string> = {
  Lv5: 'bg-emerald-500',
  Lv4: 'bg-blue-500',
  Lv3: 'bg-amber-400',
  Lv2: 'bg-orange-400',
  Lv1: 'bg-red-400',
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-6 bg-gray-200 rounded w-24 mb-2" />
      <div className="h-4 bg-gray-200 rounded w-36" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className="h-4 bg-gray-200 rounded w-1/3 mb-4" />
            <div className="h-3 bg-gray-200 rounded w-full mb-2" />
            <div className="h-3 bg-gray-200 rounded w-2/3" />
          </div>
        ))}
      </div>
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <div className="h-4 bg-gray-200 rounded w-1/4 mb-4" />
        <div className="flex gap-2">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="flex-1 h-24 bg-gray-200 rounded-md" />
          ))}
        </div>
      </div>
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <div className="h-4 bg-gray-200 rounded w-1/4 mb-4" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-3 bg-gray-200 rounded w-full mb-2" />
        ))}
      </div>
    </div>
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

function ProficiencyBars({ distribution }: { distribution: ProficiencyLevel[] }) {
  const maxCount = Math.max(...distribution.map((d) => d.count), 1)

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

function StatCard({
  label,
  value,
  unit,
  color = 'text-blue-600',
}: {
  label: string
  value: number | string
  unit?: string
  color?: string
}) {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 text-center">
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>
        {value}
        {unit !== undefined && <span className="text-sm font-normal text-gray-400 ml-0.5">{unit}</span>}
      </p>
    </div>
  )
}

export default function ProgressPage() {
  const { data, loading, error, execute } = useApi<ProgressState>()
  const [retryKey, setRetryKey] = useState(0)

  useEffect(() => {
    execute(async () => {
      const [rounds, distribution, heatmap] = await Promise.all([
        api.get<RoundsResponse>('/progress/rounds'),
        api.get<ProficiencyDistribution>('/progress/distribution'),
        api.get<HeatmapResponse>('/progress/heatmap', { days: 30 }),
      ])
      return { rounds, distribution, heatmap }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retryKey])

  if (loading) {
    return <LoadingSkeleton />
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

  const { rounds, distribution, heatmap } = data

  const weekDays = heatmap.heatmap.slice(-7)
  const maxWeeklyCount = Math.max(...weekDays.map((d) => d.count), 1)

  const totalSessions = rounds.rounds.reduce((sum, r) => sum + r.sessionsCount, 0)

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-xl font-bold text-gray-800">学习进度</h2>
        <p className="text-sm text-gray-500 mt-0.5">你的坚持，终有回报</p>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {rounds.rounds.length === 0 ? (
          <div className="md:col-span-2 bg-white rounded-2xl p-8 shadow-sm border border-gray-100 text-center">
            <p className="text-gray-400">暂无轮次数据，开始学习后即可查看</p>
          </div>
        ) : (
          rounds.rounds.map((round) => {
            const isActive = round.status === 'active'
            const isCompleted = round.status === 'completed'
            return (
              <div
                key={round.round}
                className={`bg-white rounded-2xl p-5 shadow-sm border transition-all ${
                  isActive ? 'border-blue-500 border-2' : 'border-gray-100'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-800">第 {round.round} 轮</span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        isCompleted
                          ? 'bg-emerald-50 text-emerald-600'
                          : isActive
                          ? 'bg-blue-50 text-blue-600'
                          : 'bg-gray-50 text-gray-400'
                      }`}
                    >
                      {isCompleted ? '已完成' : isActive ? '进行中' : '未开启'}
                    </span>
                    {round.wordMode && (
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-gray-100 text-gray-500">
                        {round.wordMode === 'random' ? '全随机' : round.wordMode === 'alpha' ? '按首字母乱序' : `仅 ${round.wordMode} 开头`}
                      </span>
                    )}
                  </div>
                  <span
                    className={`text-lg font-bold ${
                      isCompleted ? 'text-emerald-600' : 'text-blue-600'
                    }`}
                  >
                    {Math.round(round.progressPercent)}%
                  </span>
                </div>

                <ProgressBar percent={round.progressPercent} />

                <div className="flex items-center justify-between gap-4 mt-2 text-xs text-gray-400">
                  <span>
                    掌握 {round.masteredCount} / {round.totalWords} 词
                  </span>
                  <span>{round.sessionsCount} / {round.estimatedSessions} 次学习</span>
                </div>

                <div className="flex items-center justify-between mt-1 text-xs text-gray-400">
                  <span>正确率 {Math.round(round.avgCorrectRate)}%</span>
                  <span>平均熟练度 {Math.round(round.avgProficiency)}</span>
                </div>

                {round.startDate && (
                  <p className="text-xs text-gray-400 mt-2">
                    {isCompleted ? '完成于' : '开始于'}{' '}
                    {new Date(round.completedAt || round.startDate).toLocaleDateString('zh-CN')}
                  </p>
                )}
              </div>
            )
          })
        )}
      </section>

      <section className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <h3 className="font-semibold text-gray-800 mb-4">本周学习</h3>
        {weekDays.length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center">暂无本周学习数据</p>
        ) : (
          <div className="flex items-end justify-between gap-2 sm:gap-4">
            {weekDays.map((day) => {
              const dateObj = new Date(day.date + 'T00:00:00')
              const dayOfWeek = dateObj.getDay()
              const height = Math.max((day.count / maxWeeklyCount) * 120, day.count > 0 ? 8 : 4)
              return (
                <div key={day.date} className="flex-1 flex flex-col items-center gap-1.5">
                  <span className="text-xs font-medium text-gray-500">{day.count}</span>
                  <div
                    className="w-full bg-blue-500 rounded-t-lg transition-all hover:bg-blue-600"
                    style={{ height: `${height}px` }}
                  />
                  <span className="text-xs text-gray-400">{DAY_LABELS[dayOfWeek]}</span>
                </div>
              )
            })}
          </div>
        )}
      </section>

      <section className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <h3 className="font-semibold text-gray-800 mb-4">熟练度分布</h3>
        <ProficiencyBars distribution={distribution.distribution} />
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="平均熟练度"
          value={Math.round(distribution.avgProficiency)}
          unit="/100"
          color="text-blue-600"
        />
        <StatCard
          label="累计学习次数"
          value={totalSessions}
          unit="次"
          color="text-emerald-600"
        />
        <StatCard
          label="当前轮次"
          value={rounds.currentRound}
          unit=""
          color="text-amber-600"
        />
      </section>
    </div>
  )
}
