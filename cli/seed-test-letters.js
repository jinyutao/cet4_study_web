#!/usr/bin/env node
import Database from 'better-sqlite3'
import bcrypt from 'bcryptjs'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../data/cet4_test_afjz.db')
const MARKDOWN_PATH = path.join(__dirname, '../ref/CET4_词汇表_精简版.md')

const FILTER_LETTERS = new Set(['A', 'F', 'J', 'Z'])

// --- parse markdown and filter by first letter ---
function parseAndFilter(content) {
  const lines = content.split('\n')
  const words = []
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || !trimmed.startsWith('|') || !trimmed.endsWith('|')) continue
    const cells = trimmed.slice(1, -1).split('|').map(c => c.trim())
    if (cells.length < 5) continue
    const word = cells[1]
    if (!word || word.includes('-') || /^\d+$/.test(word)) continue
    const first = word[0].toUpperCase()
    if (!FILTER_LETTERS.has(first)) continue

    const phonetic = cells[2] || null
    const pos = cells[3] || null
    const chinese = cells[4]
    const englishDef = cells.length >= 6 ? cells[5] : null
    const cleanEnglishDef = englishDef && englishDef !== '-' && englishDef !== ''
      ? englishDef.replace(/&#039;/g, "'").replace(/&amp;/g, '&')
      : null
    const cleanPhonetic = phonetic && phonetic.startsWith('[') ? phonetic : null
    words.push({ word, phonetic: cleanPhonetic, pos: pos || null, chinese, englishDef: cleanEnglishDef })
  }
  return words
}

// --- DB setup ---
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
  CREATE TABLE IF NOT EXISTS user_settings (
    user_id INTEGER PRIMARY KEY REFERENCES users(id),
    new_words_per_session INTEGER DEFAULT 15, daily_goal INTEGER DEFAULT 40,
    spelling_mode INTEGER DEFAULT 0, first_letter_hint INTEGER DEFAULT 1,
    choice_options INTEGER DEFAULT 4, preview_before_learn INTEGER DEFAULT 1,
    daily_reminder INTEGER DEFAULT 1, reminder_time TEXT DEFAULT '20:00'
  );
`)

// --- parse and insert ---
if (!fs.existsSync(MARKDOWN_PATH)) {
  console.error(`错误: 找不到词汇表文件 ${MARKDOWN_PATH}`)
  process.exit(1)
}

const content = fs.readFileSync(MARKDOWN_PATH, 'utf-8')
const entries = parseAndFilter(content)
console.log(`解析到 ${entries.length} 个单词 (A/F/J/Z 开头)`)

const insertWord = db.prepare(
  'INSERT OR IGNORE INTO words (word, phonetic, pos, chinese, english_def) VALUES (?, ?, ?, ?, ?)'
)

const tx = db.transaction(() => {
  let count = 0
  for (const w of entries) {
    if (insertWord.run(w.word, w.phonetic, w.pos, w.chinese, w.englishDef).changes > 0) count++
  }
  return count
})

const inserted = tx()
console.log(`成功插入 ${inserted} 个单词`)

// --- users ---
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

// --- verify ---
const verifyDb = new Database(DB_PATH)
const wordCount = verifyDb.prepare('SELECT count(*) as cnt FROM words').get().cnt
const userCount = verifyDb.prepare('SELECT count(*) as cnt FROM users').get().cnt
verifyDb.close()

console.log(`\n✅ 测试数据库已创建: ${DB_PATH}`)
console.log(`   ${wordCount} 个单词 (A/F/J/Z 开头), ${userCount} 个用户`)
console.log(`   测试账号: test / test123 (管理员)`)
console.log(`   测试账号: admin / test123 (管理员)`)
console.log(`   单词分布: A=*, F=*, J=*, Z=*`)
