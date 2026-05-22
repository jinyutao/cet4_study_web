#!/usr/bin/env node
import Database from 'better-sqlite3'
import bcrypt from 'bcryptjs'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../data/cet4_test.db')
const dbDir = path.dirname(DB_PATH)
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true })

// 注意：Express 容器启动时已经创建了同路径数据库（包含完整 schema），
// 这里只打开已有数据库，不删除文件，避免 Express 持有的旧文件句柄看不到新数据。
const db = new Database(DB_PATH)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

// 确保 schema 存在（Express 已经创建了，这里做幂等保护）
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
`);

const words = [
  ["a", null, "art", "一(个)；每一(个)", null],
  ["abandon", "[əˈbændən]", "vt", "丢弃；放弃，抛弃", null],
  ["ability", "[əˈbiliti]", "n", "能力；能耐，本领", "the quality of having the means or skills to do something"],
  ["able", "[ˈeibl]", "a", "有能力的；出色的", "having the necessary means or skill to do something"],
  ["abnormal", "[æbˈnɔːməl]", "a", "不正常的；变态的", "not typical or usual or regular"],
  ["aboard", "[əˈbɔːd]", "ad", "在船(车)上；上船", "on a ship, train, plane or other vehicle"],
  ["about", "[ˈəbaut]", "prep", "关于；在…周围", null],
  ["above", "[əˈbʌv]", "prep", "在…上面；高于", null],
  ["abroad", "[əˈbrɔːd]", "ad", "(在)国外；到处", "to or in a foreign country"],
  ["absence", "[ˈæbsəns]", "n", "缺席，不在场；缺乏", "the state of being not present"],
  ["absent", "[ˈæbsənt]", "a", "不在场的；缺乏的", "not being in a specified place"],
  ["absolute", "[ˈæbsəluːt]", "a", "绝对的；纯粹的", "perfect or complete or pure"],
  ["absolutely", "[ˈæbsəluːtli]", "ad", "完全地；绝对地", "totally and definitely; without question"],
  ["absorb", "[əbˈsɔːb]", "vt", "吸收；使专心", "take in a liquid"],
  ["abstract", "[ˈæbstrækt]", "a", "抽象的；深奥的", "existing only in the mind; not concrete"],
  ["abundant", "[əˈbʌndənt]", "a", "丰富的；大量的", "present in great quantity"],
  ["abuse", "[əˈbjuːs]", "n", "滥用；虐待", "cruel or inhumane treatment"],
  ["academic", "[ˌækəˈdemik]", "a", "学院的；学术的", "associated with academia or an academy"],
  ["accelerate", "[əkˈseləreit]", "vt", "(使)加快；促进", "move faster"],
  ["accent", "[ˈæksənt]", "n", "口音；腔调；重音", "distinctive manner of oral expression"],
  ["accept", "[əkˈsept]", "vt", "接受；领会；承认", "receive willingly something given or offered"],
  ["access", "[ˈækses]", "n", "接近；通道，入口", "the right to enter"],
  ["accident", "[ˈæksidənt]", "n", "意外；事故", "an unfortunate mishap"],
  ["accompany", "[əˈkʌmpəni]", "vt", "陪伴；伴随；陪同", "go or travel along with"],
  ["accomplish", "[əˈkʌmpliʃ]", "vt", "达到(目的)；完成", "achieve or reach a goal"],
  ["account", "[əˈkaunt]", "n", "记述；解释；账目", "a record or statement of financial expenditure"],
  ["accumulate", "[əˈkjuːmjuleit]", "vt", "积累；积聚；堆积", "get or gather together"],
  ["accurate", "[ˈækjurit]", "a", "准确的；正确无误的", "conforming exactly to truth or fact"],
  ["accuse", "[əˈkjuːz]", "vt", "指责；归咎于", "bring an accusation against"],
  ["accustomed", "[əˈkʌstəmd]", "a", "惯常的；习惯的", "often used or practiced"],
  ["ache", "[eik]", "vi", "痛；渴望", "a dull persistent pain"],
  ["achieve", "[əˈtʃiːv]", "vt", "完成，实现；达到", "gain with effort"],
  ["achievement", "[əˈtʃiːvmənt]", "n", "成就；成绩；完成", "the action of accomplishing something"],
  ["acknowledge", "[əkˈnɔlidʒ]", "vt", "承认；告知收到", "declare to be true or admit the existence"],
  ["acquire", "[əˈkwaiə]", "vt", "取得；获得；学到", "come into the possession of something"],
  ["across", "[əˈkrɔs]", "prep", "横过；在…对面", null],
  ["act", "[ækt]", "vi", "行动；做，做事", "behave in a certain manner"],
  ["action", "[ˈækʃən]", "n", "行动；作用；功能", "something done (usually as opposed to something said)"],
  ["active", "[ˈæktiv]", "a", "活跃的；积极的", "characterized by energetic activity"],
  ["activity", "[ækˈtiviti]", "n", "活动；活力；行动", "any specific behavior"],
  ["actor", "[ˈæktə]", "n", "男演员；演剧的人", "a person who acts and gets paid for it"],
  ["actress", "[ˈæktris]", "n", "女演员", "a female actor"],
  ["actual", "[ˈæktjuəl]", "a", "实际的；现行的", "taking place in reality; not pretended"],
  ["actually", "[ˈæktjuəli]", "ad", "实际上；竟然", "as the true or stated case"],
  ["adapt", "[əˈdæpt]", "vt", "使适应；改编", "make fit for a particular purpose"],
  ["add", "[æd]", "vt", "添加；增加；补充", "join or combine with others"],
  ["addition", "[əˈdiʃən]", "n", "加，加法；附加物", "a component that is added to something"],
  ["additional", "[əˈdiʃənl]", "a", "附加的；额外的", "further or extra"],
  ["address", "[əˈdres]", "n", "地址；演说；谈吐", "the place where a person or organization can be found"],
  ["adequate", "[ˈædikwit]", "a", "足够的；可以胜任的", "sufficient for the purpose"],
  ["adjust", "[əˈdʒʌst]", "vt", "调整；调节；校正", "adapt or conform oneself to new conditions"],
]

const insertWord = db.prepare(
  'INSERT OR IGNORE INTO words (word, phonetic, pos, chinese, english_def) VALUES (?, ?, ?, ?, ?)'
)

const tx = db.transaction(() => {
  let count = 0
  for (const w of words) {
    const result = insertWord.run(w[0], w[1], w[2], w[3], w[4])
    if (result.changes > 0) count++
  }
  return count
})

const inserted = tx()
console.log(`已插入 ${inserted} 个单词`)

const hash = bcrypt.hashSync('test123', 10)
const createUser = db.prepare(
  'INSERT OR IGNORE INTO users (username, password_hash, is_admin) VALUES (?, ?, ?)'
)
createUser.run('test', hash, 1)
createUser.run('admin', hash, 1)

const insertSettings = db.prepare(
  'INSERT OR IGNORE INTO user_settings (user_id) VALUES (?)'
)
const users = db.prepare('SELECT id FROM users').all()
for (const u of users) insertSettings.run(u.id)

db.close()

console.log('✅ 测试数据库已创建')
console.log('   50 个单词, 2 个用户')
console.log('   测试账号: test / test123 (管理员)')
console.log('   测试账号: admin / test123 (管理员)')
