import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import { createTestApp } from '../helpers/app.js'
import { createTestUser, generateToken, authHeader, TestUser } from '../helpers/auth.js'
import { getTestWordIds, seedUserWords, createTestSession, completeTestSession } from '../helpers/words.js'
import { getDb } from '../../../dist/models/database.js'

let app: ReturnType<typeof createTestApp>
let user: TestUser
let token: string

beforeEach(() => {
  getDb().prepare('DELETE FROM review_logs').run()
  getDb().prepare('DELETE FROM sessions').run()
  getDb().prepare('DELETE FROM round_completions').run()
  getDb().prepare('DELETE FROM user_settings').run()
  getDb().prepare('DELETE FROM user_words').run()
  getDb().prepare('DELETE FROM users').run()

  app = createTestApp()
  user = createTestUser('progressuser', 'test123456')
  token = generateToken(user)
})

describe('GET /api/progress/overview', () => {
  it('returns empty overview for new user', async () => {
    const res = await request(app)
      .get('/api/progress/overview')
      .set(authHeader(token))

    expect(res.status).toBe(200)
    expect(res.body.data.currentRound).toBe(1)
    expect(res.body.data.totalWords).toBe(50)
    expect(res.body.data.wordsLearned).toBe(0)
    expect(res.body.data.wordsMastered).toBe(0)
    expect(res.body.data.progressPercent).toBe(0)
    expect(res.body.data.totalSessions).toBe(0)
  })

  it('returns progress after learning words', async () => {
    const wordIds = getTestWordIds(5)
    seedUserWords(user.id, wordIds, 1)

    const sessionId = createTestSession(user.id)
    for (const wid of wordIds) {
      getDb().prepare(`
        INSERT INTO review_logs (user_id, word_id, session_id, correct, response_time_ms, quality, review_type)
        VALUES (?, ?, ?, 1, 3000, 4, 'choice')
      `).run(user.id, wid, sessionId)
    }
    completeTestSession(sessionId)

    const res = await request(app)
      .get('/api/progress/overview')
      .set(authHeader(token))

    expect(res.status).toBe(200)
    expect(res.body.data.currentRound).toBe(1)
    expect(res.body.data.totalSessions).toBe(1)
  })

  it('requires authentication', async () => {
    const res = await request(app).get('/api/progress/overview')
    expect(res.status).toBe(401)
  })
})

describe('GET /api/progress/distribution', () => {
  it('returns empty distribution for new user', async () => {
    const res = await request(app)
      .get('/api/progress/distribution')
      .set(authHeader(token))

    expect(res.status).toBe(200)
    expect(res.body.data.distribution).toHaveLength(6)
    expect(res.body.data.distribution[0].level).toBe('Lv0')
    expect(res.body.data.distribution[0].count).toBe(0)
    expect(res.body.data.avgProficiency).toBe(0)
  })

  it('reflects word proficiency distribution', async () => {
    const wordIds = getTestWordIds(10)
    seedUserWords(user.id, wordIds, 1)

    const res = await request(app)
      .get('/api/progress/distribution')
      .set(authHeader(token))

    expect(res.status).toBe(200)
    const lv0 = res.body.data.distribution.find((d: any) => d.level === 'Lv0')
    expect(lv0.count).toBe(10)
  })

  it('returns all 6 proficiency levels', async () => {
    const res = await request(app)
      .get('/api/progress/distribution')
      .set(authHeader(token))

    const levels = res.body.data.distribution.map((d: any) => d.level)
    expect(levels).toEqual(['Lv0', 'Lv1', 'Lv2', 'Lv3', 'Lv4', 'Lv5'])
  })
})

describe('GET /api/progress/heatmap', () => {
  it('returns heatmap data for default period', async () => {
    const sessionId = createTestSession(user.id)
    getDb().prepare(`
      INSERT INTO review_logs (user_id, word_id, session_id, correct, response_time_ms, quality, review_type, created_at)
      VALUES (?, 1, ?, 1, 3000, 4, 'choice', datetime('now'))
    `).run(user.id, sessionId)

    const res = await request(app)
      .get('/api/progress/heatmap')
      .set(authHeader(token))

    expect(res.status).toBe(200)
    expect(res.body.data.heatmap).toBeInstanceOf(Array)
    expect(res.body.data.startDate).toBeDefined()
    expect(res.body.data.endDate).toBeDefined()
  })

  it('respects days parameter', async () => {
    const res = await request(app)
      .get('/api/progress/heatmap?days=30')
      .set(authHeader(token))

    expect(res.status).toBe(200)
    expect(res.body.data.heatmap.length).toBe(31)
  })

  it('caps days at 365', async () => {
    const res = await request(app)
      .get('/api/progress/heatmap?days=500')
      .set(authHeader(token))

    expect(res.status).toBe(200)
    expect(res.body.data.heatmap.length).toBe(366)
  })

  it('shows zero for days with no activity', async () => {
    const res = await request(app)
      .get('/api/progress/heatmap?days=7')
      .set(authHeader(token))

    const allZero = res.body.data.heatmap.every((d: any) => d.count === 0 && d.duration === 0)
    expect(allZero).toBe(true)
  })
})

describe('GET /api/progress/rounds', () => {
  it('returns current round for new user', async () => {
    const res = await request(app)
      .get('/api/progress/rounds')
      .set(authHeader(token))

    expect(res.status).toBe(200)
    expect(res.body.data.currentRound).toBe(1)
    expect(res.body.data.rounds).toHaveLength(1)
    expect(res.body.data.rounds[0].status).toBe('active')
  })

  it('returns completed rounds', async () => {
    const wordIds = getTestWordIds(5)
    seedUserWords(user.id, wordIds, 1)

    getDb().prepare(`
      INSERT INTO round_completions (user_id, round, words_mastered, total_words, avg_proficiency)
      VALUES (?, 1, 5, 50, 85.0)
    `).run(user.id)

    const res = await request(app)
      .get('/api/progress/rounds')
      .set(authHeader(token))

    expect(res.status).toBe(200)
    const completedRound = res.body.data.rounds.find((r: any) => r.status === 'completed')
    expect(completedRound).toBeDefined()
    expect(completedRound.round).toBe(1)
  })
})
