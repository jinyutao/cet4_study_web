import { beforeAll, afterAll } from 'vitest'
import path from 'path'
import fs from 'fs'
import os from 'os'
import express from 'express'
import bcrypt from 'bcryptjs'
import Database from 'better-sqlite3'
import type { Database as DatabaseType } from 'better-sqlite3'

// ── Test database path ──────────────────────────────
const TEST_DB_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'cet4-test-'))
const TEST_DB_PATH = path.join(TEST_DB_DIR, 'test.db')

// Override DB_PATH before any module imports touch it
process.env.DB_PATH = TEST_DB_PATH
process.env.JWT_SECRET = 'test-secret-key-for-unit-tests'

// ── Database reference (shared) ─────────────────────
let testDb: DatabaseType

// ── Schema SQL (same as production) ─────────────────
const SCHEMA_SQL = `
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

CREATE TABLE IF NOT EXISTS round_completions (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id         INTEGER NOT NULL REFERENCES users(id),
  round           INTEGER NOT NULL,
  completed_at    TEXT DEFAULT (datetime('now')),
  words_mastered  INTEGER,
  total_words     INTEGER,
  avg_proficiency REAL
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
  reminder_time       TEXT DEFAULT '20:00',
  new_word_mode       TEXT DEFAULT 'random'
);
`

// ── Test word seed data (50 common CET-4 words) ─────
const SEED_WORDS: Array<{ word: string; phonetic: string | null; pos: string | null; chinese: string }> = [
  { word: 'abandon', phonetic: '/əˈbændən/', pos: 'v.', chinese: '放弃；遗弃' },
  { word: 'ability', phonetic: '/əˈbɪləti/', pos: 'n.', chinese: '能力；才能' },
  { word: 'abroad', phonetic: '/əˈbrɔːd/', pos: 'adv.', chinese: '在国外；到国外' },
  { word: 'absence', phonetic: '/ˈæbsəns/', pos: 'n.', chinese: '缺席；不在' },
  { word: 'absolute', phonetic: '/ˈæbsəluːt/', pos: 'adj.', chinese: '绝对的；完全的' },
  { word: 'absorb', phonetic: '/əbˈzɔːb/', pos: 'v.', chinese: '吸收；吸引' },
  { word: 'abstract', phonetic: '/ˈæbstrækt/', pos: 'adj.', chinese: '抽象的；深奥的' },
  { word: 'abundant', phonetic: '/əˈbʌndənt/', pos: 'adj.', chinese: '丰富的；充裕的' },
  { word: 'academic', phonetic: '/ˌækəˈdemɪk/', pos: 'adj.', chinese: '学术的；学院的' },
  { word: 'accelerate', phonetic: '/əkˈseləreɪt/', pos: 'v.', chinese: '加速；促进' },
  { word: 'access', phonetic: '/ˈækses/', pos: 'n.', chinese: '进入；通路' },
  { word: 'accompany', phonetic: '/əˈkʌmpəni/', pos: 'v.', chinese: '陪伴；伴随' },
  { word: 'accomplish', phonetic: '/əˈkʌmplɪʃ/', pos: 'v.', chinese: '完成；实现' },
  { word: 'account', phonetic: '/əˈkaʊnt/', pos: 'n.', chinese: '账户；描述' },
  { word: 'accurate', phonetic: '/ˈækjərət/', pos: 'adj.', chinese: '准确的；精确的' },
  { word: 'achieve', phonetic: '/əˈtʃiːv/', pos: 'v.', chinese: '达到；取得' },
  { word: 'acknowledge', phonetic: '/əkˈnɒlɪdʒ/', pos: 'v.', chinese: '承认；致谢' },
  { word: 'acquire', phonetic: '/əˈkwaɪə/', pos: 'v.', chinese: '获得；学到' },
  { word: 'adapt', phonetic: '/əˈdæpt/', pos: 'v.', chinese: '适应；改编' },
  { word: 'adequate', phonetic: '/ˈædɪkwət/', pos: 'adj.', chinese: '足够的；适当的' },
  { word: 'bargain', phonetic: '/ˈbɑːɡɪn/', pos: 'n.', chinese: '廉价货；交易' },
  { word: 'barrier', phonetic: '/ˈbæriə/', pos: 'n.', chinese: '障碍；屏障' },
  { word: 'behave', phonetic: '/bɪˈheɪv/', pos: 'v.', chinese: '表现；举止' },
  { word: 'benefit', phonetic: '/ˈbenɪfɪt/', pos: 'n.', chinese: '利益；好处' },
  { word: 'campus', phonetic: '/ˈkæmpəs/', pos: 'n.', chinese: '校园' },
  { word: 'cancel', phonetic: '/ˈkænsl/', pos: 'v.', chinese: '取消；废除' },
  { word: 'capable', phonetic: '/ˈkeɪpəbl/', pos: 'adj.', chinese: '有能力的' },
  { word: 'capture', phonetic: '/ˈkæptʃə/', pos: 'v.', chinese: '捕获；夺取' },
  { word: 'challenge', phonetic: '/ˈtʃælɪndʒ/', pos: 'n.', chinese: '挑战' },
  { word: 'character', phonetic: '/ˈkærəktə/', pos: 'n.', chinese: '性格；特征；角色' },
  { word: 'debate', phonetic: '/dɪˈbeɪt/', pos: 'n.', chinese: '辩论；争论' },
  { word: 'declare', phonetic: '/dɪˈkleə/', pos: 'v.', chinese: '宣布；声明' },
  { word: 'decline', phonetic: '/dɪˈklaɪn/', pos: 'v.', chinese: '下降；拒绝' },
  { word: 'deliver', phonetic: '/dɪˈlɪvə/', pos: 'v.', chinese: '递送；发表' },
  { word: 'demonstrate', phonetic: '/ˈdemənstreɪt/', pos: 'v.', chinese: '证明；演示' },
  { word: 'evaluate', phonetic: '/ɪˈvæljueɪt/', pos: 'v.', chinese: '评估；评价' },
  { word: 'evidence', phonetic: '/ˈevɪdəns/', pos: 'n.', chinese: '证据；迹象' },
  { word: 'examine', phonetic: '/ɪɡˈzæmɪn/', pos: 'v.', chinese: '检查；考试' },
  { word: 'exchange', phonetic: '/ɪksˈtʃeɪndʒ/', pos: 'v.', chinese: '交换；兑换' },
  { word: 'familiar', phonetic: '/fəˈmɪliə/', pos: 'adj.', chinese: '熟悉的' },
  { word: 'generate', phonetic: '/ˈdʒenəreɪt/', pos: 'v.', chinese: '产生；生成' },
  { word: 'genuine', phonetic: '/ˈdʒenjuɪn/', pos: 'adj.', chinese: '真正的；真诚的' },
  { word: 'gradual', phonetic: '/ˈɡrædʒuəl/', pos: 'adj.', chinese: '逐渐的' },
  { word: 'identify', phonetic: '/aɪˈdentɪfaɪ/', pos: 'v.', chinese: '识别；确认' },
  { word: 'illustrate', phonetic: '/ˈɪləstreɪt/', pos: 'v.', chinese: '说明；阐明' },
  { word: 'journey', phonetic: '/ˈdʒɜːni/', pos: 'n.', chinese: '旅行；行程' },
  { word: 'justify', phonetic: '/ˈdʒʌstɪfaɪ/', pos: 'v.', chinese: '证明…正当' },
  { word: 'knowledge', phonetic: '/ˈnɒlɪdʒ/', pos: 'n.', chinese: '知识；学问' },
  { word: 'landscape', phonetic: '/ˈlændskeɪp/', pos: 'n.', chinese: '风景；景色' },
  { word: 'launch', phonetic: '/lɔːntʃ/', pos: 'v.', chinese: '发射；发起' },
]

const SALT_ROUNDS = 10

// ── Setup: runs once before all tests ───────────────
beforeAll(() => {
  testDb = new Database(TEST_DB_PATH)
  testDb.pragma('journal_mode = WAL')
  testDb.pragma('foreign_keys = ON')
  testDb.exec(SCHEMA_SQL)

  // Seed words
  const insertWord = testDb.prepare(
    'INSERT OR IGNORE INTO words (word, phonetic, pos, chinese) VALUES (?, ?, ?, ?)'
  )
  for (const w of SEED_WORDS) {
    insertWord.run(w.word, w.phonetic, w.pos, w.chinese)
  }
})

afterAll(() => {
  if (testDb) {
    testDb.close()
  }
  // Clean up temp directory
  try {
    fs.rmSync(TEST_DB_DIR, { recursive: true, force: true })
  } catch {
    // ignore cleanup errors
  }
})

export { TEST_DB_DIR, TEST_DB_PATH }
