import { Router, Request, Response } from 'express'
import { getDb, getDueReviews, getNewWordsCount, getUserSettings, getActiveSession, createSession, getNewWords, getUserWord, ensureUserWord, updateUserWordAfterReview, insertReviewLog, getReviewHistory, getLearnedWordsInRound, getRoundStats, recordRoundCompletion, getWordById, getWordCount } from '../models/database.js'
import { requireAuth } from '../middleware/auth.js'
import { ok, validationError, notFound, forbidden, serverError } from '../utils/response.js'
import { calculateQuality, sm2Step } from '../algorithms/sm2.js'
import type { CardState } from '../algorithms/sm2.js'

const router = Router()

// ─── Types ──────────────────────────────────────────────

interface SessionRow {
  id: number
  user_id: number
  start_time: string
  end_time: string | null
  words_reviewed: number
  words_passed: number
  words_failed: number
  duration_seconds: number | null
  round: number
  status: string
}

interface CountResult {
  cnt: number
}

interface StartBody {
  newWordMode?: 'random' | 'alpha'
}

interface AnswerBody {
  sessionId: number
  wordId: number
  correct: boolean
  responseTimeMs: number
  answerType: 'choice' | 'spelling'
  selectedOption?: string
}

interface CompleteBody {
  sessionId: number
  abandoned?: boolean
}

// ─── SM-2 proficiency calculation ─────────────────────

function calcProficiency(state: CardState, quality: number): number {
  if (quality < 3) {
    return Math.max(0, Math.round(state.ef * 4))
  }
  return Math.min(100, Math.round(
    state.repetitions * 12 + (state.ef - 1.3) * 15
  ))
}

// ─── Helpers ──────────────────────────────────────────

function getCurrentRound(userId: number): number {
  const row = getDb().prepare(
    'SELECT COALESCE(MAX(round), 1) as round FROM user_words WHERE user_id = ?'
  ).get(userId) as { round: number }
  return row.round
}

function getDueReviewCount(userId: number, round: number): number {
  const row = getDb().prepare(`
    SELECT COUNT(*) as cnt FROM user_words
    WHERE user_id = ? AND round = ?
      AND next_review IS NOT NULL AND next_review <= datetime('now')
      AND proficiency < 100
  `).get(userId, round) as CountResult
  return row.cnt
}

function validateSessionOwnership(sessionId: number, userId: number): SessionRow | null {
  const session = getDb().prepare(
    'SELECT * FROM sessions WHERE id = ? AND user_id = ?'
  ).get(sessionId, userId) as SessionRow | undefined
  return session ?? null
}

// ─── 4.1 GET /today ─────────────────────────────────────

router.get('/today', requireAuth, (req: Request, res: Response) => {
  try {
    const userId = req.user!.id
    const currentRound = getCurrentRound(userId)
    const dueReviews = getDueReviews(userId, currentRound)
    const dueReviewCount = dueReviews.length
    const newWordsAvailable = getNewWordsCount(userId, currentRound)
    const settings = getUserSettings(userId)
    const newWordsPerSession = settings?.new_words_per_session ?? 15
    const newWordMode = settings?.new_word_mode ?? 'random'

    const todaySessionCount = (getDb().prepare(`
      SELECT COUNT(*) as cnt FROM sessions
      WHERE user_id = ? AND date(start_time) = date('now')
    `).get(userId) as CountResult).cnt
    const lastSessionToday = todaySessionCount > 0

    const activeSession = getActiveSession(userId) as SessionRow | null
    let unfinishedSession: { id: number; startedAt: string; reviewedCount: number; passedCount: number; failedCount: number } | null = null
    if (activeSession) {
      unfinishedSession = {
        id: activeSession.id,
        startedAt: activeSession.start_time,
        reviewedCount: activeSession.words_reviewed,
        passedCount: activeSession.words_passed,
        failedCount: activeSession.words_failed,
      }
    }

    const totalTestWords = dueReviewCount + newWordsPerSession
    const estimatedMinutes = Math.round(
      (dueReviewCount * 12 + newWordsPerSession * 30 + totalTestWords * 12 + 180) / 60
    )

    ok(res, {
      dueReviewCount,
      newWordsAvailable,
      newWordsPerSession,
      newWordMode,
      lastSessionToday,
      unfinishedSession,
      estimatedMinutes,
    })
  } catch (e) {
    serverError(res, (e as Error).message)
  }
})

// ─── 4.2 POST /start ────────────────────────────────────

router.post('/start', requireAuth, (req: Request, res: Response) => {
  try {
    const userId = req.user!.id
    const { newWordMode } = req.body as StartBody

    const currentRound = getCurrentRound(userId)

    const existingSessions = getDb().prepare(
      'SELECT COUNT(*) as cnt FROM sessions WHERE user_id = ? AND round = ?'
    ).get(userId, currentRound) as CountResult
    const isFirstInRound = existingSessions.cnt === 0

    if (isFirstInRound && !newWordMode) {
      return validationError(res, '本轮首次学习必须选择新词模式')
    }

    getDb().prepare(`
      UPDATE sessions SET status = 'abandoned', end_time = datetime('now')
      WHERE user_id = ? AND status = 'active'
    `).run(userId)

    const sessionId = createSession(userId, currentRound)
    const startedAt = new Date().toISOString()

    if (newWordMode) {
      getDb().prepare(
        'UPDATE user_settings SET new_word_mode = ? WHERE user_id = ?'
      ).run(newWordMode, userId)
    }

    const reviewCount = getDueReviewCount(userId, currentRound)

    const newWordsInRound = (getDb().prepare(`
      SELECT COUNT(*) as cnt FROM user_words WHERE user_id = ? AND round = ?
    `).get(userId, currentRound) as CountResult).cnt

    const newWordsTotal = getWordCount()

    ok(res, {
      sessionId,
      startedAt,
      round: currentRound,
      reviewCount,
      newWordsInRound,
      newWordsTotal,
    }, 201)
  } catch (e) {
    serverError(res, (e as Error).message)
  }
})

// ─── 4.3 GET /review-queue ──────────────────────────────

router.get('/review-queue', requireAuth, (req: Request, res: Response) => {
  try {
    const userId = req.user!.id
    const sessionId = Number(req.query.sessionId)
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200)

    if (!sessionId) {
      return validationError(res, '缺少 sessionId 参数')
    }

    const session = validateSessionOwnership(sessionId, userId)
    if (!session) {
      return notFound(res, '学习会话不存在')
    }

    const words = getDb().prepare(`
      SELECT
        w.id AS wordId,
        w.word,
        w.phonetic,
        w.pos,
        w.chinese,
        uw.proficiency,
        CASE WHEN uw.repetitions = 0 AND uw.total_attempts > 0 THEN 'retest' ELSE 'review' END AS reviewType,
        CASE WHEN uw.consecutive_correct = 0 AND uw.total_attempts > 0 THEN 1 ELSE 0 END AS isDifficult
      FROM user_words uw
      JOIN words w ON w.id = uw.word_id
      WHERE uw.user_id = ?
        AND uw.round = ?
        AND (uw.next_review <= datetime('now') OR (uw.repetitions = 0 AND uw.total_attempts > 0))
      ORDER BY
        isDifficult DESC,
        (julianday('now') - julianday(uw.next_review)) / NULLIF(uw.interval_days, 1) DESC,
        uw.proficiency ASC
      LIMIT ?
    `).all(userId, session.round, limit) as Array<{
      wordId: number; word: string; phonetic: string | null; pos: string | null; chinese: string
      proficiency: number; reviewType: string; isDifficult: number
    }>

    const total = (getDb().prepare(`
      SELECT COUNT(*) as cnt FROM user_words uw
      WHERE uw.user_id = ? AND uw.round = ?
        AND (uw.next_review <= datetime('now') OR (uw.repetitions = 0 AND uw.total_attempts > 0))
    `).get(userId, session.round) as CountResult).cnt

    ok(res, {
      words: words.map(w => ({
        wordId: w.wordId,
        word: w.word,
        phonetic: w.phonetic,
        pos: w.pos,
        chinese: w.chinese,
        proficiency: w.proficiency,
        reviewType: w.reviewType,
        isDifficult: w.isDifficult === 1,
      })),
      total,
    })
  } catch (e) {
    serverError(res, (e as Error).message)
  }
})

// ─── 4.4 GET /new-words ─────────────────────────────────

router.get('/new-words', requireAuth, (req: Request, res: Response) => {
  try {
    const userId = req.user!.id
    const sessionId = Number(req.query.sessionId)
    const settings = getUserSettings(userId)

    if (!sessionId) {
      return validationError(res, '缺少 sessionId 参数')
    }

    const session = validateSessionOwnership(sessionId, userId)
    if (!session) {
      return notFound(res, '学习会话不存在')
    }

    const count = Number(req.query.count) || settings?.new_words_per_session || 15
    const mode = (settings?.new_word_mode || 'random') as 'random' | 'alpha'
    const round = session.round

    const rawWords = getNewWords(userId, round, count, mode) as Array<{
      id: number; word: string; phonetic: string | null; pos: string | null; chinese: string
    }>

    const words = rawWords.map(w => ({
      wordId: w.id,
      word: w.word,
      phonetic: w.phonetic,
      pos: w.pos,
      chinese: w.chinese,
    }))

    const remainingNew = getNewWordsCount(userId, round)
    const hasPreviewed = session.words_reviewed > 0

    ok(res, {
      words,
      remainingNew,
      mode,
      hasPreviewed,
    })
  } catch (e) {
    serverError(res, (e as Error).message)
  }
})

// ─── 4.5 POST /answer ───────────────────────────────────

router.post('/answer', requireAuth, (req: Request, res: Response) => {
  try {
    const userId = req.user!.id
    const { sessionId, wordId, correct, responseTimeMs, answerType } = req.body as AnswerBody

    if (!sessionId || !wordId || responseTimeMs === undefined || answerType === undefined) {
      return validationError(res, '缺少必填参数')
    }

    const session = validateSessionOwnership(sessionId, userId)
    if (!session) {
      return notFound(res, '学习会话不存在')
    }
    if (session.status !== 'active') {
      return validationError(res, '该学习会话已结束')
    }

    const word = getWordById(wordId)
    if (!word) {
      return notFound(res, '单词不存在')
    }

    const round = session.round

    const tx = getDb().transaction(() => {
      const userWord = ensureUserWord(userId, wordId, round)
      if (!userWord) {
        throw new Error('创建用户词汇记录失败')
      }
      const isNewLearned = !userWord.total_attempts || userWord.total_attempts === 0

      const currentState: CardState = {
        ef: userWord.ef,
        interval: userWord.interval_days,
        repetitions: userWord.repetitions,
      }

      const quality = calculateQuality(correct, responseTimeMs)

      let newState: CardState
      if (isNewLearned && correct) {
        newState = sm2Step({ ef: 2.5, interval: 0, repetitions: 0 }, quality)
      } else {
        newState = sm2Step(currentState, quality)
      }

      const nextReviewDate = new Date(Date.now() + newState.interval * 86400000)
      const nextReview = nextReviewDate.toISOString().split('T')[0]

      const proficiency = calcProficiency(newState, quality)

      updateUserWordAfterReview(
        userId, wordId,
        newState.ef, newState.interval, newState.repetitions,
        proficiency, nextReview,
        correct, responseTimeMs, round
      )

      insertReviewLog(
        userId, wordId, sessionId,
        correct ? 1 : 0, responseTimeMs, quality,
        answerType === 'spelling' ? 'spelling' : 'choice'
      )

      getDb().prepare(`
        UPDATE sessions SET
          words_reviewed = words_reviewed + 1,
          words_passed = words_passed + ?,
          words_failed = words_failed + ?
        WHERE id = ?
      `).run(correct ? 1 : 0, correct ? 0 : 1, sessionId)

      return { isNewLearned, quality, newState, proficiency, nextReview }
    })

    const result = tx()

    const updatedSession = getDb().prepare(
      'SELECT words_reviewed, words_passed, words_failed FROM sessions WHERE id = ?'
    ).get(sessionId) as { words_reviewed: number; words_passed: number; words_failed: number }

    const totalStageWords = (getDb().prepare(`
      SELECT COUNT(*) as cnt FROM user_words uw
      WHERE uw.user_id = ? AND uw.round = ?
        AND (uw.next_review <= datetime('now') OR (uw.repetitions = 0 AND uw.total_attempts > 0))
    `).get(userId, session.round) as { cnt: number }).cnt

    const sessionProgress = {
      reviewed: updatedSession.words_reviewed,
      total: totalStageWords,
      passed: updatedSession.words_passed,
      failed: updatedSession.words_failed,
    }

    ok(res, {
      wordId,
      isCorrect: correct,
      quality: result.quality,
      ef: result.newState.ef,
      intervalDays: result.newState.interval,
      proficiency: result.proficiency,
      nextReview: result.nextReview,
      isNewLearned: result.isNewLearned,
      sessionProgress,
    })
  } catch (e) {
    serverError(res, (e as Error).message)
  }
})

// ─── 4.6 POST /complete ────────────────────────────────

router.post('/complete', requireAuth, (req: Request, res: Response) => {
  try {
    const userId = req.user!.id
    const { sessionId, abandoned } = req.body as CompleteBody

    if (!sessionId) {
      return validationError(res, '缺少 sessionId 参数')
    }

    const session = validateSessionOwnership(sessionId, userId)
    if (!session) {
      return notFound(res, '学习会话不存在')
    }
    if (session.status !== 'active') {
      return validationError(res, '该学习会话已结束')
    }

    const isAbandoned = abandoned === true

    const startTime = new Date(session.start_time).getTime()
    const durationSeconds = Math.round((Date.now() - startTime) / 1000)

    const tx = getDb().transaction(() => {
      const status = isAbandoned ? 'abandoned' : 'completed'
      getDb().prepare(`
        UPDATE sessions SET
          end_time = datetime('now'),
          duration_seconds = ?,
          status = ?
        WHERE id = ?
      `).run(durationSeconds, status, sessionId)

      if (isAbandoned) {
        return { roundCompleted: false }
      }

      const currentRound = session.round
      const totalWords = getWordCount()

      const statsRow = getDb().prepare(`
        SELECT
          COUNT(*) as total_words,
          SUM(CASE WHEN proficiency >= 90 THEN 1 ELSE 0 END) as mastered_words
        FROM user_words WHERE user_id = ? AND round = ?
      `).get(userId, currentRound) as { total_words: number; mastered_words: number }

      const masteredCount = statsRow.mastered_words || 0
      const roundCompleted = totalWords > 0 && masteredCount >= totalWords * 0.9

      if (roundCompleted) {
        const avgProfRow = getDb().prepare(`
          SELECT ROUND(AVG(proficiency), 1) as avg_prof
          FROM user_words WHERE user_id = ? AND round = ?
        `).get(userId, currentRound) as { avg_prof: number | null }

        const avgProficiency = avgProfRow.avg_prof ?? 0
        recordRoundCompletion(userId, currentRound, masteredCount, totalWords, avgProficiency)

        getDb().prepare(`
          UPDATE user_words SET
            round = round + 1,
            interval_days = 0,
            repetitions = 0,
            proficiency = 0,
            next_review = datetime('now')
          WHERE user_id = ? AND round = ?
        `).run(userId, currentRound)

        return {
          roundCompleted: true,
          roundInfo: {
            completedRound: currentRound,
            wordsMastered: masteredCount,
            totalWords,
            avgProficiency,
          },
        }
      }

      return { roundCompleted: false }
    })

    const result = tx()

    const closedSession = getDb().prepare(
      'SELECT * FROM sessions WHERE id = ?'
    ).get(sessionId) as SessionRow

    const totalReviewed = closedSession.words_reviewed
    const totalPassed = closedSession.words_passed
    const totalFailed = closedSession.words_failed
    const correctRate = totalReviewed > 0
      ? Math.round((totalPassed / totalReviewed) * 1000) / 10
      : 0

    const avgQualityRow = getDb().prepare(`
      SELECT COALESCE(AVG(quality), 0) as avg_quality
      FROM review_logs WHERE session_id = ?
    `).get(sessionId) as { avg_quality: number }
    const proficiencyChange = Math.round(avgQualityRow.avg_quality * 10) / 10

    const streakRow = getDb().prepare(`
      WITH daily AS (
        SELECT DISTINCT date(created_at) AS d
        FROM review_logs WHERE user_id = ?
      )
      SELECT COUNT(*) AS streak FROM daily
      WHERE d >= (
        SELECT COALESCE(MAX(d2.d), date('now')) FROM daily d2
        WHERE d2.d < date('now')
          AND NOT EXISTS (SELECT 1 FROM daily d3 WHERE d3.d = date(d2.d, '+1 day'))
      )
        AND d <= date('now')
    `).get(userId) as { streak: number }
    const streakDays = streakRow?.streak ?? 0

    const response: Record<string, unknown> = {
      sessionId,
      durationSeconds,
      totalReviewed,
      totalPassed,
      totalFailed,
      correctRate,
      proficiencyChange,
      roundCompleted: result.roundCompleted,
      streakDays,
    }

    if (result.roundCompleted && 'roundInfo' in result) {
      response.roundInfo = (result as { roundCompleted: true; roundInfo: unknown }).roundInfo
    }

    ok(res, response)
  } catch (e) {
    serverError(res, (e as Error).message)
  }
})

// ─── 4.7 GET /distractors ───────────────────────────────

router.get('/distractors', requireAuth, (req: Request, res: Response) => {
  try {
    const excludeRaw = (req.query.exclude as string) || ''
    const excludeIds = excludeRaw.split(',').map(Number).filter(n => n > 0)
    const count = Math.min(Math.max(Number(req.query.count) || 3, 1), 10)

    let sql = 'SELECT chinese FROM words'
    const params: unknown[] = []
    if (excludeIds.length > 0) {
      sql += ' WHERE id NOT IN (' + excludeIds.map(() => '?').join(',') + ')'
      params.push(...excludeIds)
    }
    sql += ' ORDER BY RANDOM() LIMIT ?'
    params.push(count)

    const rows = getDb().prepare(sql).all(...params) as { chinese: string }[]
    ok(res, { distractors: rows.map(r => r.chinese) })
  } catch (e) {
    serverError(res, (e as Error).message)
  }
})

export default router
