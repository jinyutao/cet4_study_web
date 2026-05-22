import bcrypt from 'bcryptjs'
import { getDb } from '../../../dist/models/database.js'
import { signToken } from '../../../dist/middleware/auth.js'

const SALT_ROUNDS = 10

export interface TestUser {
  id: number
  username: string
  is_admin: number
}

export function createTestUser(username: string, password: string, isAdmin = 0): TestUser {
  const hash = bcrypt.hashSync(password, SALT_ROUNDS)
  const result = getDb().prepare(
    'INSERT INTO users (username, password_hash, is_admin) VALUES (?, ?, ?)'
  ).run(username, hash, isAdmin)

  const userId = result.lastInsertRowid as number

  getDb().prepare(
    'INSERT OR IGNORE INTO user_settings (user_id) VALUES (?)'
  ).run(userId)

  return { id: userId, username, is_admin: isAdmin }
}

export function generateToken(user: TestUser): string {
  return signToken(user)
}

export function authHeader(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` }
}
