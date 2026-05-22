import { useReducer, useEffect, useContext, useMemo, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { useTimer } from '../hooks/useTimer'
import { generateChoices } from '../lib/shuffle'
import { SettingsContext } from '../context/SettingsContext'
import type { ApiError, TodayTask } from '../types/api'
import type { WordItem, UserSettings } from '../types/models'
import type {
  StartSessionResponse,
  ReviewQueueResponse,
  NewWordsResponse,
  AnswerResponse,
  CompleteSessionResponse,
} from '../types/api'

// ── Types ──────────────────────────────────────────
type Phase = 'mode_select' | 'review' | 'new_words' | 'final_test' | 'complete'
type WordMode = 'random' | 'alpha'
type AnswerType = 'choice' | 'spelling'

interface LearnState {
  phase: Phase
  wordMode: WordMode | null
  sessionId: number | null
  round: number
  answerCount: number
  wordQueue: WordItem[]
  currentIndex: number
  selectedChoice: number | null
  answerLocked: boolean
  scores: boolean[]
  retestWordIds: number[]
  answerType: AnswerType
  spellingInput: string
  seenWords: WordItem[]
  answers: AnswerResponse[]
  sessionResult: CompleteSessionResponse | null
  loading: boolean
  error: string | null
  hasPreviewed: boolean
  isPreviewPhase: boolean
}

type LearnAction =
  | { type: 'SELECT_MODE'; mode: WordMode }
  | { type: 'SET_LOADING'; loading: boolean }
  | { type: 'SET_ERROR'; error: string | null }
  | { type: 'CLEAR_ERROR' }
  | { type: 'START_SESSION'; sessionId: number; round: number }
  | { type: 'LOAD_REVIEW_WORDS'; words: WordItem[] }
  | { type: 'LOAD_NEW_WORDS'; words: WordItem[]; hasPreviewed: boolean }
  | { type: 'PREVIEW_DONE' }
  | { type: 'SET_ANSWER_TYPE'; answerType: AnswerType }
  | { type: 'SELECT_CHOICE'; index: number; isCorrect: boolean; wordId: number }
  | { type: 'SET_SPELLING_INPUT'; input: string }
  | { type: 'RECORD_ANSWER'; response: AnswerResponse }
  | { type: 'NEXT_QUESTION' }
  | { type: 'TRANSITION_TO_NEW_WORDS' }
  | { type: 'TRANSITION_TO_FINAL_TEST' }
  | { type: 'RETEST_WORDS'; words: WordItem[] }
  | { type: 'COMPLETE_SESSION'; result: CompleteSessionResponse }
  | { type: 'RESET' }

// ── Helpers ────────────────────────────────────────
function determineAnswerType(answerCount: number, spellingMode: boolean): AnswerType {
  if (!spellingMode) return 'choice'
  if (answerCount < 3) return 'choice'
  return Math.random() < 0.5 ? 'choice' : 'spelling'
}

function mapNewWords(
  words: Pick<WordItem, 'wordId' | 'word' | 'phonetic' | 'pos' | 'chinese'>[]
): WordItem[] {
  return words.map(w => ({
    wordId: w.wordId,
    word: w.word,
    phonetic: w.phonetic,
    pos: w.pos,
    chinese: w.chinese,
    proficiency: 0,
    reviewType: 'review' as const,
    isDifficult: false,
  }))
}

const defaultSettings: UserSettings = {
  newWordsPerSession: 15,
  dailyGoal: 40,
  spellingMode: false,
  firstLetterHint: true,
  choiceOptions: 4,
  previewBeforeLearn: false,
  dailyReminder: true,
  reminderTime: '20:00',
}

const PHASE_ORDER: Phase[] = ['review', 'new_words', 'final_test']

// ── Initial State ──────────────────────────────────
const initialState: LearnState = {
  phase: 'mode_select',
  wordMode: null,
  sessionId: null,
  round: 0,
  answerCount: 0,
  wordQueue: [],
  currentIndex: 0,
  selectedChoice: null,
  answerLocked: false,
  scores: [],
  retestWordIds: [],
  answerType: 'choice',
  spellingInput: '',
  seenWords: [],
  answers: [],
  sessionResult: null,
  loading: false,
  error: null,
  hasPreviewed: true,
  isPreviewPhase: false,
}

// ── Reducer ────────────────────────────────────────
function learnReducer(state: LearnState, action: LearnAction): LearnState {
  switch (action.type) {
    case 'SELECT_MODE':
      return { ...state, wordMode: action.mode, error: null }

    case 'SET_LOADING':
      return { ...state, loading: action.loading }

    case 'SET_ERROR':
      return { ...state, error: action.error, loading: false }

    case 'CLEAR_ERROR':
      return { ...state, error: null }

    case 'START_SESSION':
      return { ...state, sessionId: action.sessionId, round: action.round }

    case 'LOAD_REVIEW_WORDS':
      return {
        ...state,
        phase: 'review',
        wordQueue: action.words,
        currentIndex: 0,
        scores: [],
        seenWords: [],
        answers: [],
        answerCount: 0,
        selectedChoice: null,
        answerLocked: false,
        spellingInput: '',
        error: null,
      }

    case 'LOAD_NEW_WORDS':
      return {
        ...state,
        wordQueue: action.words,
        currentIndex: 0,
        scores: [],
        selectedChoice: null,
        answerLocked: false,
        spellingInput: '',
        hasPreviewed: action.hasPreviewed,
        isPreviewPhase: !action.hasPreviewed,
        error: null,
      }

    case 'PREVIEW_DONE':
      return {
        ...state,
        isPreviewPhase: false,
        currentIndex: 0,
        scores: [],
        selectedChoice: null,
        answerLocked: false,
        spellingInput: '',
      }

    case 'SET_ANSWER_TYPE':
      return { ...state, answerType: action.answerType }

    case 'SELECT_CHOICE':
      return {
        ...state,
        selectedChoice: action.index,
        answerLocked: true,
        answerCount: state.answerCount + 1,
        scores: [...state.scores, action.isCorrect],
        seenWords:
          state.seenWords.some(w => w.wordId === action.wordId)
            ? state.seenWords
            : [...state.seenWords, state.wordQueue[state.currentIndex]],
        retestWordIds:
          !action.isCorrect && !state.retestWordIds.includes(action.wordId)
            ? [...state.retestWordIds, action.wordId]
            : state.retestWordIds,
      }

    case 'SET_SPELLING_INPUT':
      return { ...state, spellingInput: action.input }

    case 'RECORD_ANSWER':
      return {
        ...state,
        answers: [...state.answers, action.response],
      }

    case 'NEXT_QUESTION':
      return {
        ...state,
        currentIndex: state.currentIndex + 1,
        selectedChoice: null,
        answerLocked: false,
        spellingInput: '',
      }

    case 'TRANSITION_TO_NEW_WORDS':
      return {
        ...state,
        phase: 'new_words',
        wordQueue: [],
        currentIndex: 0,
        scores: [],
        selectedChoice: null,
        answerLocked: false,
        spellingInput: '',
      }

    case 'TRANSITION_TO_FINAL_TEST':
      return {
        ...state,
        phase: 'final_test',
        wordQueue: [...state.seenWords],
        currentIndex: 0,
        scores: [],
        retestWordIds: [],
        selectedChoice: null,
        answerLocked: false,
        spellingInput: '',
      }

    case 'RETEST_WORDS':
      return {
        ...state,
        wordQueue: action.words,
        currentIndex: 0,
        scores: [],
        retestWordIds: [],
        selectedChoice: null,
        answerLocked: false,
        spellingInput: '',
      }

    case 'COMPLETE_SESSION':
      return {
        ...state,
        phase: 'complete',
        sessionResult: action.result,
        loading: false,
      }

    case 'RESET':
      return { ...initialState }

    default:
      return state
  }
}

// ── Component ──────────────────────────────────────
export default function LearnPage() {
  const navigate = useNavigate()
  const timer = useTimer()
  const settingsCtx = useContext(SettingsContext)
  const settings = settingsCtx?.settings ?? defaultSettings
  const newWordsFetchedRef = useRef(false)

  const [state, dispatch] = useReducer(learnReducer, initialState)

  // Atomics
  const currentWord = state.wordQueue[state.currentIndex] ?? null
  const isLastQuestion = state.currentIndex >= state.wordQueue.length - 1
  const progressPct =
    state.wordQueue.length > 0
      ? ((state.currentIndex + 1) / state.wordQueue.length) * 100
      : 0

  // Current choices (memoized per word)
  const currentChoices = useMemo<{ text: string; correct: boolean }[]>(() => {
    if (!currentWord || state.wordQueue.length === 0) return []
    return generateChoices(currentWord, state.wordQueue, 4)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentWord?.wordId])

  // Reset timer on question change
  const questionKey =
    state.phase === 'review' || state.phase === 'new_words' || state.phase === 'final_test'
      ? `${state.phase}-${state.currentIndex}-${currentWord?.wordId ?? ''}`
      : null

  useEffect(() => {
    if (questionKey && !state.isPreviewPhase) {
      timer.reset()
      const at = determineAnswerType(state.answerCount, settings.spellingMode)
      dispatch({ type: 'SET_ANSWER_TYPE', answerType: at })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questionKey])

  // ── Effect: Resume unfinished session on mount ──
  const resumeRef = useRef(false)
  useEffect(() => {
    if (resumeRef.current) return
    resumeRef.current = true

    const resume = async () => {
      try {
        const today = await api.get<TodayTask>('/learn/today')
        if (!today.unfinishedSession) return
        dispatch({ type: 'SET_LOADING', loading: true })

        const { id: sessionId } = today.unfinishedSession
        dispatch({ type: 'START_SESSION', sessionId, round: 0 })

        const reviewRes = await api.get<ReviewQueueResponse>('/learn/review-queue', { sessionId })
        if (reviewRes.words.length === 0) {
          newWordsFetchedRef.current = false
          dispatch({ type: 'TRANSITION_TO_NEW_WORDS' })
        } else {
          dispatch({ type: 'LOAD_REVIEW_WORDS', words: reviewRes.words })
        }
      } catch {
      } finally {
        dispatch({ type: 'SET_LOADING', loading: false })
      }
    }
    resume()
  }, [])

  // ── Effect: Fetch new words when entering phase ──
  useEffect(() => {
    if (state.phase === 'new_words' && state.wordQueue.length === 0 && !newWordsFetchedRef.current) {
      newWordsFetchedRef.current = true
      fetchNewWords()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase])

  // ── Handlers ─────────────────────────────────────

  const handleStartSession = useCallback(async () => {
    if (!state.wordMode) return
    dispatch({ type: 'SET_LOADING', loading: true })
    dispatch({ type: 'CLEAR_ERROR' })
    try {
      const startRes = await api.post<StartSessionResponse>('/learn/start', {
        newWordMode: state.wordMode,
      })
      dispatch({ type: 'START_SESSION', sessionId: startRes.sessionId, round: startRes.round })

      const reviewRes = await api.get<ReviewQueueResponse>('/learn/review-queue', {
        sessionId: startRes.sessionId,
      })

      if (reviewRes.words.length === 0) {
        // No review words due—skip to new words phase
        newWordsFetchedRef.current = false
        dispatch({ type: 'TRANSITION_TO_NEW_WORDS' })
      } else {
        dispatch({ type: 'LOAD_REVIEW_WORDS', words: reviewRes.words })
      }
      dispatch({ type: 'SET_LOADING', loading: false })
    } catch (e) {
      const err = e as ApiError
      dispatch({ type: 'SET_ERROR', error: err.message || '启动学习失败' })
    }
  }, [state.wordMode])

  const fetchNewWords = useCallback(async () => {
    if (!state.sessionId) return
    dispatch({ type: 'SET_LOADING', loading: true })
    dispatch({ type: 'CLEAR_ERROR' })
    try {
      const res = await api.get<NewWordsResponse>('/learn/new-words', {
        sessionId: state.sessionId,
      })
      const words = mapNewWords(res.words)
      dispatch({ type: 'LOAD_NEW_WORDS', words, hasPreviewed: res.hasPreviewed })
      dispatch({ type: 'SET_LOADING', loading: false })
    } catch (e) {
      const err = e as ApiError
      dispatch({ type: 'SET_ERROR', error: err.message || '获取新词失败' })
    }
  }, [state.sessionId])

  const handlePreviewDone = useCallback(() => {
    dispatch({ type: 'PREVIEW_DONE' })
  }, [])

  // ── Choice answer ──
  const handleChoiceSelect = useCallback(
    async (index: number) => {
      if (state.answerLocked || !currentWord) return
      const isCorrect = currentChoices[index]?.correct ?? false
      const responseTimeMs = timer.getElapsed()

      // Optimistic visual + state update
      dispatch({
        type: 'SELECT_CHOICE',
        index,
        isCorrect,
        wordId: currentWord.wordId,
      })

      // Fire API call (fire-and-forget with error logging)
      try {
        const res = await api.post<AnswerResponse>('/learn/answer', {
          sessionId: state.sessionId,
          wordId: currentWord.wordId,
          correct: isCorrect,
          responseTimeMs,
          answerType: state.answerType,
        })
        dispatch({ type: 'RECORD_ANSWER', response: res })
      } catch {
        // Answer is already recorded optimistically; log but don't block UX
        console.warn('Failed to submit answer to server')
      }
    },
    [state.answerLocked, state.answerType, currentWord, currentChoices, state.sessionId, timer]
  )

  // ── Spelling answer ──
  const handleSpellingSubmit = useCallback(async () => {
    if (state.answerLocked || !currentWord) return
    const userAnswer = state.spellingInput.trim()
    const isCorrect = userAnswer === currentWord.word // case-sensitive
    const responseTimeMs = timer.getElapsed()

    dispatch({
      type: 'SELECT_CHOICE',
      index: -1, // no choice index for spelling
      isCorrect,
      wordId: currentWord.wordId,
    })

    try {
      const res = await api.post<AnswerResponse>('/learn/answer', {
        sessionId: state.sessionId,
        wordId: currentWord.wordId,
        correct: isCorrect,
        responseTimeMs,
        answerType: 'spelling',
      })
      dispatch({ type: 'RECORD_ANSWER', response: res })
    } catch {
      console.warn('Failed to submit answer to server')
    }
  }, [state.answerLocked, currentWord, state.spellingInput, state.sessionId, timer])

  // ── Complete session ──
  const handleCompleteSession = useCallback(async () => {
    if (!state.sessionId) return
    dispatch({ type: 'SET_LOADING', loading: true })
    dispatch({ type: 'CLEAR_ERROR' })
    try {
      const res = await api.post<CompleteSessionResponse>('/learn/complete', {
        sessionId: state.sessionId,
      })
      dispatch({ type: 'COMPLETE_SESSION', result: res })
    } catch (e) {
      const err = e as ApiError
      dispatch({ type: 'SET_ERROR', error: err.message || '提交结果失败' })
    }
  }, [state.sessionId])

  // ── Next question / phase transition ──
  const handleNext = useCallback(() => {
    if (!state.answerLocked) return

    if (state.phase === 'review') {
      if (!isLastQuestion) {
        dispatch({ type: 'NEXT_QUESTION' })
      } else {
        newWordsFetchedRef.current = false
        dispatch({ type: 'TRANSITION_TO_NEW_WORDS' })
      }
      return
    }

    if (state.phase === 'new_words') {
      if (!isLastQuestion) {
        dispatch({ type: 'NEXT_QUESTION' })
      } else {
        dispatch({ type: 'TRANSITION_TO_FINAL_TEST' })
      }
      return
    }

    if (state.phase === 'final_test') {
      if (!isLastQuestion) {
        dispatch({ type: 'NEXT_QUESTION' })
      } else {
        // Check current batch for wrong answers
        const wrongInBatch = state.scores
          .map((correct, i) => ({ correct, wordId: state.wordQueue[i]?.wordId }))
          .filter(x => !x.correct)

        if (wrongInBatch.length > 0) {
          // Retest wrong words
          const wrongIds = wrongInBatch.map(x => x.wordId)
          const retestWords = state.wordQueue.filter(w => wrongIds.includes(w.wordId))
          dispatch({ type: 'RETEST_WORDS', words: retestWords })
        } else {
          // All correct → complete session
          handleCompleteSession()
        }
      }
    }
  }, [state.phase, state.answerLocked, isLastQuestion, state.scores, state.wordQueue, handleCompleteSession])

  // ── Spelling input ──
  const handleSpellingChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch({ type: 'SET_SPELLING_INPUT', input: e.target.value })
  }, [])

  const handleSpellingKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && state.spellingInput.trim() && !state.answerLocked) {
        handleSpellingSubmit()
      }
    },
    [handleSpellingSubmit, state.spellingInput, state.answerLocked]
  )

  // ── Reset refs on unmount ──
  useEffect(() => {
    return () => {
      newWordsFetchedRef.current = false
    }
  }, [])

  // ── RENDER BY PHASE ──────────────────────────────

  // Phase 0: Mode Selection
  if (state.phase === 'mode_select') {
    return (
      <ModeSelection
        wordMode={state.wordMode}
        loading={state.loading}
        error={state.error}
        onSelect={mode => dispatch({ type: 'SELECT_MODE', mode })}
        onStart={handleStartSession}
      />
    )
  }

  // Phase 4: Complete
  if (state.phase === 'complete') {
    return (
      <SessionComplete
        result={state.sessionResult}
        scores={state.scores}
        onGoHome={() => navigate('/dashboard')}
      />
    )
  }

  // Loading state
  if (state.loading) {
    return (
      <div className="max-w-lg mx-auto space-y-6">
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
          <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
          <p className="text-sm text-gray-400">加载中...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (state.error) {
    return (
      <div className="max-w-lg mx-auto space-y-4">
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center">
          <p className="text-red-600 font-medium mb-2">😥 {state.error}</p>
          <button
            onClick={() => navigate('/dashboard')}
            className="px-6 py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium rounded-xl transition-colors text-sm"
          >
            返回首页
          </button>
        </div>
      </div>
    )
  }

  // Preview phase (new words preview)
  if (state.isPreviewPhase) {
    return (
      <div className="max-w-lg mx-auto space-y-5">
        <header className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg">📖</span>
              <span className="text-sm font-semibold text-gray-700">新词预览</span>
            </div>
            <span className="text-xs text-gray-400">
              {state.wordQueue.length} 个新词
            </span>
          </div>
        </header>

        <section className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-gray-100">
          <p className="text-sm text-gray-400 mb-4 text-center">
            以下是你即将学习的新词，先快速浏览一遍吧
          </p>
          <div className="divide-y divide-gray-100 max-h-[420px] overflow-y-auto">
            {state.wordQueue.map((w, i) => (
              <div key={w.wordId} className="flex items-center gap-4 py-3">
                <span className="w-6 h-6 rounded-full bg-violet-100 text-violet-600 text-xs font-bold flex items-center justify-center shrink-0">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-800">{w.word}</p>
                  {w.phonetic && (
                    <p className="text-xs text-gray-400 font-mono">{w.phonetic}</p>
                  )}
                </div>
                <p className="text-sm text-gray-600 shrink-0">{w.chinese}</p>
              </div>
            ))}
          </div>
        </section>

        <button
          onClick={handlePreviewDone}
          className="w-full py-3.5 bg-violet-600 hover:bg-violet-700 text-white font-semibold rounded-xl transition-all shadow-sm text-base active:scale-[0.99]"
        >
          📝 开始答题
        </button>
      </div>
    )
  }

  // ── Quiz phases (review / new_words / final_test) ──
  const phaseColors = {
    review: { bar: 'bg-blue-500', dotRing: 'ring-blue-400', dotBg: 'bg-blue-500' },
    new_words: { bar: 'bg-violet-500', dotRing: 'ring-violet-400', dotBg: 'bg-violet-500' },
    final_test: { bar: 'bg-amber-500', dotRing: 'ring-amber-400', dotBg: 'bg-amber-500' },
  } as const

  const colors = phaseColors[state.phase]
  const phaseLabel =
    state.phase === 'review' ? '复习' : state.phase === 'new_words' ? '新词' : '总测'
  const phaseEmoji =
    state.phase === 'review' ? '🔄' : state.phase === 'new_words' ? '📖' : '🎯'

  return (
    <div className="max-w-lg mx-auto space-y-5">
      {/* ── Header — Progress + Phase Dots ── */}
      <header className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">{phaseEmoji}</span>
            <span className="text-sm font-semibold text-gray-700">{phaseLabel}</span>
          </div>
          <div className="flex items-center gap-3 text-xs text-gray-400">
            <span>
              {state.currentIndex + 1}/{state.wordQueue.length}
            </span>
            {state.answerType === 'spelling' && (
              <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-[10px] font-medium">
                拼写
              </span>
            )}
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-gray-100 rounded-full h-2.5">
          <div
            className={`h-2.5 rounded-full transition-all duration-500 ${colors.bar}`}
            style={{ width: `${progressPct}%` }}
          />
        </div>

        {/* Phase dot indicators */}
        <div className="flex items-center justify-center gap-1.5 pt-1">
          {PHASE_ORDER.map((p, i) => {
            const currentPhaseIdx = PHASE_ORDER.indexOf(state.phase as (typeof PHASE_ORDER)[number])
            const pIdx = PHASE_ORDER.indexOf(p)
            const status: 'completed' | 'active' | 'future' =
              pIdx < currentPhaseIdx
                ? 'completed'
                : pIdx === currentPhaseIdx
                  ? 'active'
                  : 'future'

            return (
              <div key={p} className="flex items-center gap-1.5">
                <div
                  className={`w-2.5 h-2.5 rounded-full transition-all ${
                    status === 'completed'
                      ? 'bg-emerald-400 ring-2 ring-emerald-300'
                      : status === 'active'
                        ? `ring-2 ring-offset-1 ${p === 'review' ? 'ring-blue-400 bg-blue-500' : p === 'new_words' ? 'ring-violet-400 bg-violet-500' : 'ring-amber-400 bg-amber-500'}`
                        : 'bg-gray-200'
                  }`}
                />
                {i < PHASE_ORDER.length - 1 && (
                  <div
                    className={`w-6 h-0.5 transition-colors ${
                      pIdx < currentPhaseIdx ? 'bg-emerald-300' : 'bg-gray-200'
                    }`}
                  />
                )}
              </div>
            )
          })}
        </div>
      </header>

      {/* ── Quiz Card ── */}
      {currentWord && (
        <section className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-gray-100">
          {/* Prompt */}
          <p className="text-sm text-gray-400 mb-3 text-center">
            {state.answerType === 'spelling'
              ? '请输入英文单词（大小写敏感）'
              : '请选择正确的中文释义'}
          </p>

          {/* Word display */}
          <div className="text-center mb-6">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-1 tracking-tight">
              {currentWord.word}
            </h2>
            {currentWord.phonetic && (
              <p className="text-sm text-gray-400 font-mono">{currentWord.phonetic}</p>
            )}
            {currentWord.pos && (
              <p className="text-xs text-gray-400 mt-0.5">{currentWord.pos}</p>
            )}
          </div>

          {/* ── Choice Mode ── */}
          {state.answerType === 'choice' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {currentChoices.map((choice, idx) => {
                let btnClass =
                  'w-full py-3 px-4 rounded-xl border-2 text-sm font-medium transition-all select-none'

                if (!state.answerLocked) {
                  btnClass +=
                    ' border-gray-200 bg-white text-gray-700 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 cursor-pointer active:scale-[0.98]'
                } else if (choice.correct) {
                  btnClass += ' border-emerald-500 bg-emerald-50 text-emerald-700'
                } else if (state.selectedChoice === idx) {
                  btnClass += ' border-red-400 bg-red-50 text-red-600'
                } else {
                  btnClass += ' border-gray-100 bg-gray-50 text-gray-400'
                }

                return (
                  <button
                    key={idx}
                    onClick={() => handleChoiceSelect(idx)}
                    disabled={state.answerLocked}
                    className={btnClass}
                  >
                    {choice.text}
                  </button>
                )
              })}
            </div>
          )}

          {/* ── Spelling Mode ── */}
          {state.answerType === 'spelling' && (
            <div className="space-y-4">
              <div className="text-center">
                <p className="text-lg font-medium text-gray-700 mb-1">{currentWord.chinese}</p>
                {settings.firstLetterHint && currentWord.phonetic && (
                  <p className="text-sm text-gray-400 font-mono mb-1">{currentWord.phonetic}</p>
                )}
                {settings.firstLetterHint && (
                  <p className="text-sm text-gray-400">
                    首字母：{currentWord.word[0]}
                    {'_ '.repeat(Math.max(0, currentWord.word.length - 1))}
                  </p>
                )}
              </div>

              <input
                type="text"
                value={state.spellingInput}
                onChange={handleSpellingChange}
                onKeyDown={handleSpellingKeyDown}
                disabled={state.answerLocked}
                placeholder="输入英文单词"
                autoFocus
                className={`w-full px-4 py-3 text-lg text-center border-2 rounded-xl transition-all outline-none ${
                  state.answerLocked
                    ? 'bg-gray-50 border-gray-200 text-gray-500'
                    : 'bg-white border-gray-200 text-gray-900 focus:border-blue-300 focus:ring-2 focus:ring-blue-500/20'
                }`}
              />

              <button
                onClick={handleSpellingSubmit}
                disabled={!state.spellingInput.trim() || state.answerLocked}
                className={`w-full py-3 font-semibold rounded-xl transition-all text-base ${
                  state.spellingInput.trim() && !state.answerLocked
                    ? 'bg-blue-600 hover:bg-blue-700 text-white active:scale-[0.99]'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
              >
                确认
              </button>

              {state.answerLocked && (
                <div className="text-center">
                  <p className="text-sm text-gray-400">
                    正确答案：<span className="font-mono font-bold text-gray-700">{currentWord.word}</span>
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ── Feedback ── */}
          {state.answerLocked && state.answerType === 'choice' && (
            <div
              className={`mt-4 text-sm font-medium text-center ${
                currentChoices[state.selectedChoice ?? -1]?.correct
                  ? 'text-emerald-600'
                  : 'text-red-500'
              }`}
            >
              {currentChoices[state.selectedChoice ?? -1]?.correct ? (
                '✅ 回答正确！'
              ) : (
                <>
                  ❌ 正确答案：{currentChoices.find(c => c.correct)?.text ?? '未知'}
                </>
              )}
            </div>
          )}

          {state.answerLocked && state.answerType === 'spelling' && (
            <div
              className={`mt-4 text-sm font-medium text-center ${
                state.scores[state.scores.length - 1] ? 'text-emerald-600' : 'text-red-500'
              }`}
            >
              {state.scores[state.scores.length - 1]
                ? '✅ 拼写正确！'
                : `❌ 拼写错误，正确答案：${currentWord.word}`}
            </div>
          )}
        </section>
      )}

      {/* ── Score record bar ── */}
      {state.scores.length > 0 && (
        <section className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-gray-400">本轮答题记录</p>
            <p className="text-xs text-gray-400">
              {state.scores.filter(Boolean).length}/{state.scores.length} 正确
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {state.scores.length === 0 ? (
              <span className="text-xs text-gray-300">还没有答题记录</span>
            ) : (
              state.scores.map((s, i) => (
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
      )}

      {/* ── Next / Transition button ── */}
      <button
        onClick={handleNext}
        disabled={!state.answerLocked}
        className={`w-full py-3.5 font-semibold rounded-xl transition-all shadow-sm text-base ${
          !state.answerLocked
            ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
            : isLastQuestion && state.phase === 'final_test'
              ? 'bg-emerald-600 hover:bg-emerald-700 text-white active:scale-[0.99]'
              : isLastQuestion
                ? 'bg-blue-600 hover:bg-blue-700 text-white active:scale-[0.99]'
                : 'bg-blue-600 hover:bg-blue-700 text-white active:scale-[0.99]'
        }`}
      >
        {!state.answerLocked
          ? state.answerType === 'spelling'
            ? '请输入单词后确认'
            : '请选择一个答案'
          : isLastQuestion && state.phase === 'final_test'
            ? '🏁 完成测试'
            : isLastQuestion
              ? '进入下一步 →'
              : '下一题'}
      </button>
    </div>
  )
}

// ══════════════════════════════════════════════════
//  ModeSelection  —  Phase 0
// ══════════════════════════════════════════════════
function ModeSelection({
  wordMode,
  loading,
  error,
  onSelect,
  onStart,
}: {
  wordMode: WordMode | null
  loading: boolean
  error: string | null
  onSelect: (m: WordMode) => void
  onStart: () => void
}) {
  return (
    <div className="max-w-lg mx-auto">
      <div className="text-center mb-6">
        <span className="text-4xl">🎯</span>
        <h2 className="text-xl font-bold text-gray-800 mt-2">准备开始新一轮学习</h2>
        <p className="text-sm text-gray-400 mt-1">
          请选择本轮新词学习顺序（一轮内不可更改）
        </p>
      </div>

      <div className="space-y-3">
        {/* Random mode */}
        <button
          onClick={() => onSelect('random')}
          className={`w-full text-left p-5 rounded-2xl border-2 transition-all ${
            wordMode === 'random'
              ? 'border-blue-500 bg-blue-50 shadow-md'
              : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
          }`}
        >
          <div className="flex items-start gap-3">
            <div
              className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                wordMode === 'random' ? 'border-blue-500' : 'border-gray-300'
              }`}
            >
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

        {/* Alpha mode */}
        <button
          onClick={() => onSelect('alpha')}
          className={`w-full text-left p-5 rounded-2xl border-2 transition-all ${
            wordMode === 'alpha'
              ? 'border-violet-500 bg-violet-50 shadow-md'
              : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
          }`}
        >
          <div className="flex items-start gap-3">
            <div
              className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                wordMode === 'alpha' ? 'border-violet-500' : 'border-gray-300'
              }`}
            >
              {wordMode === 'alpha' && <div className="w-3 h-3 rounded-full bg-violet-500" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="font-semibold text-gray-800">按首字母乱序</p>
                <span className="text-xs bg-violet-100 text-violet-600 px-2 py-0.5 rounded-full font-medium">
                  推荐
                </span>
              </div>
              <p className="text-sm text-gray-400 mt-0.5">
                从 A→Z 分组推进，组内随机打乱，有章节感，适合系统化学习
              </p>
            </div>
          </div>
        </button>
      </div>

      {error && (
        <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 text-center">
          {error}
        </div>
      )}

      <div className="mt-6 space-y-3">
        <button
          onClick={onStart}
          disabled={!wordMode || loading}
          className={`w-full py-3.5 font-semibold rounded-xl transition-all shadow-sm text-base ${
            wordMode && !loading
              ? 'bg-blue-600 hover:bg-blue-700 text-white active:scale-[0.99]'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }`}
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              启动中...
            </span>
          ) : wordMode ? (
            '🚀 开始学习'
          ) : (
            '请先选择学习模式'
          )}
        </button>
        <p className="text-xs text-gray-400 text-center">
          💡 本轮内不可更改，下一轮可重新选择
        </p>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════
//  SessionComplete  —  Phase 4
// ══════════════════════════════════════════════════
function SessionComplete({
  result,
  scores,
  onGoHome,
}: {
  result: CompleteSessionResponse | null
  scores: boolean[]
  onGoHome: () => void
}) {
  const correctCount = scores.filter(Boolean).length
  const totalCount = scores.length

  // Use API result if available, else fallback to local scores
  const pct =
    result?.correctRate !== undefined
      ? Math.round(result.correctRate)
      : totalCount > 0
        ? Math.round((correctCount / totalCount) * 100)
        : 0

  const displayCorrect = result?.totalPassed ?? correctCount
  const displayTotal = result?.totalReviewed ?? totalCount
  const displayFailed = result?.totalFailed ?? totalCount - correctCount
  const roundCompleted = result?.roundCompleted ?? false
  const streakDays = result?.streakDays ?? 0

  const emoji = pct >= 90 ? '🎉' : pct >= 70 ? '👍' : '💪'
  const title = pct >= 90 ? '太棒了！' : pct >= 70 ? '做得不错！' : '继续加油！'

  // Ring chart dimensions
  const size = 120
  const radius = 52
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference * (1 - Math.min(pct / 100, 1))
  const ringColor =
    pct >= 90 ? '#10b981' : pct >= 70 ? '#f59e0b' : '#ef4444'

  return (
    <div className="max-w-lg mx-auto text-center space-y-6">
      {/* Emoji */}
      <div className="text-6xl mb-2">{emoji}</div>

      {/* Title */}
      <h2 className="text-2xl font-bold text-gray-800">{title}</h2>
      {roundCompleted && (
        <p className="text-sm text-emerald-600 font-medium -mt-3">
          🏆 本轮已通关！
        </p>
      )}

      {/* Ring chart + stats */}
      <section className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-4">
        {/* SVG Ring Chart */}
        <div className="flex justify-center">
          <div className="relative" style={{ width: size, height: size }}>
            <svg
              className="-rotate-90"
              width={size}
              height={size}
              viewBox="0 0 120 120"
            >
              {/* Background ring */}
              <circle
                cx="60"
                cy="60"
                r={radius}
                fill="none"
                stroke="#e5e7eb"
                strokeWidth="8"
              />
              {/* Foreground ring */}
              <circle
                cx="60"
                cy="60"
                r={radius}
                fill="none"
                stroke={ringColor}
                strokeWidth="8"
                strokeDasharray={`${circumference}`}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                className="transition-all duration-700 ease-out"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-2xl font-bold text-gray-800">{pct}%</span>
            </div>
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-emerald-50 rounded-xl p-3">
            <p className="text-lg font-bold text-emerald-600">{displayCorrect}</p>
            <p className="text-xs text-gray-400">正确</p>
          </div>
          <div className="bg-red-50 rounded-xl p-3">
            <p className="text-lg font-bold text-red-500">{displayFailed}</p>
            <p className="text-xs text-gray-400">错误</p>
          </div>
          <div className="bg-blue-50 rounded-xl p-3">
            <p className="text-lg font-bold text-blue-600">{displayTotal}</p>
            <p className="text-xs text-gray-400">总题数</p>
          </div>
        </div>

        {/* Round info */}
        {result?.roundInfo && (
          <div className="bg-gray-50 rounded-xl p-3 text-xs text-gray-500 space-y-1">
            <p>
              轮次 {result.roundInfo.completedRound} · 掌握{' '}
              <span className="font-semibold text-gray-700">
                {result.roundInfo.wordsMastered}
              </span>
              /{result.roundInfo.totalWords} 词
            </p>
            {result.roundInfo.avgProficiency > 0 && (
              <p>
                平均熟练度{' '}
                <span className="font-semibold text-gray-700">
                  {result.roundInfo.avgProficiency.toFixed(1)}
                </span>
              </p>
            )}
          </div>
        )}

        {/* Streak */}
        {streakDays > 0 && (
          <p className="text-xs text-amber-600">
            🔥 连续学习 {streakDays} 天
          </p>
        )}
      </section>

      {/* Return button */}
      <button
        onClick={onGoHome}
        className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-all shadow-sm text-base active:scale-[0.99]"
      >
        📊 返回首页
      </button>
    </div>
  )
}
