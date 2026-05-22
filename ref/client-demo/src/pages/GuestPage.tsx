import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

interface PublicStats {
  totalUsers: number
  activeUsers: number
  totalWords: number
  totalMastered: number
  totalSessions: number
  topLearners: { username: string; mastered: number; proficiency: number }[]
  recentActivity: { date: string; count: number }[]
}

const defaultStats: PublicStats = {
  totalUsers: 5,
  activeUsers: 3,
  totalWords: 4526,
  totalMastered: 8750,
  totalSessions: 342,
  topLearners: [
    { username: 'zhangsan', mastered: 3210, proficiency: 78 },
    { username: 'lisi', mastered: 2840, proficiency: 72 },
    { username: 'admin', mastered: 4526, proficiency: 95 },
  ],
  recentActivity: [
    { date: '05-17', count: 12 },
    { date: '05-18', count: 8 },
    { date: '05-19', count: 15 },
    { date: '05-20', count: 10 },
    { date: '05-21', count: 18 },
  ],
}

export default function GuestPage() {
  const navigate = useNavigate()
  const [stats] = useState<PublicStats>(defaultStats)

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      {/* Top bar */}
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

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-12 pb-8 text-center">
        <h2 className="text-3xl md:text-4xl font-bold text-gray-800 mb-3">
          基于间隔重复的 CET-4 词汇系统
        </h2>
        <p className="text-gray-500 max-w-xl mx-auto mb-8">
          自适应学习、多轮复习、多维熟练度评估 — 科学高效地掌握 4526 个大纲词汇
        </p>
        <button
          onClick={() => navigate('/register')}
          className="px-8 py-3 text-base font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-2xl transition-colors shadow-md shadow-blue-200"
        >
          免费注册开始学习 🚀
        </button>
      </section>

      {/* Stats cards */}
      <section className="max-w-6xl mx-auto px-6 pb-10">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { label: '总用户', value: stats.totalUsers, icon: '👥', color: 'bg-blue-50 text-blue-700' },
            { label: '本月活跃', value: stats.activeUsers, icon: '⚡', color: 'bg-green-50 text-green-700' },
            { label: '总词汇量', value: stats.totalWords, icon: '📚', color: 'bg-purple-50 text-purple-700' },
            { label: '已掌握', value: stats.totalMastered, icon: '✅', color: 'bg-emerald-50 text-emerald-700' },
            { label: '学习次数', value: stats.totalSessions, icon: '📝', color: 'bg-amber-50 text-amber-700' },
          ].map((item) => (
            <div
              key={item.label}
              className={`rounded-2xl p-4 ${item.color} flex flex-col items-center justify-center text-center`}
            >
              <span className="text-2xl mb-1">{item.icon}</span>
              <span className="text-xl font-bold">{item.value}</span>
              <span className="text-xs opacity-75 mt-0.5">{item.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Leaderboard + Activity */}
      <section className="max-w-6xl mx-auto px-6 pb-16">
        <div className="grid md:grid-cols-2 gap-6">

          {/* Top learners */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <span>🏆</span> 学习榜
            </h3>
            <div className="space-y-3">
              {stats.topLearners.map((learner, i) => (
                <div
                  key={learner.username}
                  className="flex items-center justify-between py-2 px-3 rounded-xl bg-gray-50"
                >
                  <div className="flex items-center gap-3">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      i === 0 ? 'bg-amber-100 text-amber-700' :
                      i === 1 ? 'bg-gray-200 text-gray-600' :
                      'bg-orange-100 text-orange-700'
                    }`}>
                      {i + 1}
                    </span>
                    <span className="text-sm font-medium text-gray-700">{learner.username}</span>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-gray-800">{learner.mastered} 词</div>
                    <div className="text-xs text-gray-400">熟练度 {learner.proficiency}%</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent activity */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <span>📈</span> 最近学习动态
            </h3>
            <div className="flex items-end justify-between h-32 gap-2">
              {stats.recentActivity.map((day) => {
                const maxCount = Math.max(...stats.recentActivity.map((d) => d.count))
                const height = (day.count / maxCount) * 100
                return (
                  <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-xs text-gray-400 font-medium">{day.count}</span>
                    <div
                      className="w-full bg-blue-500 rounded-t-lg transition-all"
                      style={{ height: `${height}%` }}
                    />
                    <span className="text-xs text-gray-400">{day.date}</span>
                  </div>
                )
              })}
            </div>
          </div>

        </div>
      </section>

      {/* Features */}
      <section className="bg-white border-t border-gray-100">
        <div className="max-w-6xl mx-auto px-6 py-12">
          <h3 className="text-xl font-bold text-gray-800 text-center mb-8">核心功能</h3>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { icon: '🧠', title: '间隔重复', desc: '基于 SM-2 算法，动态安排复习计划，对抗遗忘曲线' },
              { icon: '📊', title: '多维评估', desc: '综合正确率、反应时间、连续正确数等多维度评估熟练度' },
              { icon: '🎯', title: '多轮循环', desc: '掌握 90% 进入下一轮，每轮逐步加深记忆' },
              { icon: '📱', title: '多端适配', desc: 'PC / iPad / iPhone 自适应布局' },
              { icon: '🔄', title: '混合答题', desc: '选择题 + 拼写题混合，从认知到回忆逐步强化' },
              { icon: '👥', title: '多用户', desc: '支持多账号，每人独立进度' },
            ].map((feat) => (
              <div key={feat.title} className="bg-gray-50 rounded-2xl p-5 text-center">
                <span className="text-3xl mb-3 block">{feat.icon}</span>
                <h4 className="font-semibold text-gray-800 mb-1">{feat.title}</h4>
                <p className="text-sm text-gray-500">{feat.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="text-center py-6 text-xs text-gray-400">
        CET-4 背单词系统 · 基于间隔重复的自适应学习
      </footer>
    </div>
  )
}
