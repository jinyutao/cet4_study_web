import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'

let db: Database.Database | null = null

interface UserRow {
  id: number
  username: string
  password_hash: string
  is_admin: number
  frozen: number
  created_at: string
}

interface UserWordRow {
  user_id: number
  word_id: number
  ef: number
  interval_days: number
  repetitions: number
  proficiency: number
  next_review: string | null
  total_correct: number
  total_attempts: number
  avg_response_time: number | null
  round: number
  consecutive_correct: number
  last_reviewed_at: string | null
  first_learned_at: string | null
}

const SCHEMA_SQL = `
-- 词汇表（预填充，来自 CET-4 大纲）
CREATE TABLE IF NOT EXISTS words (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  word        TEXT NOT NULL UNIQUE,
  phonetic    TEXT,
  pos         TEXT,
  chinese     TEXT NOT NULL,
  english_def TEXT
);

-- 用户表
CREATE TABLE IF NOT EXISTS users (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  username        TEXT NOT NULL UNIQUE,
  password_hash   TEXT NOT NULL,
  is_admin        INTEGER DEFAULT 0,
  frozen          INTEGER DEFAULT 0,
  created_at      TEXT DEFAULT (datetime('now'))
);

-- 用户-词汇 学习状态
CREATE TABLE IF NOT EXISTS user_words (
  user_id             INTEGER NOT NULL REFERENCES users(id),
  word_id             INTEGER NOT NULL REFERENCES words(id),
  ef                  REAL DEFAULT 2.5,
  interval_days       INTEGER DEFAULT 0,
  repetitions         INTEGER DEFAULT 0,
  proficiency         INTEGER DEFAULT 0,
  next_review         TEXT,
  total_correct       INTEGER DEFAULT 0,
  total_attempts      INTEGER DEFAULT 0,
  avg_response_time   REAL,
  round               INTEGER DEFAULT 1,
  consecutive_correct INTEGER DEFAULT 0,
  last_reviewed_at    TEXT,
  first_learned_at    TEXT,
  PRIMARY KEY (user_id, word_id)
);

-- 学习会话
CREATE TABLE IF NOT EXISTS sessions (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id         INTEGER NOT NULL REFERENCES users(id),
  start_time      TEXT DEFAULT (datetime('now')),
  end_time        TEXT,
  words_reviewed  INTEGER DEFAULT 0,
  words_passed    INTEGER DEFAULT 0,
  words_failed    INTEGER DEFAULT 0,
  duration_seconds INTEGER,
  round           INTEGER DEFAULT 1,
  status          TEXT DEFAULT 'active'
);

-- 答题日志
CREATE TABLE IF NOT EXISTS review_logs (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id           INTEGER NOT NULL REFERENCES users(id),
  word_id           INTEGER NOT NULL REFERENCES words(id),
  session_id        INTEGER REFERENCES sessions(id),
  correct           INTEGER NOT NULL,
  response_time_ms  INTEGER,
  quality           INTEGER NOT NULL,
  review_type       TEXT DEFAULT 'review',
  created_at        TEXT DEFAULT (datetime('now'))
);

-- 轮次完成记录
CREATE TABLE IF NOT EXISTS round_completions (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id         INTEGER NOT NULL REFERENCES users(id),
  round           INTEGER NOT NULL,
  completed_at    TEXT DEFAULT (datetime('now')),
  words_mastered  INTEGER,
  total_words     INTEGER,
  avg_proficiency REAL
);

-- 用户个性化设置
CREATE TABLE IF NOT EXISTS user_settings (
  user_id             INTEGER PRIMARY KEY REFERENCES users(id),
  new_words_per_session INTEGER DEFAULT 15,
  daily_goal          INTEGER DEFAULT 40,
  spelling_mode       INTEGER DEFAULT 0,
  first_letter_hint   INTEGER DEFAULT 1,
  choice_options      INTEGER DEFAULT 4,
  preview_before_learn INTEGER DEFAULT 1,
  daily_reminder      INTEGER DEFAULT 1,
  reminder_time       TEXT DEFAULT '20:00',
  new_word_mode       TEXT DEFAULT 'random'
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_user_words_next_review ON user_words(user_id, next_review);
CREATE INDEX IF NOT EXISTS idx_user_words_round ON user_words(user_id, round);
CREATE INDEX IF NOT EXISTS idx_user_words_proficiency ON user_words(user_id, proficiency);
CREATE INDEX IF NOT EXISTS idx_review_logs_user_word ON review_logs(user_id, word_id);
CREATE INDEX IF NOT EXISTS idx_review_logs_session ON review_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_review_logs_created ON review_logs(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id, start_time);
`

export function getDb(): Database.Database {
  if (!db) {
    const dbPath = process.env.DB_PATH || path.join(process.cwd(), 'data', 'cet4.db')
    const dbDir = path.dirname(dbPath)
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true })
    }
    db = new Database(dbPath)
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
  }
  return db
}

export function initDb(): void {
  const d = getDb()
  d.exec(SCHEMA_SQL)
}

export function isWordsEmpty(): boolean {
  const row = getDb().prepare('SELECT count(*) as cnt FROM words').get() as { cnt: number }
  return row.cnt === 0
}

// ─── Word queries ───────────────────────────────────

export function getWordCount(): number {
  const row = getDb().prepare('SELECT count(*) as cnt FROM words').get() as { cnt: number }
  return row.cnt
}

export function getWordById(id: number) {
  return getDb().prepare('SELECT * FROM words WHERE id = ?').get(id)
}

export function insertWord(word: string, phonetic: string | null, pos: string | null, chinese: string, englishDef: string | null): void {
  getDb().prepare(
    'INSERT OR IGNORE INTO words (word, phonetic, pos, chinese, english_def) VALUES (?, ?, ?, ?, ?)'
  ).run(word, phonetic, pos, chinese, englishDef)
}

export function insertWordsBatch(words: Array<{ word: string; phonetic: string | null; pos: string | null; chinese: string; englishDef: string | null }>): number {
  const insert = getDb().prepare(
    'INSERT OR IGNORE INTO words (word, phonetic, pos, chinese, english_def) VALUES (?, ?, ?, ?, ?)'
  )
  const tx = getDb().transaction((items: typeof words) => {
    let count = 0
    for (const w of items) {
      const result = insert.run(w.word, w.phonetic, w.pos, w.chinese, w.englishDef)
      if (result.changes > 0) count++
    }
    return count
  })
  return tx(words)
}

export function getAllWords(): any[] {
  return getDb().prepare('SELECT * FROM words ORDER BY id').all()
}

export function getWordByWord(word: string) {
  return getDb().prepare('SELECT * FROM words WHERE word = ?').get(word)
}

// ─── User queries ───────────────────────────────────

export function getUserByUsername(username: string): UserRow | undefined {
  const row = getDb().prepare('SELECT * FROM users WHERE username = ?').get(username)
  return row ? (row as UserRow) : undefined
}

export function getUserById(id: number): UserRow | undefined {
  const row = getDb().prepare('SELECT * FROM users WHERE id = ?').get(id)
  return row ? (row as UserRow) : undefined
}

export function createUser(username: string, passwordHash: string, isAdmin: number): number {
  const result = getDb().prepare(
    'INSERT INTO users (username, password_hash, is_admin) VALUES (?, ?, ?)'
  ).run(username, passwordHash, isAdmin)
  const userId = result.lastInsertRowid as number
  getDb().prepare(
    'INSERT OR IGNORE INTO user_settings (user_id) VALUES (?)'
  ).run(userId)
  return userId
}

export function getAllUsers() {
  return getDb().prepare('SELECT id, username, is_admin, frozen, created_at FROM users ORDER BY id').all()
}

export function searchUsers(query: string) {
  return getDb().prepare(
    'SELECT id, username, is_admin, frozen, created_at FROM users WHERE username LIKE ? ORDER BY id'
  ).all(`%${query}%`)
}

export function countAdminUsers(): number {
  const row = getDb().prepare('SELECT count(*) as cnt FROM users WHERE is_admin = 1').get() as { cnt: number }
  return row.cnt
}

export function updateUserPassword(userId: number, passwordHash: string): void {
  getDb().prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, userId)
}

export function setUserAdmin(userId: number, isAdmin: number): void {
  getDb().prepare('UPDATE users SET is_admin = ? WHERE id = ?').run(isAdmin, userId)
}

export function setUserFrozen(userId: number, frozen: number): void {
  getDb().prepare('UPDATE users SET frozen = ? WHERE id = ?').run(frozen, userId)
}

export function deleteUser(userId: number): void {
  const d = getDb()
  d.transaction(() => {
    d.prepare('DELETE FROM user_settings WHERE user_id = ?').run(userId)
    d.prepare('DELETE FROM review_logs WHERE user_id = ?').run(userId)
    d.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId)
    d.prepare('DELETE FROM round_completions WHERE user_id = ?').run(userId)
    d.prepare('DELETE FROM user_words WHERE user_id = ?').run(userId)
    d.prepare('DELETE FROM users WHERE id = ?').run(userId)
  })()
}

// ─── User_words (learning progress) queries ─────────

export function getUserWord(userId: number, wordId: number): UserWordRow | undefined {
  const row = getDb().prepare(
    'SELECT * FROM user_words WHERE user_id = ? AND word_id = ?'
  ).get(userId, wordId)
  return row ? (row as UserWordRow) : undefined
}

export function ensureUserWord(userId: number, wordId: number, round: number) {
  const existing = getUserWord(userId, wordId)
  if (!existing) {
    getDb().prepare(`
      INSERT INTO user_words (user_id, word_id, round, first_learned_at)
      VALUES (?, ?, ?, datetime('now'))
    `).run(userId, wordId, round)
    return getUserWord(userId, wordId)
  }
  return existing
}

export function updateUserWordAfterReview(
  userId: number, wordId: number,
  ef: number, intervalDays: number, repetitions: number,
  proficiency: number, nextReview: string,
  correct: boolean, responseTimeMs: number | null, round: number
): void {
  const record = getUserWord(userId, wordId)
  if (!record) {
    getDb().prepare(`
      INSERT INTO user_words (user_id, word_id, ef, interval_days, repetitions, proficiency, next_review,
        total_correct, total_attempts, avg_response_time, round, consecutive_correct, last_reviewed_at, first_learned_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, datetime('now'), datetime('now'))
    `).run(
      userId, wordId, ef, intervalDays, repetitions, proficiency, nextReview,
      correct ? 1 : 0,
      responseTimeMs ?? 0,
      round,
      correct ? 1 : 0
    )
    return
  }

  const newTotalCorrect = (record.total_correct || 0) + (correct ? 1 : 0)
  const newTotalAttempts = (record.total_attempts || 0) + 1
  const newConsecutive = correct ? (record.consecutive_correct || 0) + 1 : 0

  const oldAvg = record.avg_response_time || 0
  const newAvgRt = responseTimeMs
    ? Math.round((oldAvg * (newTotalAttempts - 1) + responseTimeMs) / newTotalAttempts)
    : oldAvg

  getDb().prepare(`
    UPDATE user_words SET
      ef = ?, interval_days = ?, repetitions = ?, proficiency = ?,
      next_review = ?, total_correct = ?, total_attempts = ?,
      avg_response_time = ?, consecutive_correct = ?, last_reviewed_at = datetime('now')
    WHERE user_id = ? AND word_id = ?
  `).run(
    ef, intervalDays, repetitions, proficiency,
    nextReview, newTotalCorrect, newTotalAttempts,
    newAvgRt, newConsecutive,
    userId, wordId
  )
}

export function getDueReviews(userId: number, round: number, limit: number = 50) {
  return getDb().prepare(`
    SELECT w.*, uw.* FROM words w
    JOIN user_words uw ON uw.word_id = w.id
    WHERE uw.user_id = ? AND uw.round = ?
      AND (uw.next_review IS NULL OR uw.next_review <= datetime('now'))
      AND uw.proficiency < 100
    ORDER BY uw.next_review ASC
    LIMIT ?
  `).all(userId, round, limit)
}

export function getNewWordsCount(userId: number, round: number): number {
  const row = getDb().prepare(`
    SELECT count(*) as cnt FROM words w
    WHERE w.id NOT IN (
      SELECT uw.word_id FROM user_words uw
      WHERE uw.user_id = ? AND uw.round = ?
    )
  `).get(userId, round) as { cnt: number }
  return row.cnt
}

export function getNewWords(userId: number, round: number, count: number, mode: 'random' | 'alpha' = 'random') {
  if (mode === 'alpha') {
    const lastLearned = getDb().prepare(`
      SELECT substr(w.word, 1, 1) AS initial FROM user_words uw
      JOIN words w ON w.id = uw.word_id
      WHERE uw.user_id = ? AND uw.round = ?
      ORDER BY w.word DESC LIMIT 1
    `).get(userId, round) as { initial: string } | undefined

    const currentInitial = lastLearned?.initial?.[0]?.toUpperCase() ?? 'A'

    return getDb().prepare(`
      SELECT w.* FROM words w
      WHERE w.id NOT IN (
        SELECT uw.word_id FROM user_words uw
        WHERE uw.user_id = ? AND uw.round = ?
      )
      ORDER BY
        CASE
          WHEN substr(upper(w.word), 1, 1) < ? THEN 1
          WHEN substr(upper(w.word), 1, 1) = ? THEN 0
          ELSE 2
        END,
        w.word,
        RANDOM()
      LIMIT ?
    `).all(userId, round, currentInitial, currentInitial, count)
  }

  return getDb().prepare(`
    SELECT w.* FROM words w
    WHERE w.id NOT IN (
      SELECT uw.word_id FROM user_words uw
      WHERE uw.user_id = ? AND uw.round = ?
    )
    ORDER BY RANDOM()
    LIMIT ?
  `).all(userId, round, count)
}

export function getNewWordsForTest(userId: number, round: number) {
  return getDb().prepare(`
    SELECT w.*, uw.* FROM words w
    JOIN user_words uw ON uw.word_id = w.id
    WHERE uw.user_id = ? AND uw.round = ?
    ORDER BY uw.first_learned_at DESC
  `).all(userId, round)
}

export function getLearnedWordsInRound(userId: number, round: number) {
  return getDb().prepare(`
    SELECT w.*, uw.* FROM words w
    JOIN user_words uw ON uw.word_id = w.id
    WHERE uw.user_id = ? AND uw.round = ?
    ORDER BY w.word
  `).all(userId, round)
}

export function getRoundStats(userId: number, round: number) {
  const row = getDb().prepare(`
    SELECT
      count(*) as total_words,
      sum(CASE WHEN uw.proficiency >= 90 THEN 1 ELSE 0 END) as mastered_words,
      avg(uw.proficiency) as avg_proficiency
    FROM user_words uw
    WHERE uw.user_id = ? AND uw.round = ?
  `).get(userId, round) as { total_words: number; mastered_words: number; avg_proficiency: number | null }
  return row
}

// ─── Session queries ────────────────────────────────

export function createSession(userId: number, round: number): number {
  const result = getDb().prepare(
    'INSERT INTO sessions (user_id, round) VALUES (?, ?)'
  ).run(userId, round)
  return result.lastInsertRowid as number
}

export function getActiveSession(userId: number) {
  return getDb().prepare(
    "SELECT * FROM sessions WHERE user_id = ? AND status = 'active' ORDER BY start_time DESC LIMIT 1"
  ).get(userId)
}

export function completeSession(sessionId: number, wordsReviewed: number, wordsPassed: number, wordsFailed: number, durationSeconds: number): void {
  getDb().prepare(`
    UPDATE sessions SET
      status = 'completed', end_time = datetime('now'),
      words_reviewed = ?, words_passed = ?, words_failed = ?, duration_seconds = ?
    WHERE id = ?
  `).run(wordsReviewed, wordsPassed, wordsFailed, durationSeconds, sessionId)
}

// ─── Review log queries ─────────────────────────────

export function insertReviewLog(
  userId: number, wordId: number, sessionId: number | null,
  correct: number, responseTimeMs: number | null, quality: number,
  reviewType: string
): void {
  getDb().prepare(`
    INSERT INTO review_logs (user_id, word_id, session_id, correct, response_time_ms, quality, review_type)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(userId, wordId, sessionId, correct, responseTimeMs, quality, reviewType)
}

export function getReviewHistory(userId: number, wordId: number, limit: number = 10) {
  return getDb().prepare(`
    SELECT * FROM review_logs
    WHERE user_id = ? AND word_id = ?
    ORDER BY created_at DESC
    LIMIT ?
  `).all(userId, wordId, limit)
}

export function getRecentActivity(userId: number, days: number = 30) {
  return getDb().prepare(`
    SELECT date(created_at) as date, count(*) as count
    FROM review_logs
    WHERE user_id = ? AND created_at >= datetime('now', ?)
    GROUP BY date(created_at)
    ORDER BY date ASC
  `).all(userId, `-${days} days`)
}

// ─── Settings queries ───────────────────────────────

export function getUserSettings(userId: number) {
  let settings = getDb().prepare('SELECT * FROM user_settings WHERE user_id = ?').get(userId) as any
  if (!settings) {
    getDb().prepare('INSERT INTO user_settings (user_id) VALUES (?)').run(userId)
    settings = getDb().prepare('SELECT * FROM user_settings WHERE user_id = ?').get(userId)
  }
  return settings
}

export function updateUserSettings(userId: number, updates: Record<string, any>): void {
  const allowed = [
    'new_words_per_session', 'daily_goal', 'spelling_mode',
    'first_letter_hint', 'choice_options', 'preview_before_learn',
    'daily_reminder', 'reminder_time'
  ]
  const setClauses: string[] = []
  const values: any[] = []
  for (const [key, val] of Object.entries(updates)) {
    if (allowed.includes(key)) {
      setClauses.push(`${key} = ?`)
      values.push(val)
    }
  }
  if (setClauses.length === 0) return
  values.push(userId)
  getDb().prepare(`UPDATE user_settings SET ${setClauses.join(', ')} WHERE user_id = ?`).run(...values)
}

// ─── Round completion queries ───────────────────────

export function recordRoundCompletion(userId: number, round: number, wordsMastered: number, totalWords: number, avgProficiency: number): void {
  getDb().prepare(`
    INSERT INTO round_completions (user_id, round, words_mastered, total_words, avg_proficiency)
    VALUES (?, ?, ?, ?, ?)
  `).run(userId, round, wordsMastered, totalWords, avgProficiency)
}

export function getRoundCompletions(userId: number) {
  return getDb().prepare(
    'SELECT * FROM round_completions WHERE user_id = ? ORDER BY round ASC'
  ).all(userId)
}

// ─── Public stats (guest page) ──────────────────────

export function getPublicStats() {
  const totalUsers = (getDb().prepare('SELECT count(*) as cnt FROM users').get() as any).cnt
  const activeUsers = (getDb().prepare(
    "SELECT count(DISTINCT user_id) as cnt FROM sessions WHERE start_time >= datetime('now', '-7 days')"
  ).get() as any).cnt
  const totalWords = (getDb().prepare('SELECT count(*) as cnt FROM words').get() as any).cnt
  const totalMastered = (getDb().prepare(
    'SELECT COALESCE(sum(CASE WHEN proficiency >= 90 THEN 1 ELSE 0 END), 0) as cnt FROM user_words'
  ).get() as any).cnt
  const totalSessions = (getDb().prepare('SELECT count(*) as cnt FROM sessions').get() as any).cnt

  const topLearners = getDb().prepare(`
    SELECT u.username,
      COALESCE(uw.mastered, 0) as mastered,
      COALESCE(uw.avg_prof, 0) as proficiency
    FROM users u
    LEFT JOIN (
      SELECT user_id,
        sum(CASE WHEN proficiency >= 90 THEN 1 ELSE 0 END) as mastered,
        avg(proficiency) as avg_prof
      FROM user_words GROUP BY user_id
    ) uw ON uw.user_id = u.id
    ORDER BY mastered DESC
    LIMIT 5
  `).all()

  const recentActivity = getDb().prepare(`
    SELECT date(created_at) as date, count(*) as count
    FROM review_logs
    WHERE created_at >= datetime('now', '-7 days')
    GROUP BY date(created_at)
    ORDER BY date ASC
  `).all()

  return { totalUsers, activeUsers, totalWords, totalMastered, totalSessions, topLearners, recentActivity }
}

// ─── Overall progress ──────────────────────────────

export function getUserProgress(userId: number) {
  const stats = getDb().prepare(`
    SELECT
      COALESCE(avg(proficiency), 0) as avg_proficiency,
      COALESCE(sum(CASE WHEN proficiency >= 90 THEN 1 ELSE 0 END), 0) as mastered,
      count(*) as learned_count
    FROM user_words WHERE user_id = ?
  `).get(userId) as any

  const totalWords = getWordCount()
  const rounds = getDb().prepare(`
    SELECT round,
      CASE WHEN round = (SELECT COALESCE(max(round), 0) FROM user_words WHERE user_id = ?)
        THEN round_learned ELSE total END as progress
    FROM (
      SELECT uw.round,
        count(*) as round_learned,
        (SELECT count(*) FROM words) as total
      FROM user_words uw
      WHERE uw.user_id = ?
      GROUP BY uw.round
    )
    ORDER BY round ASC
  `).all(userId, userId)

  const heatmapData = getRecentActivity(userId, 30)

  const reviewLogs = getDb().prepare(`
    SELECT avg(response_time_ms) as avg_time
    FROM review_logs WHERE user_id = ? AND response_time_ms IS NOT NULL
  `).get(userId) as any

  const avgResponseTime = reviewLogs?.avg_time ? Math.round(reviewLogs.avg_time / 1000 * 10) / 10 : 0

  const daysSinceFirst = getDb().prepare(`
    SELECT COALESCE(
      julianday('now') - julianday(min(created_at)), 0
    ) as days FROM review_logs WHERE user_id = ?
  `).get(userId) as any

  const studyDays = daysSinceFirst ? Math.max(1, Math.round(daysSinceFirst.days)) : 1

  // proficiency distribution
  const distribution = getDb().prepare(`
    SELECT
      sum(CASE WHEN proficiency = 0 THEN 1 ELSE 0 END) as lv0,
      sum(CASE WHEN proficiency BETWEEN 1 AND 25 THEN 1 ELSE 0 END) as lv1,
      sum(CASE WHEN proficiency BETWEEN 26 AND 50 THEN 1 ELSE 0 END) as lv2,
      sum(CASE WHEN proficiency BETWEEN 51 AND 75 THEN 1 ELSE 0 END) as lv3,
      sum(CASE WHEN proficiency BETWEEN 76 AND 89 THEN 1 ELSE 0 END) as lv4,
      sum(CASE WHEN proficiency >= 90 THEN 1 ELSE 0 END) as lv5
    FROM user_words WHERE user_id = ?
  `).get(userId) as any

  return {
    proficiency: Math.round(stats.avg_proficiency),
    mastered: stats.mastered,
    total: totalWords,
    avgProficiency: Math.round(stats.avg_proficiency),
    avgResponseTime,
    studyDays,
    rounds,
    heatmapData,
    distribution
  }
}

// ─── Today's learn task ─────────────────────────────

export function getTodayTask(userId: number, round: number, newWordsPerSession: number) {
  const reviewCount = (getDb().prepare(`
    SELECT count(*) as cnt FROM user_words
    WHERE user_id = ? AND round = ?
      AND next_review IS NOT NULL AND next_review <= datetime('now')
      AND proficiency < 100
  `).get(userId, round) as any).cnt

  const newWordsCount = getNewWordsCount(userId, round)
  const newWords = Math.min(newWordsPerSession, newWordsCount)

  const todaySessions = (getDb().prepare(`
    SELECT count(*) as cnt FROM sessions
    WHERE user_id = ? AND date(start_time) = date('now')
  `).get(userId) as any).cnt

  // Calculate estimated minutes
  const reviewTime = Math.round(reviewCount * 12 / 60)
  const newTime = Math.round(newWords * 30 / 60)
  const testWords = reviewCount + newWords
  const testTime = Math.round(testWords * 12 / 60)
  const estimatedMinutes = reviewTime + newTime + testTime + 3

  return {
    reviewCount,
    newWords,
    estimatedMinutes,
    round,
    day: todaySessions + 1,
  }
}
