import { Router, Request, Response } from 'express'
import { getDb, getWordCount } from '../models/database.js'
import { ok, serverError } from '../utils/response.js'

interface TopLearner {
  username: string
  masteredCount: number
  daysActive: number
}

interface RecentActivityItem {
  username: string
  action: string
  timestamp: string
}

const router = Router()

router.get('/stats', (_req: Request, res: Response) => {
  try {
    const db = getDb()

    const totalUsers = (db.prepare('SELECT COUNT(*) as cnt FROM users').get() as { cnt: number }).cnt
    const totalWords = getWordCount()
    const activeUsers = (db.prepare(
      "SELECT COUNT(DISTINCT user_id) as cnt FROM review_logs WHERE created_at >= datetime('now', '-7 days')"
    ).get() as { cnt: number }).cnt
    const totalReviews = (db.prepare('SELECT COUNT(*) as cnt FROM review_logs').get() as { cnt: number }).cnt

    const topLearners = db.prepare(`
      SELECT u.username,
        COALESCE(SUM(CASE WHEN uw.proficiency >= 90 THEN 1 ELSE 0 END), 0) as masteredCount,
        COALESCE((SELECT COUNT(DISTINCT date(rl.created_at)) FROM review_logs rl WHERE rl.user_id = u.id), 0) as daysActive
      FROM users u
      JOIN user_words uw ON uw.user_id = u.id AND uw.round = (SELECT COALESCE(MAX(uw2.round), 1) FROM user_words uw2 WHERE uw2.user_id = u.id)
      GROUP BY u.id, u.username
      ORDER BY masteredCount DESC
      LIMIT 10
    `).all() as TopLearner[]

    const recentActivity = db.prepare(`
      SELECT u.username, ('完成了第 ' || rc.round || ' 轮学习') AS action, rc.completed_at AS timestamp
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
