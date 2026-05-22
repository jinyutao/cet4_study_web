import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'

type Phase = 'mode_select' | 'review' | 'new_words' | 'final_test' | 'complete'
type WordMode = 'random' | 'alpha'

interface QuizItem {
  word: string
  phonetic: string
  choices: { text: string; correct: boolean }[]
}

const demoWords: QuizItem[] = [
  { word: 'abandon', phonetic: '[əˈbændən]', choices: [{ text: '放弃', correct: true }, { text: '接受', correct: false }, { text: '到达', correct: false }, { text: '关于', correct: false }] },
  { word: 'ability', phonetic: '[əˈbiliti]', choices: [{ text: '能力', correct: true }, { text: '缺席', correct: false }, { text: '绝对的', correct: false }, { text: '吸收', correct: false }] },
  { word: 'abnormal', phonetic: '[æbˈnɔːməl]', choices: [{ text: '不正常的', correct: true }, { text: '抽象的', correct: false }, { text: '充足的', correct: false }, { text: '滥用', correct: false }] },
  { word: 'absorb', phonetic: '[əbˈsɔːb]', choices: [{ text: '吸收', correct: true }, { text: '抽象', correct: false }, { text: '绝对的', correct: false }, { text: '滥用', correct: false }] },
  { word: 'academic', phonetic: '[ˌækəˈdemik]', choices: [{ text: '学术的', correct: true }, { text: '加速', correct: false }, { text: '通道', correct: false }, { text: '意外', correct: false }] },
  { word: 'access', phonetic: '[ˈækses]', choices: [{ text: '通道', correct: true }, { text: '事故', correct: false }, { text: '容纳', correct: false }, { text: '完成', correct: false }] },
  { word: 'accident', phonetic: '[ˈæksidənt]', choices: [{ text: '事故', correct: true }, { text: '通道', correct: false }, { text: '附赠', correct: false }, { text: '完成', correct: false }] },
  { text: 'adequate', phonetic: '[ˈædikwit]', choices: [{ text: '足够的', correct: true }, { text: '调整', correct: false }, { text: '采纳', correct: false }, { text: '成人', correct: false }] },
  { text: 'adjust', phonetic: '[əˈdʒʌst]', choices: [{ text: '调整', correct: true }, { text: '采用', correct: false }, { text: '管理', correct: false }, { text: '钦佩', correct: false }] },
  { text: 'admire', phonetic: '[ədˈmaiə]', choices: [{ text: '钦佩', correct: true }, { text: '允许', correct: false }, { text: '采纳', correct: false }, { text: '前进', correct: false }] },
  { text: 'advance', phonetic: '[ədˈvɑːns]', choices: [{ text: '前进', correct: true }, { text: '优势', correct: false }, { text: '冒险', correct: false }, { text: '广告', correct: false }] },
  { text: 'adventure', phonetic: '[ədˈvent∫ə]', choices: [{ text: '冒险', correct: true }, { text: '优势', correct: false }, { text: '广告', correct: false }, { text: '建议', correct: false }] },
]

const demoNewWords = [
  { word: 'cherish', phonetic: '[ˈtʃeriʃ]', choices: [{ text: '珍惜', correct: true }, { text: '樱桃', correct: false }, { text: '欢呼', correct: false }, { text: '奶酪', correct: false }] },
  { word: 'diligent', phonetic: '[ˈdilidʒənt]', choices: [{ text: '勤奋的', correct: true }, { text: '数字的', correct: false }, { text: '微弱的', correct: false }, { text: '困难', correct: false }] },
  { word: 'eloquent', phonetic: '[ˈeləkwənt]', choices: [{ text: '雄辩的', correct: true }, { text: '优雅的', correct: false }, { text: '消除的', correct: false }, { text: '电子的', correct: false }] },
  { word: 'fluctuate', phonetic: '[ˈflʌktʃueit]', choices: [{ text: '波动', correct: true }, { text: '流动', correct: false }, { text: '困惑', correct: false }, { text: '影响', correct: false }] },
]

export default function LearnPage() {
  const navigate = useNavigate()
  const [phase, setPhase] = useState<Phase>('mode_select')
  const [wordMode, setWordMode] = useState<WordMode | null>(null)
  const [currentIdx, setCurrentIdx] = useState(0)
  const [selected, setSelected] = useState<number | null>(null)
  const [scores, setScores] = useState<boolean[]>([])

  // Review uses demoWords, new words uses demoNewWords
  const isReviewPhase = phase === 'review'
  const wordList = phase === 'new_words' ? demoNewWords : demoWords
  const total = phase === 'new_words' ? demoNewWords.length : demoWords.length
  const isLast = currentIdx >= total - 1

  const handleChoice = useCallback((idx: number) => {
    if (selected !== null) return
    setSelected(idx)
    const correct = wordList[currentIdx].choices[idx].correct
    setScores(prev => [...prev, correct])
  }, [selected, wordList, currentIdx])

  const handleNext = useCallback(() => {
    if (!isLast) {
      setCurrentIdx(i => i + 1)
      setSelected(null)
      return
    }
    // Phase transition
    if (phase === 'review') {
      setPhase('new_words')
      setCurrentIdx(0)
      setSelected(null)
    } else if (phase === 'new_words') {
      setPhase('final_test')
      setCurrentIdx(0)
      setSelected(null)
    } else if (phase === 'final_test') {
      setPhase('complete')
    }
  }, [isLast, phase])

  const startSession = useCallback(() => {
    if (!wordMode) return
    setPhase('review')
    setCurrentIdx(0)
    setSelected(null)
    setScores([])
  }, [wordMode])

  // ── Phase 0: Mode Selection ────────────────────
  if (phase === 'mode_select') {
    return <ModeSelection wordMode={wordMode} onSelect={setWordMode} onStart={startSession} />
  }

  // ── Phase 4: Session Complete ──────────────────
  if (phase === 'complete') {
    return (
      <SessionComplete
        scores={scores}
        onGoHome={() => navigate('/dashboard')}
      />
    )
  }

  const progressPct = total > 0 ? ((currentIdx + 1) / total) * 100 : 0
  const currentWord = wordList[currentIdx]
  const phaseLabel = phase === 'review' ? '复习阶段' : phase === 'new_words' ? '学习新词' : '总测试'
  const phaseEmoji = phase === 'review' ? '🔄' : phase === 'new_words' ? '📖' : '🎯'

  return (
    <div className="max-w-lg mx-auto space-y-5">
      <header className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">{phaseEmoji}</span>
            <span className="text-sm font-semibold text-gray-700">{phaseLabel}</span>
          </div>
          <div className="flex items-center gap-3 text-xs text-gray-400">
            <span>
              {phase === 'review' ? '复习' : phase === 'new_words' ? '新词' : '测试'} {currentIdx + 1}/{total}
            </span>
            <span className="font-mono">2.3s</span>
          </div>
        </div>
        {/* Progress bar */}
        <div className="w-full bg-gray-100 rounded-full h-2.5">
          <div
            className={`h-2.5 rounded-full transition-all duration-500 ${
              phase === 'review' ? 'bg-blue-500' : phase === 'new_words' ? 'bg-violet-500' : 'bg-amber-500'
            }`}
            style={{ width: `${progressPct}%` }}
          />
        </div>
        {/* Phase dots */}
        <div className="flex items-center justify-center gap-1.5">
          {(['review', 'new_words', 'final_test'] as Phase[]).map((p, i) => (
            <div key={p} className="flex items-center gap-1.5">
              <div className={`w-2.5 h-2.5 rounded-full ${
                phase === p ? 'ring-2 ring-offset-1 ' + (
                  p === 'review' ? 'ring-blue-400 bg-blue-500' : p === 'new_words' ? 'ring-violet-400 bg-violet-500' : 'ring-amber-400 bg-amber-500'
                ) : scores.length > 0 && i <= (phase === 'review' ? 0 : phase === 'new_words' ? 1 : 2)
                  ? 'bg-emerald-400'
                  : 'bg-gray-200'
              }`} />
              {i < 2 && <div className={`w-6 h-0.5 ${phase === p || (phase === 'new_words' && p === 'review') || (phase === 'final_test' && (p === 'review' || p === 'new_words')) ? 'bg-emerald-300' : 'bg-gray-200'}`} />}
            </div>
          ))}
        </div>
      </header>

      {/* Quiz card */}
      <section className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-gray-100 text-center">
        <p className="text-sm text-gray-400 mb-2">
          {phase === 'new_words' ? '请选择新词的中文释义' : '请选择正确的中文释义'}
        </p>
        <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-1">
          {currentWord.word}
        </h2>
        <p className="text-sm text-gray-400 font-mono mb-6">{currentWord.phonetic}</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {currentWord.choices.map((choice, idx) => {
            let btnClass =
              'w-full py-3 px-4 rounded-xl border-2 text-sm font-medium transition-all'

            if (selected === null) {
              btnClass +=
                ' border-gray-200 bg-white text-gray-700 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 cursor-pointer active:scale-[0.98]'
            } else if (choice.correct) {
              btnClass += ' border-emerald-500 bg-emerald-50 text-emerald-700'
            } else if (selected === idx) {
              btnClass += ' border-red-400 bg-red-50 text-red-600'
            } else {
              btnClass += ' border-gray-100 bg-gray-50 text-gray-400'
            }

            return (
              <button
                key={idx}
                onClick={() => handleChoice(idx)}
                disabled={selected !== null}
                className={btnClass}
              >
                {choice.text}
              </button>
            )
          })}
        </div>

        {/* Feedback */}
        {selected !== null && (
          <div className={`mt-4 text-sm font-medium ${
            currentWord.choices[selected].correct ? 'text-emerald-600' : 'text-red-500'
          }`}>
            {currentWord.choices[selected].correct ? '✅ 回答正确！' : `❌ 正确答案: ${currentWord.choices.find(c => c.correct)?.text}`}
          </div>
        )}
      </section>

      {/* Score bar */}
      <section className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-gray-400">本轮答题记录</p>
          <p className="text-xs text-gray-400">
            {scores.filter(Boolean).length}/{scores.length} 正确
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {scores.length === 0 ? (
            <span className="text-xs text-gray-300">还没有答题记录</span>
          ) : (
            scores.map((s, i) => (
              <span
                key={i}
                className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${
                  s ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-500'
                }`}
              >
                {s ? '✓' : '✗'}
              </span>
            ))
          )}
        </div>
      </section>

      {/* Next / Complete button */}
      <button
        onClick={handleNext}
        disabled={selected === null}
        className={`w-full py-3.5 font-semibold rounded-xl transition-all shadow-sm text-base ${
          selected === null
            ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
            : isLast && phase === 'final_test'
              ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
              : 'bg-blue-600 hover:bg-blue-700 text-white active:scale-[0.99]'
        }`}
      >
        {selected === null
          ? '请选择一个答案'
          : isLast && phase === 'final_test'
            ? '🏁 完成测试'
            : isLast
              ? '进入下一步 →'
              : '下一题'}
      </button>
    </div>
  )
}

// ── Mode Selection Screen (§7.7) ──────────────────
function ModeSelection({
  wordMode,
  onSelect,
  onStart,
}: {
  wordMode: WordMode | null
  onSelect: (m: WordMode) => void
  onStart: () => void
}) {
  return (
    <div className="max-w-lg mx-auto">
      <div className="text-center mb-6">
        <span className="text-4xl">🎉</span>
        <h2 className="text-xl font-bold text-gray-800 mt-2">准备开始新一轮学习</h2>
        <p className="text-sm text-gray-400 mt-1">
          请选择本轮新词学习顺序（一轮内不可更改）
        </p>
      </div>

      <div className="space-y-3">
        {/* Random mode card */}
        <button
          onClick={() => onSelect('random')}
          className={`w-full text-left p-5 rounded-2xl border-2 transition-all ${
            wordMode === 'random'
              ? 'border-blue-500 bg-blue-50 shadow-md'
              : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
          }`}
        >
          <div className="flex items-start gap-3">
            <div className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
              wordMode === 'random' ? 'border-blue-500' : 'border-gray-300'
            }`}>
              {wordMode === 'random' && <div className="w-3 h-3 rounded-full bg-blue-500" />}
            </div>
            <div>
              <p className="font-semibold text-gray-800">全随机</p>
              <p className="text-sm text-gray-400 mt-0.5">
                整个词汇表随机抽取，每次都有新鲜感
              </p>
            </div>
          </div>
        </button>

        {/* Alpha mode card */}
        <button
          onClick={() => onSelect('alpha')}
          className={`w-full text-left p-5 rounded-2xl border-2 transition-all ${
            wordMode === 'alpha'
              ? 'border-violet-500 bg-violet-50 shadow-md'
              : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
          }`}
        >
          <div className="flex items-start gap-3">
            <div className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
              wordMode === 'alpha' ? 'border-violet-500' : 'border-gray-300'
            }`}>
              {wordMode === 'alpha' && <div className="w-3 h-3 rounded-full bg-violet-500" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="font-semibold text-gray-800">按首字母乱序</p>
                <span className="text-xs bg-violet-100 text-violet-600 px-2 py-0.5 rounded-full font-medium">推荐</span>
              </div>
              <p className="text-sm text-gray-400 mt-0.5">
                从 A→Z 分组推进，组内随机打乱，有章节感，适合系统化学习
              </p>
            </div>
          </div>
        </button>
      </div>

      <div className="mt-6 space-y-3">
        <button
          onClick={onStart}
          disabled={!wordMode}
          className={`w-full py-3.5 font-semibold rounded-xl transition-all shadow-sm text-base ${
            wordMode
              ? 'bg-blue-600 hover:bg-blue-700 text-white active:scale-[0.99]'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }`}
        >
          {wordMode ? '🚀 开始学习' : '请先选择学习模式'}
        </button>
        <p className="text-xs text-gray-400 text-center">
          💡 本轮内不可更改，下一轮可重新选择
        </p>
      </div>
    </div>
  )
}

// ── Session Complete Screen ──────────────────────
function SessionComplete({
  scores,
  onGoHome,
}: {
  scores: boolean[]
  onGoHome: () => void
}) {
  const correctCount = scores.filter(Boolean).length
  const totalCount = scores.length
  const pct = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0

  return (
    <div className="max-w-lg mx-auto text-center space-y-6">
      <div className="text-6xl mb-2">
        {pct >= 90 ? '🎉' : pct >= 70 ? '👍' : '💪'}
      </div>

      <h2 className="text-2xl font-bold text-gray-800">
        {pct >= 90 ? '太棒了！' : pct >= 70 ? '做得不错！' : '继续加油！'}
      </h2>

      <section className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-4">
        <div className="flex justify-center">
          <div className="relative w-28 h-28">
            <svg className="w-28 h-28 -rotate-90" viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="52" fill="none" stroke="#e5e7eb" strokeWidth="8" />
              <circle
                cx="60" cy="60" r="52" fill="none"
                stroke={pct >= 90 ? '#10b981' : pct >= 70 ? '#f59e0b' : '#ef4444'}
                strokeWidth="8"
                strokeDasharray={`${(pct / 100) * 327} 327`}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-2xl font-bold text-gray-800">{pct}%</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="bg-green-50 rounded-xl p-3">
            <p className="text-lg font-bold text-green-600">{correctCount}</p>
            <p className="text-xs text-gray-400">正确</p>
          </div>
          <div className="bg-red-50 rounded-xl p-3">
            <p className="text-lg font-bold text-red-500">{totalCount - correctCount}</p>
            <p className="text-xs text-gray-400">错误</p>
          </div>
          <div className="bg-blue-50 rounded-xl p-3">
            <p className="text-lg font-bold text-blue-600">{totalCount}</p>
            <p className="text-xs text-gray-400">总题数</p>
          </div>
        </div>
      </section>

      <button
        onClick={onGoHome}
        className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-all shadow-sm text-base active:scale-[0.99]"
      >
        📊 返回首页
      </button>
    </div>
  )
}
