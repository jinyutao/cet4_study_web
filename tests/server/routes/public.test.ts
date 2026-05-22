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

  it('returns top learners sorted by mastery', async () => {
    const user1 = createTestUser('top1', 'test123456')
    const user2 = createTestUser('top2', 'test123456')
    const wordIds = getTestWordIds(10)

    seedUserWords(user1.id, wordIds, 1)
    seedUserWords(user2.id, wordIds.slice(0, 5), 1)

    const res = await request(app).get('/api/public/stats')

    expect(res.status).toBe(200)
    expect(res.body.data.topLearners.length).toBe(2)
  })

  it('includes activeUsers count from recent sessions', async () => {
    const user = createTestUser('active1', 'test123456')

    getDb().prepare(
      "INSERT INTO sessions (user_id, round, status, start_time) VALUES (?, 1, 'completed', datetime('now', '-1 days'))"
    ).run(user.id)

    const res = await request(app).get('/api/public/stats')

    expect(res.status).toBe(200)
    expect(res.body.data.activeUsers).toBe(1)
  })

  it('does not count old sessions as active', async () => {
    const user = createTestUser('olduser', 'test123456')

    getDb().prepare(
      "INSERT INTO sessions (user_id, round, status, start_time) VALUES (?, 1, 'completed', datetime('now', '-30 days'))"
    ).run(user.id)

    const res = await request(app).get('/api/public/stats')

    expect(res.status).toBe(200)
    expect(res.body.data.activeUsers).toBe(0)
  })
})
