import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import { createTestApp } from '../helpers/app.js'
import { createTestUser, generateToken, authHeader, TestUser } from '../helpers/auth.js'
import { getDb } from '../../../dist/models/database.js'

let app: ReturnType<typeof createTestApp>

beforeEach(() => {
  // Clean up users table (except the auto-admin from first registration)
  getDb().prepare('DELETE FROM review_logs').run()
  getDb().prepare('DELETE FROM sessions').run()
  getDb().prepare('DELETE FROM round_completions').run()
  getDb().prepare('DELETE FROM user_settings').run()
  getDb().prepare('DELETE FROM user_words').run()
  getDb().prepare('DELETE FROM users').run()
  app = createTestApp()
})

describe('POST /api/auth/register', () => {
  it('registers a new user and returns token', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'testuser', password: 'test123456' })

    expect(res.status).toBe(201)
    expect(res.body.success).toBe(true)
    expect(res.body.data.user).toBeDefined()
    expect(res.body.data.user.username).toBe('testuser')
    expect(res.body.data.token).toBeDefined()
  })

  it('rejects duplicate username', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ username: 'dupuser', password: 'test123456' })

    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'dupuser', password: 'test123456' })

    expect(res.status).toBe(409)
    expect(res.body.success).toBe(false)
    expect(res.body.error.code).toBe('DUPLICATE_USERNAME')
  })

  it('rejects short password', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'newuser', password: '12345' })

    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
  })

  it('rejects long password', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'newuser', password: 'a'.repeat(33) })

    expect(res.status).toBe(400)
  })

  it('rejects non-alphanumeric username', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'user name!', password: 'test123456' })

    expect(res.status).toBe(400)
  })

  it('rejects pure-digit username', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: '123456', password: 'test123456' })

    expect(res.status).toBe(400)
  })

  it('rejects too-short username', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'ab', password: 'test123456' })

    expect(res.status).toBe(400)
  })

  it('rejects too-long username', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'a'.repeat(21), password: 'test123456' })

    expect(res.status).toBe(400)
  })

  it('rejects empty username', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: '', password: 'test123456' })

    expect(res.status).toBe(400)
  })

  it('rejects missing fields', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'testuser' })

    expect(res.status).toBe(400)
  })

  it('makes first user an admin', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'firstadmin', password: 'test123456' })

    expect(res.status).toBe(201)
    expect(res.body.data.user.isAdmin).toBe(true)
  })

  it('makes subsequent users non-admin', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ username: 'admin1', password: 'test123456' })

    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'user2', password: 'test123456' })

    expect(res.status).toBe(201)
    expect(res.body.data.user.isAdmin).toBe(false)
  })
})

describe('POST /api/auth/login', () => {
  beforeEach(async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ username: 'loginuser', password: 'test123456' })
  })

  it('logs in with valid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'loginuser', password: 'test123456' })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.token).toBeDefined()
    expect(res.body.data.user.username).toBe('loginuser')
  })

  it('rejects wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'loginuser', password: 'wrongpassword' })

    expect(res.status).toBe(401)
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS')
  })

  it('rejects nonexistent user', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'nouser', password: 'test123456' })

    expect(res.status).toBe(401)
  })

  it('rejects frozen user', async () => {
    const user = getDb().prepare(
      "SELECT id FROM users WHERE username = 'loginuser'"
    ).get() as { id: number }
    getDb().prepare('UPDATE users SET frozen = 1 WHERE id = ?').run(user.id)

    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'loginuser', password: 'test123456' })

    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('USER_FROZEN')
  })

  it('rejects empty credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: '', password: '' })

    expect(res.status).toBe(400)
  })
})

describe('GET /api/auth/me', () => {
  let user: TestUser
  let token: string

  beforeEach(async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ username: 'mepage', password: 'test123456' })

    const row = getDb().prepare(
      "SELECT id, username, is_admin FROM users WHERE username = 'mepage'"
    ).get() as TestUser
    user = row
    token = generateToken(user)
  })

  it('returns user profile for authenticated user', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set(authHeader(token))

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.username).toBe('mepage')
    expect(res.body.data.settings).toBeDefined()
    expect(res.body.data.stats).toBeDefined()
  })

  it('rejects unauthenticated request with standard error envelope', async () => {
    const res = await request(app)
      .get('/api/auth/me')

    expect(res.status).toBe(401)
    expect(res.body.success).toBe(false)
    expect(res.body.error.code).toBe('UNAUTHORIZED')
    expect(res.body.error.message).toBeDefined()
    expect(res.body.ts).toBeDefined()
  })

  it('rejects invalid token with standard error envelope', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set(authHeader('invalid-token'))

    expect(res.status).toBe(401)
    expect(res.body.success).toBe(false)
    expect(res.body.error.code).toBe('INVALID_TOKEN')
    expect(res.body.error.message).toBeDefined()
    expect(res.body.ts).toBeDefined()
  })

  it('rejects frozen user with standard error envelope', async () => {
    getDb().prepare('UPDATE users SET frozen = 1 WHERE id = ?').run(user.id)

    const res = await request(app)
      .get('/api/auth/me')
      .set(authHeader(token))

    expect(res.status).toBe(403)
    expect(res.body.success).toBe(false)
    expect(res.body.error.code).toBe('USER_FROZEN')
    expect(res.body.error.message).toBeDefined()
    expect(res.body.ts).toBeDefined()
  })
})
