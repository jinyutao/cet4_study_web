import { Router, Request, Response } from 'express'
import { getDb, getWordCount, getRoundStats, getRoundCompletions, getUserSettings } from '../models/database.js'
import { requireAuth } from '../middleware/auth.js'
import { ok, serverError } from '../utils/response.js'

const router = Router()

// ─── Types ──────────────────────────────────────────────

interface CountResult {
  cnt: number
}

interface OverviewData {
  currentRound: number
  roundProgress: number
  totalWords: number
  wordsLearned: number
  wordsMastered: number
  targetProficiency: number
  progressPercent: number
  daysInRound: number
  totalSessions: number
  totalReviews: number
  avgCorrectRate: number
  streakDays: number
  longestStreak: number
}

interface DistributionLevel {
  level: string
  label: string
  range: string
  count: number
  percent: number
}

interface DistributionData {
  distribution: DistributionLevel[]
  roundMaxProficiency: number
  roundMinProficiency: number
  avgProficiency: number
}

interface HeatmapDay {
  date: string
  count: number
  duration: number
}

interface RoundInfo {
  round: number
  status: 'completed' | 'active' | 'locked'
  totalWords: number
  masteredCount: number
  progressPercent: number
  completedAt: string | null
  sessionsCount: number
  avgCorrectRate: number
  avgProficiency: number
  startDate: string
}

interface RoundsData {
  rounds: RoundInfo[]
  currentRound: number
}

// ─── Helpers ──────────────────────────────────────────

function getCurrentRound(userId: number): number {
  const row = getDb().prepare(
    'SELECT COALESCE(MAX(round), 1) as round FROM user_words WHERE user_id = ?'
  ).get(userId) as { round: number }
  return row.round
}

// ─── 5.1 GET /overview ──────────────────────────────────

router.get('/overview', requireAuth, (req: Request, res: Response) => {
  try {
    const userId = req.user!.id
    const currentRound = getCurrentRound(userId)
    const totalWords = getWordCount()

    const wordsLearned = (getDb().prepare(`
      SELECT COUNT(*) as cnt FROM user_words
      WHERE user_id = ? AND round = ? AND total_attempts > 0
    `).get(userId, currentRound) as CountResult).cnt

    const wordsMastered = (getDb().prepare(`
      SELECT COUNT(*) as cnt FROM user_words
      WHERE user_id = ? AND round = ? AND proficiency >= 90
    `).get(userId, currentRound) as CountResult).cnt

    const progressPercent = totalWords > 0
      ? Math.round((wordsMastered / totalWords) * 1000) / 10
      : 0

    const daysInRoundRow = getDb().prepare(`
      SELECT COALESCE(ROUND(julianday('now') - julianday(MIN(first_learned_at))), 0) as days
      FROM user_words WHERE user_id = ? AND round = ?
    `).get(userId, currentRound) as { days: number }
    const daysInRound = Math.round(daysInRoundRow.days)

    const totalSessions = (getDb().prepare(`
      SELECT COUNT(*) as cnt FROM sessions
      WHERE user_id = ? AND round = ? AND status = 'completed'
    `).get(userId, currentRound) as CountResult).cnt

    const totalReviews = (getDb().prepare(`
      SELECT COALESCE(SUM(total_attempts), 0) as cnt FROM user_words
      WHERE user_id = ? AND round = ?
    `).get(userId, currentRound) as CountResult).cnt

    const avgCorrectRow = getDb().prepare(`
      SELECT ROUND(AVG(CASE WHEN correct = 1 THEN 100.0 ELSE 0 END), 1) as rate
      FROM review_logs
      WHERE user_id = ? AND session_id IN (
        SELECT id FROM sessions WHERE round = ?
      )
    `).get(userId, currentRound) as { rate: number | null }
    const avgCorrectRate = avgCorrectRow.rate ?? 0

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

    const longestRow = getDb().prepare(`
      WITH daily AS (
        SELECT DISTINCT date(created_at) AS d
        FROM review_logs WHERE user_id = ?
      ),
      groups AS (
        SELECT d, date(d, '-' || (ROW_NUMBER() OVER (ORDER BY d)) || ' days') AS grp
        FROM daily
      )
      SELECT COALESCE(MAX(cnt), 0) as longest FROM (
        SELECT COUNT(*) as cnt FROM groups GROUP BY grp
      )
    `).get(userId) as { longest: number }
    const longestStreak = longestRow.longest

    const overview: OverviewData = {
      currentRound,
      roundProgress: progressPercent,
      totalWords,
      wordsLearned,
      wordsMastered,
      targetProficiency: 90,
      progressPercent,
      daysInRound,
      totalSessions,
      totalReviews,
      avgCorrectRate,
      streakDays,
      longestStreak,
    }

    ok(res, overview)
  } catch (e) {
    serverError(res, (e as Error).message)
  }
})

// ─── 5.2 GET /distribution ──────────────────────────────

const DISTRIBUTION_LABELS = [
  { level: 'Lv0', label: '未学习', range: '0' },
  { level: 'Lv1', label: '初识', range: '1-25' },
  { level: 'Lv2', label: '学习中', range: '26-50' },
  { level: 'Lv3', label: '基本掌握', range: '51-75' },
  { level: 'Lv4', label: '较熟练', range: '76-89' },
  { level: 'Lv5', label: '已掌握', range: '90-100' },
] as const

router.get('/distribution', requireAuth, (req: Request, res: Response) => {
  try {
    const userId = req.user!.id
    const currentRound = getCurrentRound(userId)

    const raw = getDb().prepare(`
      SELECT
        SUM(CASE WHEN proficiency = 0 THEN 1 ELSE 0 END) AS lv0,
        SUM(CASE WHEN proficiency BETWEEN 1 AND 25 THEN 1 ELSE 0 END) AS lv1,
        SUM(CASE WHEN proficiency BETWEEN 26 AND 50 THEN 1 ELSE 0 END) AS lv2,
        SUM(CASE WHEN proficiency BETWEEN 51 AND 75 THEN 1 ELSE 0 END) AS lv3,
        SUM(CASE WHEN proficiency BETWEEN 76 AND 89 THEN 1 ELSE 0 END) AS lv4,
        SUM(CASE WHEN proficiency >= 90 THEN 1 ELSE 0 END) AS lv5,
        MAX(proficiency) AS max_prof,
        MIN(proficiency) AS min_prof,
        ROUND(AVG(proficiency), 1) AS avg_prof
      FROM user_words
      WHERE user_id = ? AND round = ?
    `).get(userId, currentRound) as {
      lv0: number; lv1: number; lv2: number; lv3: number; lv4: number; lv5: number
      max_prof: number | null; min_prof: number | null; avg_prof: number | null
    }

    const counts = [raw.lv0, raw.lv1, raw.lv2, raw.lv3, raw.lv4, raw.lv5]
    const total = counts.reduce((a, b) => a + b, 0)

    const distribution: DistributionLevel[] = DISTRIBUTION_LABELS.map((label, i) => ({
      level: label.level,
      label: label.label,
      range: label.range,
      count: counts[i] || 0,
      percent: total > 0 ? Math.round((counts[i] / total) * 1000) / 10 : 0,
    }))

    const result: DistributionData = {
      distribution,
      roundMaxProficiency: raw.max_prof ?? 0,
      roundMinProficiency: raw.min_prof ?? 0,
      avgProficiency: raw.avg_prof ?? 0,
    }

    ok(res, result)
  } catch (e) {
    serverError(res, (e as Error).message)
  }
})

// ─── 5.3 GET /heatmap ───────────────────────────────────

router.get('/heatmap', requireAuth, (req: Request, res: Response) => {
  try {
    const userId = req.user!.id
    const days = Math.min(Math.max(Number(req.query.days) || 365, 1), 365)

    const endDate = new Date().toISOString().split('T')[0]
    const startDateObj = new Date(Date.now() - days * 86400000)
    const startDate = startDateObj.toISOString().split('T')[0]

    const reviewCounts = getDb().prepare(`
      SELECT date(created_at) AS date, COUNT(*) AS count
      FROM review_logs
      WHERE user_id = ? AND created_at >= datetime('now', ?)
      GROUP BY date(created_at)
      ORDER BY date
    `).all(userId, `-${days} days`) as Array<{ date: string; count: number }>

    const sessionDurations = getDb().prepare(`
      SELECT date(start_time) AS date, SUM(COALESCE(duration_seconds, 0)) AS duration
      FROM sessions
      WHERE user_id = ? AND start_time >= datetime('now', ?) AND status = 'completed'
      GROUP BY date(start_time)
      ORDER BY date
    `).all(userId, `-${days} days`) as Array<{ date: string; duration: number }>

    const countMap = new Map<string, number>()
    const durationMap = new Map<string, number>()

    for (const r of reviewCounts) {
      countMap.set(r.date, r.count)
    }
    for (const s of sessionDurations) {
      durationMap.set(s.date, durationMap.get(s.date)! + s.duration)
    }

    const heatmap: HeatmapDay[] = []
    const currentDate = new Date(startDateObj)
    const endDateTime = new Date(endDate + 'T23:59:59')

    while (currentDate <= endDateTime) {
      const dateStr = currentDate.toISOString().split('T')[0]
      heatmap.push({
        date: dateStr,
        count: countMap.get(dateStr) ?? 0,
        duration: durationMap.get(dateStr) ?? 0,
      })
      currentDate.setDate(currentDate.getDate() + 1)
    }

    ok(res, { heatmap, startDate, endDate })
  } catch (e) {
    serverError(res, (e as Error).message)
  }
})

// ─── 5.4 GET /rounds ────────────────────────────────────

router.get('/rounds', requireAuth, (req: Request, res: Response) => {
  try {
    const userId = req.user!.id
    const currentRound = getCurrentRound(userId)
    const totalWords = getWordCount()
    const completions = getRoundCompletions(userId) as Array<{
      id: number; user_id: number; round: number; completed_at: string
      words_mastered: number; total_words: number; avg_proficiency: number
    }>

    const rounds: RoundInfo[] = []

    for (const comp of completions) {
      const sessionsCount = (getDb().prepare(`
        SELECT COUNT(*) as cnt FROM sessions
        WHERE user_id = ? AND round = ? AND status = 'completed'
      `).get(userId, comp.round) as CountResult).cnt

      const avgCorrectRate = (getDb().prepare(`
        SELECT ROUND(AVG(CASE WHEN correct = 1 THEN 100.0 ELSE 0 END), 1) as rate
        FROM review_logs WHERE user_id = ? AND session_id IN (
          SELECT id FROM sessions WHERE round = ?
        )
      `).get(userId, comp.round) as { rate: number | null }).rate ?? 0

      const startDate = (getDb().prepare(`
        SELECT COALESCE(MIN(date(start_time)), '') as d
        FROM sessions WHERE user_id = ? AND round = ?
      `).get(userId, comp.round) as { d: string }).d

      rounds.push({
        round: comp.round,
        status: 'completed',
        totalWords: comp.total_words || totalWords,
        masteredCount: comp.words_mastered,
        progressPercent: 100,
        completedAt: comp.completed_at ? comp.completed_at.split('T')[0] || comp.completed_at.substring(0, 10) : null,
        sessionsCount,
        avgCorrectRate,
        avgProficiency: comp.avg_proficiency,
        startDate,
      })
    }

    if (completions.length === 0 || completions[completions.length - 1].round < currentRound) {
      const masteredCount = (getDb().prepare(`
        SELECT COUNT(*) as cnt FROM user_words
        WHERE user_id = ? AND round = ? AND proficiency >= 90
      `).get(userId, currentRound) as CountResult).cnt

      const progressPercent = totalWords > 0
        ? Math.round((masteredCount / totalWords) * 1000) / 10
        : 0

      const sessionsCount = (getDb().prepare(`
        SELECT COUNT(*) as cnt FROM sessions
        WHERE user_id = ? AND round = ? AND status = 'completed'
      `).get(userId, currentRound) as CountResult).cnt

      const avgCorrectRate = (getDb().prepare(`
        SELECT ROUND(AVG(CASE WHEN correct = 1 THEN 100.0 ELSE 0 END), 1) as rate
        FROM review_logs WHERE user_id = ? AND session_id IN (
          SELECT id FROM sessions WHERE round = ?
        )
      `).get(userId, currentRound) as { rate: number | null }).rate ?? 0

      const avgProficiency = (getDb().prepare(`
        SELECT ROUND(AVG(proficiency), 1) as avg_prof
        FROM user_words WHERE user_id = ? AND round = ?
      `).get(userId, currentRound) as { avg_prof: number | null }).avg_prof ?? 0

      const startDate = (getDb().prepare(`
        SELECT COALESCE(MIN(date(start_time)), '') as d
        FROM sessions WHERE user_id = ? AND round = ?
      `).get(userId, currentRound) as { d: string }).d

      rounds.push({
        round: currentRound,
        status: 'active',
        totalWords,
        masteredCount,
        progressPercent,
        completedAt: null,
        sessionsCount,
        avgCorrectRate,
        avgProficiency,
        startDate,
      })
    }

    const result: RoundsData = { rounds, currentRound }
    ok(res, result)
  } catch (e) {
    serverError(res, (e as Error).message)
  }
})

export default router
