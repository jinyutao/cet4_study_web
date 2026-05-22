import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import { createTestApp } from '../helpers/app.js'
import { createTestUser, generateToken, authHeader, TestUser } from '../helpers/auth.js'
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
  user = createTestUser('settingsuser', 'test123456')
  token = generateToken(user)
})

describe('GET /api/settings', () => {
  it('returns default settings', async () => {
    const res = await request(app)
      .get('/api/settings')
      .set(authHeader(token))

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.newWordsPerSession).toBe(15)
    expect(res.body.data.dailyGoal).toBe(40)
    expect(res.body.data.spellingMode).toBe(false)
    expect(res.body.data.choiceOptions).toBe(4)
  })

  it('rejects unauthenticated request', async () => {
    const res = await request(app).get('/api/settings')
    expect(res.status).toBe(401)
  })
})

describe('PUT /api/settings', () => {
  it('updates settings successfully', async () => {
    const res = await request(app)
      .put('/api/settings')
      .set(authHeader(token))
      .send({ newWordsPerSession: 20, dailyGoal: 50, spellingMode: true })

    expect(res.status).toBe(200)
    expect(res.body.data.newWordsPerSession).toBe(20)
    expect(res.body.data.dailyGoal).toBe(50)
    expect(res.body.data.spellingMode).toBe(true)
  })

  it('rejects newWordsPerSession out of range', async () => {
    const res = await request(app)
      .put('/api/settings')
      .set(authHeader(token))
      .send({ newWordsPerSession: 100 })

    expect(res.status).toBe(400)
  })

  it('rejects dailyGoal out of range', async () => {
    const res = await request(app)
      .put('/api/settings')
      .set(authHeader(token))
      .send({ dailyGoal: 200 })

    expect(res.status).toBe(400)
  })

  it('rejects invalid choiceOptions', async () => {
    const res = await request(app)
      .put('/api/settings')
      .set(authHeader(token))
      .send({ choiceOptions: 3 })

    expect(res.status).toBe(400)
  })

  it('accepts valid choiceOptions (2, 4, 6)', async () => {
    for (const opt of [2, 4, 6]) {
      const res = await request(app)
        .put('/api/settings')
        .set(authHeader(token))
        .send({ choiceOptions: opt })
      expect(res.status).toBe(200)
      expect(res.body.data.choiceOptions).toBe(opt)
    }
  })

  it('rejects invalid reminderTime format', async () => {
    const res = await request(app)
      .put('/api/settings')
      .set(authHeader(token))
      .send({ reminderTime: '7:30' })

    expect(res.status).toBe(400)
  })

  it('accepts valid reminderTime', async () => {
    const res = await request(app)
      .put('/api/settings')
      .set(authHeader(token))
      .send({ reminderTime: '07:30' })

    expect(res.status).toBe(200)
    expect(res.body.data.reminderTime).toBe('07:30')
  })

  it('rejects non-boolean values for boolean fields', async () => {
    const res = await request(app)
      .put('/api/settings')
      .set(authHeader(token))
      .send({ spellingMode: 'yes' })

    expect(res.status).toBe(400)
  })

  it('persists settings changes across GET calls', async () => {
    await request(app)
      .put('/api/settings')
      .set(authHeader(token))
      .send({ newWordsPerSession: 25 })

    const res = await request(app)
      .get('/api/settings')
      .set(authHeader(token))

    expect(res.body.data.newWordsPerSession).toBe(25)
  })

  it('rejects unauthenticated request', async () => {
    const res = await request(app)
      .put('/api/settings')
      .send({ newWordsPerSession: 20 })

    expect(res.status).toBe(401)
  })
})
