import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import type { PublicStats } from '../types/api'
import LoadingSkeleton from '../components/LoadingSkeleton'

function formatTimestamp(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const seconds = Math.floor(diff / 1000)
  if (seconds < 60) return '刚刚'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}分钟前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}小时前`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}天前`
  return new Date(iso).toLocaleDateString('zh-CN')
}

const statCards = [
  { key: 'totalUsers' as const, label: '总用户', icon: '👥', bg: 'bg-blue-50 text-blue-700' },
  { key: 'activeUsers' as const, label: '活跃用户', icon: '⚡', bg: 'bg-green-50 text-green-700' },
  { key: 'totalWords' as const, label: '总词汇量', icon: '📚', bg: 'bg-purple-50 text-purple-700' },
  { key: 'totalReviews' as const, label: '总复习', icon: '✅', bg: 'bg-emerald-50 text-emerald-700' },
  { key: 'topLearners' as const, label: '学霸人数', icon: '📝', bg: 'bg-amber-50 text-amber-700' },
]

const features = [
  { icon: '🧠', title: '间隔重复', desc: '基于 SM-2 算法，动态安排复习计划，对抗遗忘曲线' },
  { icon: '📊', title: '多维评估', desc: '综合正确率、反应时间、连续正确数等多维度评估熟练度' },
  { icon: '🎯', title: '多轮循环', desc: '掌握 90% 进入下一轮，每轮逐步加深记忆' },
  { icon: '📱', title: '多端适配', desc: 'PC / iPad / iPhone 自适应布局' },
  { icon: '🔄', title: '混合答题', desc: '选择题 + 拼写题混合，从认知到回忆逐步强化' },
  { icon: '👥', title: '多用户', desc: '支持多账号，每人独立进度' },
]

function formatCount(n: number): string {
  if (n >= 10000) return (n / 10000).toFixed(1) + '万'
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k'
  return String(n)
}

export default function GuestPage() {
  const navigate = useNavigate()
  const [stats, setStats] = useState<PublicStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchStats = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.get<PublicStats>('/public/stats')
      setStats(data)
    } catch (err) {
      const message =
        err && typeof err === 'object' && 'message' in err
          ? (err as { message: string }).message
          : '获取统计数据失败，请检查网络连接'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStats()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
        <LoadingSkeleton />
      </div>
    )
  }

  if (error || !stats) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-sm w-full mx-4 text-center">
          <div className="text-4xl mb-4">😵</div>
          <p className="text-gray-600 mb-6">{error || '数据加载失败'}</p>
          <button
            onClick={fetchStats}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-colors"
          >
            重新加载
          </button>
        </div>
      </div>
    )
  }

  const learnerCount = stats.topLearners?.length ?? 0

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <header className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto">
        <div className="flex items-center gap-2">
          <span className="text-2xl">📖</span>
          <h1 className="text-lg font-bold text-gray-800">CET-4 背单词</h1>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/login')}
            className="px-5 py-2 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-xl transition-colors"
          >
            登录
          </button>
          <button
            onClick={() => navigate('/register')}
            className="px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors shadow-sm"
          >
            注册
          </button>
        </div>
      </header>

      <section className="max-w-6xl mx-auto px-6 pt-12 pb-10 text-center">
        <h2 className="text-3xl md:text-4xl font-bold text-gray-800 mb-3">
          基于间隔重复的 CET-4 词汇系统
        </h2>
        <p className="text-gray-500 max-w-xl mx-auto mb-8">
          自适应学习、多轮复习、多维熟练度评估
        </p>
        <button
          onClick={() => navigate('/register')}
          className="px-8 py-3 text-base font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-2xl transition-colors shadow-md shadow-blue-200"
        >
          免费注册开始学习 🚀
        </button>
      </section>

      <section className="max-w-6xl mx-auto px-6 pb-10">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {statCards.map((card) => {
            const raw = card.key === 'topLearners' ? learnerCount : (stats[card.key] as number)
            return (
              <div
                key={card.key}
                className={`rounded-2xl p-4 ${card.bg} flex flex-col items-center justify-center text-center`}
              >
                <span className="text-2xl mb-1">{card.icon}</span>
                <span className="text-xl font-bold">{formatCount(raw)}</span>
                <span className="text-xs opacity-75 mt-0.5">{card.label}</span>
              </div>
            )
          })}
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 pb-16">
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <span>🏆</span> 学习榜
            </h3>
            {(!stats.topLearners || stats.topLearners.length === 0) ? (
              <p className="text-sm text-gray-400 text-center py-6">暂无学习数据</p>
            ) : (
              <div className="space-y-3">
                {stats.topLearners.slice(0, 3).map((learner, i) => {
                  const badge =
                    i === 0
                      ? 'bg-amber-100 text-amber-700'
                      : i === 1
                        ? 'bg-gray-200 text-gray-600'
                        : 'bg-orange-100 text-orange-700'
                  const badgeIcon = i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'
                  return (
                    <div
                      key={learner.username}
                      className="flex items-center justify-between py-2 px-3 rounded-xl bg-gray-50"
                    >
                      <div className="flex items-center gap-3">
                        <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${badge}`}>
                          {badgeIcon}
                        </span>
                        <span className="text-sm font-medium text-gray-700">{learner.username}</span>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold text-gray-800">{learner.masteredCount} 词</div>
                        <div className="text-xs text-gray-400">{learner.daysActive} 天</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <span>📈</span> 最近学习动态
            </h3>
            {(!stats.recentActivity || stats.recentActivity.length === 0) ? (
              <p className="text-sm text-gray-400 text-center py-6">暂无动态</p>
            ) : (
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {stats.recentActivity.map((act, i) => (
                  <div
                    key={`${act.username}-${act.timestamp}-${i}`}
                    className="flex items-center justify-between py-2 px-3 rounded-xl bg-gray-50"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold shrink-0">
                        {act.username.charAt(0).toUpperCase()}
                      </span>
                      <span className="text-sm text-gray-700 truncate">
                        <span className="font-medium">{act.username}</span>{' '}
                        <span className="text-gray-500">{act.action}</span>
                      </span>
                    </div>
                    <span className="text-xs text-gray-400 shrink-0 ml-2">
                      {formatTimestamp(act.timestamp)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="bg-white border-t border-gray-100">
        <div className="max-w-6xl mx-auto px-6 py-12">
          <h3 className="text-xl font-bold text-gray-800 text-center mb-8">核心功能</h3>
          <div className="grid md:grid-cols-3 gap-6">
            {features.map((feat) => (
              <div key={feat.title} className="bg-gray-50 rounded-2xl p-5 text-center">
                <span className="text-3xl mb-3 block">{feat.icon}</span>
                <h4 className="font-semibold text-gray-800 mb-1">{feat.title}</h4>
                <p className="text-sm text-gray-500">{feat.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="text-center py-6 text-xs text-gray-400">
        CET-4 背单词系统 · 基于间隔重复的自适应学习
      </footer>
    </div>
  )
}
