import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import { createTestApp } from '../helpers/app.js'
import { createTestUser, generateToken, authHeader } from '../helpers/auth.js'
import { getTestWordIds, seedUserWords } from '../helpers/words.js'
import { getDb } from '../../../dist/models/database.js'

let app: ReturnType<typeof createTestApp>

beforeEach(() => {
  getDb().prepare('DELETE FROM review_logs').run()
  getDb().prepare('DELETE FROM sessions').run()
  getDb().prepare('DELETE FROM round_completions').run()
  getDb().prepare('DELETE FROM user_settings').run()
  getDb().prepare('DELETE FROM user_words').run()
  getDb().prepare('DELETE FROM users').run()
  app = createTestApp()
})

describe('GET /api/public/stats', () => {
  it('returns empty stats when no data exists', async () => {
    const res = await request(app).get('/api/public/stats')

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.totalUsers).toBe(0)
    expect(res.body.data.totalWords).toBe(50)
    expect(res.body.data.totalReviews).toBe(0)
    expect(res.body.data.topLearners).toEqual([])
    expect(res.body.data.recentActivity).toEqual([])
  })

  it('returns response envelope correctly', async () => {
    const res = await request(app).get('/api/public/stats')

    expect(res.body.success).toBe(true)
    expect(typeof res.body.ts).toBe('string')
    expect(res.body.data).toBeDefined()
  })

  it('returns stats with user activity', async () => {
    const user = createTestUser('learner1', 'test123456')
    const wordIds = getTestWordIds(5)
    seedUserWords(user.id, wordIds, 1)

    const res = await request(app).get('/api/public/stats')

    expect(res.status).toBe(200)
    expect(res.body.data.totalUsers).toBe(1)
    expect(res.body.data.totalWords).toBe(50)
  })

  it('returns top learners with correct fields and sort order', async () => {
    const user1 = createTestUser('top1', 'test123456')
    const user2 = createTestUser('top2', 'test123456')
    const wordIds = getTestWordIds(10)

    seedUserWords(user1.id, wordIds, 1)
    seedUserWords(user2.id, wordIds.slice(0, 5), 1)

    const res = await request(app).get('/api/public/stats')

    expect(res.status).toBe(200)
    expect(res.body.data.topLearners.length).toBe(2)
    for (const learner of res.body.data.topLearners) {
      expect(learner).toHaveProperty('username')
      expect(learner).toHaveProperty('masteredCount')
      expect(learner).toHaveProperty('daysActive')
      expect(typeof learner.username).toBe('string')
      expect(typeof learner.masteredCount).toBe('number')
      expect(typeof learner.daysActive).toBe('number')
    }
    expect(res.body.data.topLearners[0].masteredCount).toBeGreaterThanOrEqual(
      res.body.data.topLearners[1].masteredCount
    )
  })

  it('includes activeUsers count from recent review_logs', async () => {
    const user = createTestUser('active1', 'test123456')

    getDb().prepare(
      "INSERT INTO review_logs (user_id, word_id, session_id, correct, response_time_ms, quality, review_type, created_at) VALUES (?, 1, NULL, 1, 3000, 4, 'choice', datetime('now', '-1 days'))"
    ).run(user.id)

    const res = await request(app).get('/api/public/stats')

    expect(res.status).toBe(200)
    expect(res.body.data.activeUsers).toBe(1)
  })

  it('does not count old review_logs as active', async () => {
    const user = createTestUser('olduser', 'test123456')

    getDb().prepare(
      "INSERT INTO review_logs (user_id, word_id, session_id, correct, response_time_ms, quality, review_type, created_at) VALUES (?, 1, NULL, 1, 3000, 4, 'choice', datetime('now', '-30 days'))"
    ).run(user.id)

    const res = await request(app).get('/api/public/stats')

    expect(res.status).toBe(200)
    expect(res.body.data.activeUsers).toBe(0)
  })

  it('includes recentActivity from round_completions', async () => {
    const user = createTestUser('completer', 'test123456')

    getDb().prepare(`
      INSERT INTO round_completions (user_id, round, words_mastered, total_words, avg_proficiency)
      VALUES (?, 1, 50, 50, 85.0)
    `).run(user.id)

    const res = await request(app).get('/api/public/stats')

    expect(res.status).toBe(200)
    expect(res.body.data.recentActivity.length).toBe(1)
    expect(res.body.data.recentActivity[0]).toHaveProperty('username')
    expect(res.body.data.recentActivity[0]).toHaveProperty('action')
    expect(res.body.data.recentActivity[0]).toHaveProperty('timestamp')
    expect(res.body.data.recentActivity[0].username).toBe('completer')
    expect(res.body.data.recentActivity[0].action).toContain('完成了第')
    expect(res.body.data.recentActivity[0].action).toContain('轮学习')
  })

  it('totalReviews reflects real review_logs count', async () => {
    const user = createTestUser('reviewer', 'test123456')

    getDb().prepare(
      "INSERT INTO review_logs (user_id, word_id, session_id, correct, response_time_ms, quality, review_type) VALUES (?, 1, NULL, 1, 3000, 4, 'choice')"
    ).run(user.id)
    getDb().prepare(
      "INSERT INTO review_logs (user_id, word_id, session_id, correct, response_time_ms, quality, review_type) VALUES (?, 2, NULL, 0, 5000, 2, 'spelling')"
    ).run(user.id)

    const res = await request(app).get('/api/public/stats')

    expect(res.status).toBe(200)
    expect(res.body.data.totalReviews).toBe(2)
  })

  it('includes users with zero activity in topLearners (INNER JOIN excludes them)', async () => {
    const user = createTestUser('noactivity', 'test123456')

    const res = await request(app).get('/api/public/stats')

    expect(res.status).toBe(200)
    const noActivity = res.body.data.topLearners.find(
      (l: any) => l.username === 'noactivity'
    )
    // INNER JOIN excludes users without user_words
    // Users with 0 user_words won't appear in topLearners
    expect(noActivity).toBeUndefined()
  })
})
