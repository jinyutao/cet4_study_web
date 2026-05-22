import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import { createTestApp } from '../helpers/app.js'
import { createTestUser, generateToken, authHeader, TestUser } from '../helpers/auth.js'
import { getTestWordIds, seedUserWords, createTestSession } from '../helpers/words.js'
import { getDb } from '../../../dist/models/database.js'

let app: ReturnType<typeof createTestApp>
let adminUser: TestUser
let normalUser: TestUser
let adminToken: string
let normalToken: string

beforeEach(() => {
  getDb().prepare('DELETE FROM review_logs').run()
  getDb().prepare('DELETE FROM sessions').run()
  getDb().prepare('DELETE FROM round_completions').run()
  getDb().prepare('DELETE FROM user_settings').run()
  getDb().prepare('DELETE FROM user_words').run()
  getDb().prepare('DELETE FROM users').run()

  app = createTestApp()
  adminUser = createTestUser('adminuser', 'test123456', 1)
  adminToken = generateToken(adminUser)
  normalUser = createTestUser('normaluser', 'test123456')
  normalToken = generateToken(normalUser)
})

describe('GET /api/admin/users', () => {
  it('returns user list for admin', async () => {
    const res = await request(app)
      .get('/api/admin/users')
      .set(authHeader(adminToken))

    expect(res.status).toBe(200)
    expect(res.body.data.users).toHaveLength(2)
    expect(res.body.data.pagination.total).toBe(2)
  })

  it('rejects non-admin users', async () => {
    const res = await request(app)
      .get('/api/admin/users')
      .set(authHeader(normalToken))

    expect(res.status).toBe(403)
  })

  it('rejects unauthenticated request', async () => {
    const res = await request(app).get('/api/admin/users')
    expect(res.status).toBe(401)
  })

  it('supports search parameter', async () => {
    const res = await request(app)
      .get('/api/admin/users?search=admin')
      .set(authHeader(adminToken))

    expect(res.status).toBe(200)
    expect(res.body.data.users.every((u: any) => u.username.includes('admin'))).toBe(true)
  })

  it('supports pagination', async () => {
    createTestUser('extra1', 'test123456')
    createTestUser('extra2', 'test123456')

    const res = await request(app)
      .get('/api/admin/users?page=1&pageSize=2')
      .set(authHeader(adminToken))

    expect(res.status).toBe(200)
    expect(res.body.data.users.length).toBeLessThanOrEqual(2)
    expect(res.body.data.pagination.totalPages).toBeGreaterThanOrEqual(2)
  })

  it('supports filter by admin', async () => {
    const res = await request(app)
      .get('/api/admin/users?filter=admin')
      .set(authHeader(adminToken))

    expect(res.status).toBe(200)
    expect(res.body.data.users.every((u: any) => u.isAdmin === true)).toBe(true)
  })

  it('supports sort options', async () => {
    const res = await request(app)
      .get('/api/admin/users?sortBy=username&sortOrder=asc')
      .set(authHeader(adminToken))

    expect(res.status).toBe(200)
    const usernames = res.body.data.users.map((u: any) => u.username)
    expect(usernames).toEqual([...usernames].sort())
  })
})

describe('PUT /api/admin/users/:id/reset-password', () => {
  it('resets password for a user', async () => {
    const res = await request(app)
      .put(`/api/admin/users/${normalUser.id}/reset-password`)
      .set(authHeader(adminToken))
      .send({ newPassword: 'newpass123' })

    expect(res.status).toBe(200)
    expect(res.body.data.userId).toBe(normalUser.id)
    expect(res.body.data.newPassword).toBe('newpass123')
  })

  it('generates random password if not provided', async () => {
    const res = await request(app)
      .put(`/api/admin/users/${normalUser.id}/reset-password`)
      .set(authHeader(adminToken))
      .send({})

    expect(res.status).toBe(200)
    expect(res.body.data.newPassword.length).toBeGreaterThanOrEqual(12)
  })

  it('returns not found for non-existent user', async () => {
    const res = await request(app)
      .put('/api/admin/users/99999/reset-password')
      .set(authHeader(adminToken))
      .send({ newPassword: 'newpass123' })

    expect(res.status).toBe(404)
  })

  it('rejects non-admin users', async () => {
    const res = await request(app)
      .put(`/api/admin/users/${adminUser.id}/reset-password`)
      .set(authHeader(normalToken))
      .send({ newPassword: 'newpass123' })

    expect(res.status).toBe(403)
  })
})

describe('PUT /api/admin/users/:id/set-admin', () => {
  it('promotes a normal user to admin', async () => {
    const res = await request(app)
      .put(`/api/admin/users/${normalUser.id}/set-admin`)
      .set(authHeader(adminToken))
      .send({ isAdmin: true })

    expect(res.status).toBe(200)
    expect(res.body.data.isAdmin).toBe(true)
  })

  it('demotes an admin', async () => {
    const extraAdmin = createTestUser('extraadmin', 'test123456', 1)

    const res = await request(app)
      .put(`/api/admin/users/${extraAdmin.id}/set-admin`)
      .set(authHeader(adminToken))
      .send({ isAdmin: false })

    expect(res.status).toBe(200)
    expect(res.body.data.isAdmin).toBe(false)
  })

  it('prevents removing the last admin', async () => {
    const res = await request(app)
      .put(`/api/admin/users/${adminUser.id}/set-admin`)
      .set(authHeader(adminToken))
      .send({ isAdmin: false })

    expect(res.status).toBe(400)
  })

  it('prevents self-modification', async () => {
    const res = await request(app)
      .put(`/api/admin/users/${adminUser.id}/set-admin`)
      .set(authHeader(adminToken))
      .send({ isAdmin: true })

    expect(res.status).toBe(400)
  })

  it('validates isAdmin is boolean', async () => {
    const res = await request(app)
      .put(`/api/admin/users/${normalUser.id}/set-admin`)
      .set(authHeader(adminToken))
      .send({ isAdmin: 'yes' })

    expect(res.status).toBe(400)
  })
})

describe('PUT /api/admin/users/:id/freeze', () => {
  it('freezes a user', async () => {
    const res = await request(app)
      .put(`/api/admin/users/${normalUser.id}/freeze`)
      .set(authHeader(adminToken))
      .send({ isFrozen: true })

    expect(res.status).toBe(200)
    expect(res.body.data.isFrozen).toBe(true)

    const dbUser = getDb().prepare(
      'SELECT frozen FROM users WHERE id = ?'
    ).get(normalUser.id) as { frozen: number }
    expect(dbUser.frozen).toBe(1)
  })

  it('unfreezes a user', async () => {
    getDb().prepare('UPDATE users SET frozen = 1 WHERE id = ?').run(normalUser.id)

    const res = await request(app)
      .put(`/api/admin/users/${normalUser.id}/freeze`)
      .set(authHeader(adminToken))
      .send({ isFrozen: false })

    expect(res.status).toBe(200)
    expect(res.body.data.isFrozen).toBe(false)
  })

  it('returns not found for non-existent user', async () => {
    const res = await request(app)
      .put('/api/admin/users/99999/freeze')
      .set(authHeader(adminToken))
      .send({ isFrozen: true })

    expect(res.status).toBe(404)
  })

  it('validates isFrozen is boolean', async () => {
    const res = await request(app)
      .put(`/api/admin/users/${normalUser.id}/freeze`)
      .set(authHeader(adminToken))
      .send({ isFrozen: 1 })

    expect(res.status).toBe(400)
  })
})

describe('DELETE /api/admin/users/:id', () => {
  it('deletes a normal user', async () => {
    createTestSession(normalUser.id)

    const res = await request(app)
      .delete(`/api/admin/users/${normalUser.id}`)
      .set(authHeader(adminToken))

    expect(res.status).toBe(200)
    expect(res.body.data.deleted).toBe(true)
    expect(res.body.data.removedRecords).toBeDefined()

    const dbUser = getDb().prepare(
      'SELECT id FROM users WHERE id = ?'
    ).get(normalUser.id)
    expect(dbUser).toBeUndefined()
  })

  it('prevents self-deletion', async () => {
    const res = await request(app)
      .delete(`/api/admin/users/${adminUser.id}`)
      .set(authHeader(adminToken))

    expect(res.status).toBe(400)
  })

  it('returns not found for non-existent user', async () => {
    const res = await request(app)
      .delete('/api/admin/users/99999')
      .set(authHeader(adminToken))

    expect(res.status).toBe(404)
  })

  it('prevents deleting the last admin', async () => {
    const res = await request(app)
      .delete(`/api/admin/users/${adminUser.id}`)
      .set(authHeader(adminToken))

    expect(res.status).toBe(400)
  })

  it('rejects non-admin users', async () => {
    const res = await request(app)
      .delete(`/api/admin/users/${adminUser.id}`)
      .set(authHeader(normalToken))

    expect(res.status).toBe(403)
  })
})
