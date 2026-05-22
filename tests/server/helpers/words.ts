import { getDb } from '../../../dist/models/database.js'

export function getTestWordIds(count = 10): number[] {
  const rows = getDb().prepare('SELECT id FROM words ORDER BY id LIMIT ?').all(count) as { id: number }[]
  return rows.map(r => r.id)
}

export function seedUserWords(userId: number, wordIds: number[], round = 1): void {
  const insert = getDb().prepare(`
    INSERT OR IGNORE INTO user_words
      (user_id, word_id, round, ef, interval_days, repetitions, proficiency, next_review, first_learned_at)
    VALUES (?, ?, ?, 2.5, 0, 0, 0, datetime('now'), datetime('now'))
  `)
  for (const wid of wordIds) {
    insert.run(userId, wid, round)
  }
}

export function createTestSession(userId: number, round = 1): number {
  const result = getDb().prepare(
    "INSERT INTO sessions (user_id, round, status) VALUES (?, ?, 'active')"
  ).run(userId, round)
  return result.lastInsertRowid as number
}

export function completeTestSession(sessionId: number): void {
  getDb().prepare(`
    UPDATE sessions SET status = 'completed', end_time = datetime('now')
    WHERE id = ?
  `).run(sessionId)
}
