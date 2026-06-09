import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import { createTestApp } from '../helpers/app.js'
import { createTestUser, generateToken, authHeader, TestUser } from '../helpers/auth.js'
import { getTestWordIds, seedUserWords, createTestSession, completeTestSession } from '../helpers/words.js'
import { getDb } from '../../../dist/models/database.js'

let app: ReturnType<typeof createTestApp>
let user: TestUser
let adminUser: TestUser
let token: string
let adminToken: string

beforeEach(() => {
  getDb().prepare('DELETE FROM review_logs').run()
  getDb().prepare('DELETE FROM sessions').run()
  getDb().prepare('DELETE FROM round_completions').run()
  getDb().prepare('DELETE FROM user_settings').run()
  getDb().prepare('DELETE FROM user_words').run()
  getDb().prepare('DELETE FROM users').run()

  app = createTestApp()
  user = createTestUser('learnuser', 'test123456')
  token = generateToken(user)
  adminUser = createTestUser('learnadmin', 'test123456', 1)
  adminToken = generateToken(adminUser)
})

describe('GET /api/learn/today', () => {
  it('returns today overview for user with no data', async () => {
    const res = await request(app)
      .get('/api/learn/today')
      .set(authHeader(token))

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.dueReviewCount).toBe(0)
    expect(res.body.data.newWordsAvailable).toBe(50)
    expect(res.body.data.newWordsPerSession).toBe(15)
    expect(res.body.data.lastSessionToday).toBe(false)
    expect(res.body.data.unfinishedSession).toBeNull()
  })

  it('returns due review count when words are due', async () => {
    const wordIds = getTestWordIds(5)
    seedUserWords(user.id, wordIds, 1)

    const res = await request(app)
      .get('/api/learn/today')
      .set(authHeader(token))

    expect(res.status).toBe(200)
    expect(res.body.data.dueReviewCount).toBe(5)
    expect(res.body.data.newWordsAvailable).toBe(45)
  })

  it('shows unfinished session if one exists', async () => {
    getDb().prepare(
      "INSERT INTO sessions (user_id, round, status) VALUES (?, 1, 'active')"
    ).run(user.id)

    const res = await request(app)
      .get('/api/learn/today')
      .set(authHeader(token))

    expect(res.status).toBe(200)
    expect(res.body.data.unfinishedSession).not.toBeNull()
    expect(res.body.data.unfinishedSession.id).toBeGreaterThan(0)
  })

  it('requires authentication', async () => {
    const res = await request(app).get('/api/learn/today')
    expect(res.status).toBe(401)
  })
})

describe('POST /api/learn/start', () => {
  it('returns validation error for first round without newWordMode', async () => {
    const res = await request(app)
      .post('/api/learn/start')
      .set(authHeader(token))
      .send({})

    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('starts a new session with newWordMode', async () => {
    const res = await request(app)
      .post('/api/learn/start')
      .set(authHeader(token))
      .send({ newWordMode: 'random' })

    expect(res.status).toBe(201)
    expect(res.body.success).toBe(true)
    expect(res.body.data.sessionId).toBeGreaterThan(0)
    expect(res.body.data.round).toBe(1)
    expect(res.body.data.reviewCount).toBe(0)
  })

  it('abandons previous active session on new start', async () => {
    getDb().prepare(
      "INSERT INTO sessions (user_id, round, status) VALUES (?, 1, 'active')"
    ).run(user.id)

    const res = await request(app)
      .post('/api/learn/start')
      .set(authHeader(token))
      .send({ newWordMode: 'random' })

    expect(res.status).toBe(201)

    const oldSessions = getDb().prepare(
      "SELECT status FROM sessions WHERE user_id = ?"
    ).all(user.id) as { status: string }[]

    const abandonedSessions = oldSessions.filter(s => s.status === 'abandoned')
    expect(abandonedSessions.length).toBe(1)
  })

  it('persists newWordMode to user settings', async () => {
    await request(app)
      .post('/api/learn/start')
      .set(authHeader(token))
      .send({ newWordMode: 'alpha' })

    const settings = getDb().prepare(
      "SELECT new_word_mode FROM user_settings WHERE user_id = ?"
    ).get(user.id) as { new_word_mode: string }

    expect(settings.new_word_mode).toBe('alpha')
  })

  it('allows subsequent sessions without newWordMode', async () => {
    await request(app)
      .post('/api/learn/start')
      .set(authHeader(token))
      .send({ newWordMode: 'random' })

    const res = await request(app)
      .post('/api/learn/start')
      .set(authHeader(token))
      .send({})

    expect(res.status).toBe(201)
  })
})

describe('GET /api/learn/review-queue', () => {
  it('returns empty queue when no due reviews', async () => {
    const sessionId = createTestSession(user.id)

    const res = await request(app)
      .get(`/api/learn/review-queue?sessionId=${sessionId}`)
      .set(authHeader(token))

    expect(res.status).toBe(200)
    expect(res.body.data.words).toEqual([])
    expect(res.body.data.total).toBe(0)
  })

  it('returns validation error without sessionId', async () => {
    const res = await request(app)
      .get('/api/learn/review-queue')
      .set(authHeader(token))

    expect(res.status).toBe(400)
  })

  it('returns not found for non-existent session', async () => {
    const res = await request(app)
      .get('/api/learn/review-queue?sessionId=99999')
      .set(authHeader(token))

    expect(res.status).toBe(404)
  })

  it('returns due reviews ordered by difficulty', async () => {
    const sessionId = createTestSession(user.id)
    const wordIds = getTestWordIds(3)
    seedUserWords(user.id, wordIds, 1)

    const res = await request(app)
      .get(`/api/learn/review-queue?sessionId=${sessionId}`)
      .set(authHeader(token))

    expect(res.status).toBe(200)
    expect(res.body.data.words.length).toBe(3)
    expect(res.body.data.total).toBe(3)
  })

  it('respects limit parameter', async () => {
    const sessionId = createTestSession(user.id)
    const wordIds = getTestWordIds(10)
    seedUserWords(user.id, wordIds, 1)

    const res = await request(app)
      .get(`/api/learn/review-queue?sessionId=${sessionId}&limit=3`)
      .set(authHeader(token))

    expect(res.status).toBe(200)
    expect(res.body.data.words.length).toBeLessThanOrEqual(3)
  })
})

describe('GET /api/learn/new-words', () => {
  it('returns new words for session', async () => {
    const sessionId = createTestSession(user.id)

    const res = await request(app)
      .get(`/api/learn/new-words?sessionId=${sessionId}`)
      .set(authHeader(token))

    expect(res.status).toBe(200)
    expect(res.body.data.words.length).toBeGreaterThan(0)
    expect(res.body.data.remainingNew).toBeGreaterThan(0)
    expect(res.body.data.mode).toBe('random')
  })

  it('returns validation error without sessionId', async () => {
    const res = await request(app)
      .get('/api/learn/new-words')
      .set(authHeader(token))

    expect(res.status).toBe(400)
  })

  it('returns not found for invalid session', async () => {
    const res = await request(app)
      .get('/api/learn/new-words?sessionId=99999')
      .set(authHeader(token))

    expect(res.status).toBe(404)
  })

  it('respects count parameter', async () => {
    const sessionId = createTestSession(user.id)

    const res = await request(app)
      .get(`/api/learn/new-words?sessionId=${sessionId}&count=5`)
      .set(authHeader(token))

    expect(res.status).toBe(200)
    expect(res.body.data.words.length).toBeLessThanOrEqual(5)
  })

  it('excludes already-learned words', async () => {
    const sessionId = createTestSession(user.id)
    const wordIds = getTestWordIds(10)
    seedUserWords(user.id, wordIds, 1)

    const res = await request(app)
      .get(`/api/learn/new-words?sessionId=${sessionId}&count=50`)
      .set(authHeader(token))

    expect(res.status).toBe(200)
    expect(res.body.data.words.length).toBeLessThanOrEqual(40)
  })
})

describe('POST /api/learn/answer', () => {
  let sessionId: number
  let wordIds: number[]

  beforeEach(() => {
    sessionId = createTestSession(user.id)
    wordIds = getTestWordIds(3)
  })

  it('records a correct answer', async () => {
    const res = await request(app)
      .post('/api/learn/answer')
      .set(authHeader(token))
      .send({
        sessionId,
        wordId: wordIds[0],
        correct: true,
        responseTimeMs: 3000,
        answerType: 'choice',
      })

    expect(res.status).toBe(200)
    expect(res.body.data.isCorrect).toBe(true)
    expect(res.body.data.proficiency).toBeGreaterThan(0)
    expect(res.body.data.sessionProgress.reviewed).toBe(1)
    expect(res.body.data.sessionProgress.passed).toBe(1)
  })

  it('records an incorrect answer', async () => {
    const res = await request(app)
      .post('/api/learn/answer')
      .set(authHeader(token))
      .send({
        sessionId,
        wordId: wordIds[0],
        correct: false,
        responseTimeMs: 5000,
        answerType: 'spelling',
      })

    expect(res.status).toBe(200)
    expect(res.body.data.isCorrect).toBe(false)
    expect(res.body.data.sessionProgress.failed).toBe(1)
  })

  it('returns validation error for missing fields', async () => {
    const res = await request(app)
      .post('/api/learn/answer')
      .set(authHeader(token))
      .send({ sessionId })

    expect(res.status).toBe(400)
  })

  it('returns not found for invalid session', async () => {
    const res = await request(app)
      .post('/api/learn/answer')
      .set(authHeader(token))
      .send({
        sessionId: 99999,
        wordId: wordIds[0],
        correct: true,
        responseTimeMs: 3000,
        answerType: 'choice',
      })

    expect(res.status).toBe(404)
  })

  it('returns validation error for completed session', async () => {
    completeTestSession(sessionId)

    const res = await request(app)
      .post('/api/learn/answer')
      .set(authHeader(token))
      .send({
        sessionId,
        wordId: wordIds[0],
        correct: true,
        responseTimeMs: 3000,
        answerType: 'choice',
      })

    expect(res.status).toBe(400)
  })

  it('creates user_word record on first answer', async () => {
    await request(app)
      .post('/api/learn/answer')
      .set(authHeader(token))
      .send({
        sessionId,
        wordId: wordIds[0],
        correct: true,
        responseTimeMs: 3000,
        answerType: 'choice',
      })

    const record = getDb().prepare(
      'SELECT * FROM user_words WHERE user_id = ? AND word_id = ?'
    ).get(user.id, wordIds[0]) as any

    expect(record).toBeDefined()
    expect(record.total_attempts).toBe(1)
  })
})

describe('POST /api/learn/complete', () => {
  let sessionId: number
  let wordIds: number[]

  beforeEach(() => {
    sessionId = createTestSession(user.id)
    wordIds = getTestWordIds(5)

    // Record some answers first
    for (let i = 0; i < 3; i++) {
      getDb().prepare(`
        INSERT INTO user_words (user_id, word_id, round, first_learned_at)
        VALUES (?, ?, 1, datetime('now'))
      `).run(user.id, wordIds[i])

      getDb().prepare(`
        INSERT INTO review_logs (user_id, word_id, session_id, correct, response_time_ms, quality, review_type)
        VALUES (?, ?, ?, 1, 3000, 4, 'choice')
      `).run(user.id, wordIds[i], sessionId)
    }

    getDb().prepare(`
      UPDATE sessions SET words_reviewed = 3, words_passed = 3 WHERE id = ?
    `).run(sessionId)
  })

  it('completes session normally', async () => {
    const res = await request(app)
      .post('/api/learn/complete')
      .set(authHeader(token))
      .send({ sessionId })

    expect(res.status).toBe(200)
    expect(res.body.data.totalReviewed).toBe(3)
    expect(res.body.data.totalPassed).toBe(3)
    expect(res.body.data.roundCompleted).toBe(false)
    expect(res.body.data.durationSeconds).toBeGreaterThanOrEqual(0)
  })

  it('marks session as abandoned', async () => {
    const res = await request(app)
      .post('/api/learn/complete')
      .set(authHeader(token))
      .send({ sessionId, abandoned: true })

    expect(res.status).toBe(200)
    expect(res.body.data.roundCompleted).toBe(false)

    const session = getDb().prepare(
      'SELECT status FROM sessions WHERE id = ?'
    ).get(sessionId) as { status: string }
    expect(session.status).toBe('abandoned')
  })

  it('returns validation error without sessionId', async () => {
    const res = await request(app)
      .post('/api/learn/complete')
      .set(authHeader(token))
      .send({})

    expect(res.status).toBe(400)
  })

  it('returns not found for invalid session', async () => {
    const res = await request(app)
      .post('/api/learn/complete')
      .set(authHeader(token))
      .send({ sessionId: 99999 })

    expect(res.status).toBe(404)
  })

  it('calculates correct rate', async () => {
    const res = await request(app)
      .post('/api/learn/complete')
      .set(authHeader(token))
      .send({ sessionId })

    expect(res.body.data.correctRate).toBe(100)
  })

  it('returns streakDays', async () => {
    const res = await request(app)
      .post('/api/learn/complete')
      .set(authHeader(token))
      .send({ sessionId })

    expect(res.body.data.streakDays).toBeGreaterThanOrEqual(0)
  })
})

describe('Word scope (letter mode)', () => {
  it('accepts letter as newWordMode in /start', async () => {
    const res = await request(app)
      .post('/api/learn/start')
      .set(authHeader(token))
      .send({ newWordMode: 'B' })

    expect(res.status).toBe(201)
    expect(res.body.data.sessionId).toBeGreaterThan(0)
  })

  it('persists letter newWordMode to user settings', async () => {
    await request(app)
      .post('/api/learn/start')
      .set(authHeader(token))
      .send({ newWordMode: 'B' })

    const settings = getDb().prepare(
      'SELECT new_word_mode FROM user_settings WHERE user_id = ?'
    ).get(user.id) as { new_word_mode: string }

    expect(settings.new_word_mode).toBe('B')
  })

  it('/today returns scoped newWordsAvailable when scope is active', async () => {
    await request(app)
      .post('/api/learn/start')
      .set(authHeader(token))
      .send({ newWordMode: 'B' })

    const res = await request(app)
      .get('/api/learn/today')
      .set(authHeader(token))

    expect(res.status).toBe(200)
    expect(res.body.data.wordScope).toBe('B')
    expect(res.body.data.newWordMode).toBe('B')
    // scope 模式 newWordsAvailable 按字母过滤
    expect(res.body.data.newWordsAvailable).toBe(4)
  })

  it('/today with scope returns correct available count', async () => {
    await request(app)
      .post('/api/learn/start')
      .set(authHeader(token))
      .send({ newWordMode: 'E' })

    const res = await request(app)
      .get('/api/learn/today')
      .set(authHeader(token))

    expect(res.status).toBe(200)
    expect(res.body.data.wordScope).toBe('E')
    // scope 模式 newWordsAvailable 按字母过滤
    expect(res.body.data.newWordsAvailable).toBe(4)
  })

  it('/new-words returns only letter-matching words', async () => {
    await request(app)
      .post('/api/learn/start')
      .set(authHeader(token))
      .send({ newWordMode: 'E' })

    const todayRes = await request(app)
      .get('/api/learn/today')
      .set(authHeader(token))

    const sessionId = todayRes.body.data.unfinishedSession?.id
    expect(sessionId).toBeGreaterThan(0)

    const res = await request(app)
      .get(`/api/learn/new-words?sessionId=${sessionId}`)
      .set(authHeader(token))

    expect(res.status).toBe(200)
    expect(res.body.data.wordScope).toBe('E')
    expect(res.body.data.words.length).toBeGreaterThan(0)
    // All returned words should start with 'E' (case-insensitive)
    for (const w of res.body.data.words) {
      expect(w.word[0].toUpperCase()).toBe('E')
    }
  })

  it('/new-words remainingNew reflects scope', async () => {
    await request(app)
      .post('/api/learn/start')
      .set(authHeader(token))
      .send({ newWordMode: 'E' })

    const todayRes = await request(app)
      .get('/api/learn/today')
      .set(authHeader(token))

    const sessionId = todayRes.body.data.unfinishedSession?.id
    expect(sessionId).toBeGreaterThan(0)

    const res = await request(app)
      .get(`/api/learn/new-words?sessionId=${sessionId}&count=10`)
      .set(authHeader(token))

    expect(res.status).toBe(200)
    expect(res.body.data.wordScope).toBe('E')
    // E has 4 words total, all fetched. remainingNew reflects 4 unscoped words (not 50 global)
    expect(res.body.data.remainingNew).toBe(4)
  })

  it('/review-queue filters by scope', async () => {
    await request(app)
      .post('/api/learn/start')
      .set(authHeader(token))
      .send({ newWordMode: 'A' })

    const todayRes = await request(app)
      .get('/api/learn/today')
      .set(authHeader(token))

    const sessionId = todayRes.body.data.unfinishedSession?.id

    // Seed some A-words and a non-A-word for review
    const wordIds = getTestWordIds(50)
    const allWords = getDb().prepare('SELECT id, word FROM words WHERE id IN (' +
      wordIds.map(() => '?').join(',') + ')').all(...wordIds) as { id: number; word: string }[]

    const aWord = allWords.find(w => w.word[0].toUpperCase() === 'A')
    const nonAWord = allWords.find(w => w.word[0].toUpperCase() !== 'A')

    if (aWord && nonAWord) {
      seedUserWords(user.id, [aWord.id, nonAWord.id], 1)

      const res = await request(app)
        .get(`/api/learn/review-queue?sessionId=${sessionId}`)
        .set(authHeader(token))

      expect(res.status).toBe(200)
      // Should only return the A-word, not the non-A-word
      const words = res.body.data.words as { word: string }[]
      for (const w of words) {
        expect(w.word[0].toUpperCase()).toBe('A')
      }
    }
  })
})

