import { useState } from 'react'

function estimateTime(wordCount: number): string {
  if (wordCount <= 0) return '0 分钟'
  // 基于设计文档 §6.5 的估算模型：
  // 复习 ~12s/词，新词 ~30s/词，总测 ~12s/词，缓冲 ~3min
  const reviewWords = Math.round(wordCount * 0.6)
  const newWords = wordCount - reviewWords
  const totalSeconds =
    reviewWords * 12 + newWords * 30 + wordCount * 12 + 180
  const minutes = Math.round(totalSeconds / 60)
  if (minutes < 60) return `${minutes} 分钟`
  return `${Math.floor(minutes / 60)} 小时 ${minutes % 60} 分钟`
}

export default function SettingsPage() {
  const [newWordsPerRound, setNewWordsPerRound] = useState(15)
  const [dailyGoal, setDailyGoal] = useState(40)
  const [spellingMode, setSpellingMode] = useState(false)
  const [initialHint, setInitialHint] = useState(true)
  const [choiceCount, setChoiceCount] = useState(4)
  const [previewNew, setPreviewNew] = useState(false)
  const [dailyReminder, setDailyReminder] = useState(true)
  const [reminderTime, setReminderTime] = useState('20:00')

  return (
    <div className="space-y-6 max-w-2xl">
      <header>
        <h2 className="text-xl font-bold text-gray-800">设置</h2>
        <p className="text-sm text-gray-500 mt-0.5">自定义你的学习体验</p>
      </header>

      <section className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <span className="text-lg">📚</span>
          学习设置
        </h3>
        <div className="space-y-5">
          <div>
            <label className="flex items-center justify-between text-sm mb-1.5">
              <span className="text-gray-700 font-medium">
                每日学习目标
              </span>
              <span className="text-blue-600 font-semibold tabular-nums">
                {dailyGoal} 词
              </span>
            </label>
            <input
              type="range"
              min={5}
              max={120}
              step={5}
              value={dailyGoal}
              onChange={(e) => setDailyGoal(Number(e.target.value))}
              className="w-full h-2 bg-gray-100 rounded-full appearance-none cursor-pointer accent-blue-600"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>5 词</span>
              <span>120 词</span>
            </div>
            <div className="mt-2 flex items-center gap-2 text-sm text-gray-500 bg-blue-50 rounded-xl px-3 py-2">
              <span>⏱</span>
              <span>预计每日学习时长: <strong className="text-blue-700">{estimateTime(dailyGoal)}</strong></span>
            </div>
          </div>

          <div>
            <label className="flex items-center justify-between text-sm mb-1.5">
              <span className="text-gray-700 font-medium">
                每次新词数
              </span>
              <span className="text-blue-600 font-semibold tabular-nums">
                {newWordsPerRound}
              </span>
            </label>
            <input
              type="range"
              min={1}
              max={50}
              value={newWordsPerRound}
              onChange={(e) => setNewWordsPerRound(Number(e.target.value))}
              className="w-full h-2 bg-gray-100 rounded-full appearance-none cursor-pointer accent-blue-600"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>1</span>
              <span>50</span>
            </div>
            <div className="mt-2 text-xs text-gray-400 bg-gray-50 rounded-xl px-3 py-2">
              每次学习（复习 + 新词 + 总测）中新引入的词汇数量。较大的值会增加单次学习时长。
            </div>
          </div>

          <ToggleRow
            label="拼写模式"
            description="关闭选择题，改为拼写输入"
            checked={spellingMode}
            onChange={setSpellingMode}
          />
          <ToggleRow
            label="首字母提示"
            description="拼写模式时显示首字母"
            checked={initialHint}
            onChange={setInitialHint}
          />

          <div>
            <label className="block text-sm text-gray-700 font-medium mb-1.5">
              选择题选项数
            </label>
            <div className="flex gap-2">
              {[2, 4, 6].map((n) => (
                <button
                  key={n}
                  onClick={() => setChoiceCount(n)}
                  className={`flex-1 py-2.5 rounded-xl border-2 text-sm font-medium transition-all ${
                    choiceCount === n
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                  }`}
                >
                  {n} 项
                </button>
              ))}
            </div>
          </div>

          <ToggleRow
            label="新词先预览"
            description="学习新词前先快速预览一遍"
            checked={previewNew}
            onChange={setPreviewNew}
          />
        </div>
      </section>

      <section className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <span className="text-lg">🔔</span>
          通知
        </h3>
        <div className="space-y-4">
          <ToggleRow
            label="每日提醒"
            description="每天固定时间提醒你学习"
            checked={dailyReminder}
            onChange={setDailyReminder}
          />
          {dailyReminder && (
            <div className="flex items-center gap-3 pl-0">
              <label className="text-sm text-gray-600">提醒时间</label>
              <input
                type="time"
                value={reminderTime}
                onChange={(e) => setReminderTime(e.target.value)}
                className="px-4 py-2 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300 transition-colors"
              />
            </div>
          )}
        </div>
      </section>

      <section className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <span className="text-lg">👤</span>
          账号
        </h3>
        <div className="space-y-3">
          <button className="w-full py-3 px-4 bg-gray-50 hover:bg-gray-100 active:bg-gray-200 text-gray-700 font-medium rounded-xl border border-gray-200 transition-colors text-sm text-left">
            修改密码
          </button>
          <button className="w-full py-3 px-4 bg-gray-50 hover:bg-gray-100 active:bg-gray-200 text-gray-700 font-medium rounded-xl border border-gray-200 transition-colors text-sm text-left">
            导出数据
          </button>
          <button className="w-full py-3 px-4 bg-orange-50 hover:bg-orange-100 active:bg-orange-200 text-orange-700 font-medium rounded-xl border border-orange-200 transition-colors text-sm text-left">
            重置本轮进度
          </button>
        </div>
      </section>
    </div>
  )
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string
  description: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-700 font-medium">{label}</p>
        <p className="text-xs text-gray-400 truncate">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${
          checked ? 'bg-blue-600' : 'bg-gray-200'
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0 transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  )
}
