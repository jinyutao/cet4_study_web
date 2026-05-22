import { Router, Request, Response } from 'express'
import { getDb, getWordCount } from '../models/database.js'
import { ok, serverError } from '../utils/response.js'

interface TopLearner {
  username: string
  masteredCount: number
  proficiency: number
}

interface RecentActivityItem {
  username: string
  round: number
  wordsMastered: number
  totalWords: number
  completedAt: string
}

const router = Router()

router.get('/stats', (_req: Request, res: Response) => {
  try {
    const db = getDb()

    const totalUsers = (db.prepare('SELECT COUNT(*) as cnt FROM users').get() as { cnt: number }).cnt
    const totalWords = getWordCount()
    const activeUsers = (db.prepare(
      "SELECT COUNT(DISTINCT user_id) as cnt FROM sessions WHERE start_time >= datetime('now', '-7 days')"
    ).get() as { cnt: number }).cnt
    const totalReviews = (db.prepare('SELECT COUNT(*) as cnt FROM review_logs').get() as { cnt: number }).cnt

    const topLearners = db.prepare(`
      SELECT u.username,
        COALESCE(SUM(CASE WHEN uw.proficiency >= 90 THEN 1 ELSE 0 END), 0) as masteredCount,
        COALESCE(AVG(uw.proficiency), 0) as proficiency
      FROM users u
      LEFT JOIN user_words uw ON uw.user_id = u.id
      GROUP BY u.id, u.username
      ORDER BY masteredCount DESC
      LIMIT 10
    `).all() as TopLearner[]

    const recentActivity = db.prepare(`
      SELECT u.username, rc.round, rc.words_mastered as wordsMastered,
        rc.total_words as totalWords, rc.completed_at as completedAt
      FROM round_completions rc
      JOIN users u ON u.id = rc.user_id
      ORDER BY rc.completed_at DESC
      LIMIT 20
    `).all() as RecentActivityItem[]

    ok(res, { totalUsers, activeUsers, totalWords, totalReviews, topLearners, recentActivity })
  } catch (e) {
    serverError(res, e instanceof Error ? e.message : '获取统计数据失败')
  }
})

export default router
