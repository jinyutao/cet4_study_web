/**
 * Test seed: 50 words + test user. Called by: bash start.sh test
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), 'data', 'cet4_test.db')

interface WordEntry {
  word: string
  phonetic: string | null
  pos: string | null
  chinese: string
  englishDef: string | null
}

function parseMarkdownTable(content: string, limit: number): WordEntry[] {
  const lines = content.split('\n')
  const words: WordEntry[] = []

  for (const line of lines) {
    if (words.length >= limit) break

    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('| #') || trimmed.startsWith('|---') || trimmed.startsWith('---')) {
      continue
    }
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      const cells = trimmed.slice(1, -1).split('|').map(c => c.trim())
      if (cells.length >= 5) {
        const word = cells[1]
        const phonetic = cells[2] || null
        const pos = cells[3] || null
        const chinese = cells[4]
        const englishDef = cells.length >= 6 ? cells[5] : null

        if (word && !word.includes('-') && !/^\d+$/.test(word)) {
          const cleanEnglishDef = englishDef && englishDef !== '-' && englishDef !== ''
            ? englishDef.replace(/&#039;/g, "'").replace(/&amp;/g, '&')
            : null
          const cleanPhonetic = phonetic && phonetic.startsWith('[') ? phonetic : null
          words.push({ word, phonetic: cleanPhonetic, pos: pos || null, chinese, englishDef: cleanEnglishDef })
        }
      }
    }
  }
  return words
}

function main(): void {
  const markdownPath = path.join(__dirname, '../../ref/CET4_词汇表_精简版.md')

  console.log(`读取词汇表: ${markdownPath}`)
  const content = fs.readFileSync(markdownPath, 'utf-8')

  console.log('解析词汇表（取前 50 词）...')
  const entries = parseMarkdownTable(content, 50)
  console.log(`解析到 ${entries.length} 个单词`)

  if (entries.length === 0) {
    console.error('错误: 未解析到任何单词')
    process.exit(1)
  }

  const Database = require('better-sqlite3')
  const dbDir = path.dirname(DB_PATH)
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true })
  }

  if (fs.existsSync(DB_PATH)) {
    fs.unlinkSync(DB_PATH)
    console.log(`已删除旧测试数据库: ${DB_PATH}`)
  }

  const db = new Database(DB_PATH)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  db.exec(`
    CREATE TABLE IF NOT EXISTS words (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      word        TEXT NOT NULL UNIQUE,
      phonetic    TEXT,
      pos         TEXT,
      chinese     TEXT NOT NULL,
      english_def TEXT
    );
    CREATE TABLE IF NOT EXISTS users (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      username        TEXT NOT NULL UNIQUE,
      password_hash   TEXT NOT NULL,
      is_admin        INTEGER DEFAULT 0,
      frozen          INTEGER DEFAULT 0,
      created_at      TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS user_settings (
      user_id             INTEGER PRIMARY KEY REFERENCES users(id),
      new_words_per_session INTEGER DEFAULT 15,
      daily_goal          INTEGER DEFAULT 40,
      spelling_mode       INTEGER DEFAULT 0,
      first_letter_hint   INTEGER DEFAULT 1,
      choice_options      INTEGER DEFAULT 4,
      preview_before_learn INTEGER DEFAULT 1,
      daily_reminder      INTEGER DEFAULT 1,
      reminder_time       TEXT DEFAULT '20:00'
    );
  `)

  const insertWord = db.prepare(
    'INSERT OR IGNORE INTO words (word, phonetic, pos, chinese, english_def) VALUES (?, ?, ?, ?, ?)'
  )
  const tx = db.transaction((items: WordEntry[]) => {
    let count = 0
    for (const w of items) {
      const result = insertWord.run(w.word, w.phonetic, w.pos, w.chinese, w.englishDef)
      if (result.changes > 0) count++
    }
    return count
  })
  const inserted = tx(entries)
  console.log(`成功插入 ${inserted} 个单词`)

  const passwordHash = '$2b$10$8K1p/a0dL1LXMIgoEDFrwOfMQkfAjkMBcGm7m.OJOKN1iCTH.8X.q'
  const createUser = db.prepare(
    'INSERT OR IGNORE INTO users (username, password_hash, is_admin) VALUES (?, ?, ?)'
  )
  createUser.run('test', passwordHash, 1)
  createUser.run('admin', passwordHash, 1)

  const insertSettings = db.prepare(
    'INSERT OR IGNORE INTO user_settings (user_id) VALUES (?)'
  )
  const users = db.prepare('SELECT id FROM users').all() as { id: number }[]
  for (const u of users) {
    insertSettings.run(u.id)
  }

  db.close()

  const verifyDb = new Database(DB_PATH)
  const wordCount = (verifyDb.prepare('SELECT count(*) as cnt FROM words').get() as { cnt: number }).cnt
  const userCount = (verifyDb.prepare('SELECT count(*) as cnt FROM users').get() as { cnt: number }).cnt
  verifyDb.close()

  console.log(`✅ 测试数据库已创建: ${DB_PATH}`)
  console.log(`   ${wordCount} 个单词, ${userCount} 个用户`)
  console.log(`   测试账号: test / test123 (管理员)`)
  console.log(`   测试账号: admin / test123 (管理员)`)
  console.log('')
  console.log('启动测试服务: bash start.sh test')
}

main()
