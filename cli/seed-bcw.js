#!/usr/bin/env node
import Database from 'better-sqlite3'
import bcrypt from 'bcryptjs'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../data/cet4_test_bcw.db')
const MARKDOWN_PATH = path.join(__dirname, '../ref/CET4_词汇表_精简版.md')

const LIMIT = 50
const FILTER = new Set(['B', 'C', 'W'])
const PER_LETTER = { B: 17, C: 17, W: 16 }

const dbDir = path.dirname(DB_PATH)
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true })
if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH)

const db = new Database(DB_PATH)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

db.exec(`
  CREATE TABLE IF NOT EXISTS words (
    id INTEGER PRIMARY KEY AUTOINCREMENT, word TEXT NOT NULL UNIQUE,
    phonetic TEXT, pos TEXT, chinese TEXT NOT NULL, english_def TEXT
  );
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL, is_admin INTEGER DEFAULT 0,
    frozen INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS user_words (
    user_id INTEGER NOT NULL REFERENCES users(id),
    word_id INTEGER NOT NULL REFERENCES words(id),
    ef REAL DEFAULT 2.5, interval_days INTEGER DEFAULT 0,
    repetitions INTEGER DEFAULT 0, proficiency INTEGER DEFAULT 0,
    next_review TEXT, total_correct INTEGER DEFAULT 0,
    total_attempts INTEGER DEFAULT 0, avg_response_time REAL,
    round INTEGER DEFAULT 1, consecutive_correct INTEGER DEFAULT 0,
    last_reviewed_at TEXT, first_learned_at TEXT,
    PRIMARY KEY (user_id, word_id)
  );
  CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id),
    start_time TEXT DEFAULT (datetime('now')), end_time TEXT,
    words_reviewed INTEGER DEFAULT 0, words_passed INTEGER DEFAULT 0,
    words_failed INTEGER DEFAULT 0, duration_seconds INTEGER,
    round INTEGER DEFAULT 1, status TEXT DEFAULT 'active'
  );
  CREATE TABLE IF NOT EXISTS review_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id),
    word_id INTEGER NOT NULL REFERENCES words(id), session_id INTEGER REFERENCES sessions(id),
    correct INTEGER NOT NULL, response_time_ms INTEGER, quality INTEGER NOT NULL,
    review_type TEXT DEFAULT 'review', created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS round_completions (
    id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id),
    round INTEGER NOT NULL, completed_at TEXT DEFAULT (datetime('now')),
    words_mastered INTEGER, total_words INTEGER, avg_proficiency REAL
  );
  CREATE TABLE IF NOT EXISTS user_settings (
    user_id INTEGER PRIMARY KEY REFERENCES users(id),
    new_words_per_session INTEGER DEFAULT 15, daily_goal INTEGER DEFAULT 40,
    spelling_mode INTEGER DEFAULT 0, first_letter_hint INTEGER DEFAULT 1,
    choice_options INTEGER DEFAULT 4, preview_before_learn INTEGER DEFAULT 1,
    daily_reminder INTEGER DEFAULT 1, reminder_time TEXT DEFAULT '20:00'
  );
  CREATE INDEX IF NOT EXISTS idx_user_words_next_review ON user_words(user_id, next_review);
  CREATE INDEX IF NOT EXISTS idx_review_logs_created ON review_logs(user_id, created_at);
`)

if (!fs.existsSync(MARKDOWN_PATH)) {
  console.error(`错误: 找不到词汇表文件 ${MARKDOWN_PATH}`)
  process.exit(1)
}

const content = fs.readFileSync(MARKDOWN_PATH, 'utf-8')
const lines = content.split('\n')
const picked = { B: [], C: [], W: [] }

for (const line of lines) {
  const trimmed = line.trim()
  if (!trimmed || !trimmed.startsWith('|') || !trimmed.endsWith('|')) continue
  const cells = trimmed.slice(1, -1).split('|').map(c => c.trim())
  if (cells.length < 5) continue
  const word = cells[1]
  if (!word || word.includes('-') || /^\d+$/.test(word)) continue
  const first = word[0].toUpperCase()
  if (!FILTER.has(first)) continue

  const phonetic = cells[2] || null
  const pos = cells[3] || null
  const chinese = cells[4]
  const englishDef = cells.length >= 6 ? cells[5] : null
  const cleanEnglishDef = englishDef && englishDef !== '-' && englishDef !== ''
    ? englishDef.replace(/&#039;/g, "'").replace(/&amp;/g, '&')
    : null
  const cleanPhonetic = phonetic && phonetic.startsWith('[') ? phonetic : null

  const quota = PER_LETTER[first]
  if (picked[first].length < quota) {
    picked[first].push({ word, phonetic: cleanPhonetic, pos: pos || null, chinese, englishDef: cleanEnglishDef })
  }
}

const entries = Object.values(picked).flat()
for (const w of entries) {
  const letter = w.word[0].toUpperCase()
  console.log(`  ${letter.padEnd(2)} ${w.word.padEnd(20)} ${(w.chinese || '').slice(0, 30)}`)
}

const insertWord = db.prepare(
  'INSERT OR IGNORE INTO words (word, phonetic, pos, chinese, english_def) VALUES (?, ?, ?, ?, ?)'
)

const inserted = db.transaction(() => {
  let count = 0
  for (const w of entries) {
    if (insertWord.run(w.word, w.phonetic, w.pos, w.chinese, w.englishDef).changes > 0) count++
  }
  return count
})()

console.log(`\n成功插入 ${inserted} 个单词`)

const hash = bcrypt.hashSync('test123', 10)
const createUser = db.prepare(
  'INSERT OR IGNORE INTO users (username, password_hash, is_admin) VALUES (?, ?, ?)'
)
createUser.run('test', hash, 1)
createUser.run('admin', hash, 1)

const insertSettings = db.prepare(
  'INSERT OR IGNORE INTO user_settings (user_id) VALUES (?)'
)
for (const u of db.prepare('SELECT id FROM users').all()) insertSettings.run(u.id)

db.close()

const verifyDb = new Database(DB_PATH)
const wordCount = verifyDb.prepare('SELECT count(*) as cnt FROM words').get().cnt
const bcCount = verifyDb.prepare("SELECT count(*) as cnt FROM words WHERE substr(upper(word),1,1)='B'").get().cnt
const ccCount = verifyDb.prepare("SELECT count(*) as cnt FROM words WHERE substr(upper(word),1,1)='C'").get().cnt
const wcCount = verifyDb.prepare("SELECT count(*) as cnt FROM words WHERE substr(upper(word),1,1)='W'").get().cnt
verifyDb.close()

console.log(`\n✅ 测试数据库已创建: ${DB_PATH}`)
console.log(`   ${wordCount} 个单词 (B:${bcCount}  C:${ccCount}  W:${wcCount})`)
console.log(`   测试账号: test / test123 (管理员)`)
console.log(`   测试账号: admin / test123 (管理员)`)
