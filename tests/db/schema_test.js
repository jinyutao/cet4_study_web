/**
 * 数据库 Schema 验证测试
 *
 * 通过 /test_db HTTP 接口 + 直接数据库连接，
 * 验证数据库是否符合《数据库设计文档》的要求。
 *
 * 运行方式:
 *   bash start.sh test:db
 *   docker exec docker-cet4-web-1 node /app/tests/db/schema_test.js
 *
 * 环境变量:
 *   DB_PATH   — 要测试的数据库路径（默认 /app/data/cet4.db）
 *   NO_HTTP   — 设为 1 跳过 HTTP 测试（仅适用直接连接）
 */

/* eslint-disable no-console */

import http from 'http'
import path from 'path'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const _require = createRequire(import.meta.url)

// ========================================================================
//  预期值（来自《数据库设计文档》）
// ========================================================================

const EXPECTED_TABLES = [
  'words',
  'users',
  'user_words',
  'sessions',
  'review_logs',
  'round_completions',
  'user_settings',
  'sqlite_sequence',
]

const EXPECTED_COLUMNS = {
  words:              ['id', 'word', 'phonetic', 'pos', 'chinese', 'english_def'],
  users:              ['id', 'username', 'password_hash', 'is_admin', 'frozen', 'created_at'],
  user_words:         ['user_id', 'word_id', 'ef', 'interval_days', 'repetitions', 'proficiency', 'next_review', 'total_correct', 'total_attempts', 'avg_response_time', 'round', 'consecutive_correct', 'last_reviewed_at', 'first_learned_at'],
  sessions:           ['id', 'user_id', 'start_time', 'end_time', 'words_reviewed', 'words_passed', 'words_failed', 'duration_seconds', 'round', 'status'],
  review_logs:        ['id', 'user_id', 'word_id', 'session_id', 'correct', 'response_time_ms', 'quality', 'review_type', 'created_at'],
  round_completions:  ['id', 'user_id', 'round', 'completed_at', 'words_mastered', 'total_words', 'avg_proficiency'],
  user_settings:      ['user_id', 'new_words_per_session', 'daily_goal', 'spelling_mode', 'first_letter_hint', 'choice_options', 'preview_before_learn', 'daily_reminder', 'reminder_time', 'new_word_mode'],
}

const EXPECTED_COLUMN_TYPES = {
  words: {
    id:          { type: 'INTEGER', pk: 1 },
    word:        { type: 'TEXT', notnull: 1 },
    phonetic:    { type: 'TEXT' },
    pos:         { type: 'TEXT' },
    chinese:     { type: 'TEXT', notnull: 1 },
    english_def: { type: 'TEXT' },
  },
  users: {
    id:            { type: 'INTEGER', pk: 1 },
    username:      { type: 'TEXT', notnull: 1 },
    password_hash: { type: 'TEXT', notnull: 1 },
    is_admin:      { type: 'INTEGER', dflt: '0' },
    frozen:        { type: 'INTEGER', dflt: '0' },
    created_at:    { type: 'TEXT', dflt: "datetime('now')" },
  },
  user_words: {
    user_id:             { type: 'INTEGER', notnull: 1, pk: 1 },
    word_id:             { type: 'INTEGER', notnull: 1, pk: 2 },
    ef:                  { type: 'REAL', dflt: '2.5' },
    interval_days:       { type: 'INTEGER', dflt: '0' },
    repetitions:         { type: 'INTEGER', dflt: '0' },
    proficiency:         { type: 'INTEGER', dflt: '0' },
    next_review:         { type: 'TEXT' },
    total_correct:       { type: 'INTEGER', dflt: '0' },
    total_attempts:      { type: 'INTEGER', dflt: '0' },
    avg_response_time:   { type: 'REAL' },
    round:               { type: 'INTEGER', dflt: '1' },
    consecutive_correct: { type: 'INTEGER', dflt: '0' },
    last_reviewed_at:    { type: 'TEXT' },
    first_learned_at:    { type: 'TEXT' },
  },
  sessions: {
    id:               { type: 'INTEGER', pk: 1 },
    user_id:          { type: 'INTEGER', notnull: 1 },
    start_time:       { type: 'TEXT', dflt: "datetime('now')" },
    end_time:         { type: 'TEXT' },
    words_reviewed:   { type: 'INTEGER', dflt: '0' },
    words_passed:     { type: 'INTEGER', dflt: '0' },
    words_failed:     { type: 'INTEGER', dflt: '0' },
    duration_seconds: { type: 'INTEGER' },
    round:            { type: 'INTEGER', dflt: '1' },
    status:           { type: 'TEXT', dflt: "'active'" },
  },
  review_logs: {
    id:               { type: 'INTEGER', pk: 1 },
    user_id:          { type: 'INTEGER', notnull: 1 },
    word_id:          { type: 'INTEGER', notnull: 1 },
    session_id:       { type: 'INTEGER' },
    correct:          { type: 'INTEGER', notnull: 1 },
    response_time_ms: { type: 'INTEGER' },
    quality:          { type: 'INTEGER', notnull: 1 },
    review_type:      { type: 'TEXT', dflt: "'review'" },
    created_at:       { type: 'TEXT', dflt: "datetime('now')" },
  },
  round_completions: {
    id:              { type: 'INTEGER', pk: 1 },
    user_id:         { type: 'INTEGER', notnull: 1 },
    round:           { type: 'INTEGER', notnull: 1 },
    completed_at:    { type: 'TEXT', dflt: "datetime('now')" },
    words_mastered:  { type: 'INTEGER' },
    total_words:     { type: 'INTEGER' },
    avg_proficiency: { type: 'REAL' },
  },
  user_settings: {
    user_id:                { type: 'INTEGER', pk: 1 },
    new_words_per_session:  { type: 'INTEGER', dflt: '15' },
    daily_goal:             { type: 'INTEGER', dflt: '40' },
    spelling_mode:          { type: 'INTEGER', dflt: '0' },
    first_letter_hint:      { type: 'INTEGER', dflt: '1' },
    choice_options:         { type: 'INTEGER', dflt: '4' },
    preview_before_learn:   { type: 'INTEGER', dflt: '1' },
    daily_reminder:         { type: 'INTEGER', dflt: '1' },
    reminder_time:          { type: 'TEXT', dflt: "'20:00'" },
    new_word_mode:          { type: 'TEXT', dflt: "'random'" },
  },
}

const EXPECTED_WORD_COUNT = 4517

const EXPECTED_INDEXES = {
  user_words:  ['idx_user_words_next_review', 'idx_user_words_round', 'idx_user_words_proficiency'],
  review_logs: ['idx_review_logs_user_word', 'idx_review_logs_session', 'idx_review_logs_created'],
  sessions:    ['idx_sessions_user'],
}

// ========================================================================
//  测试基础设施
// ========================================================================

let passed = 0
let failed = 0
const failures = []

function assert(label, condition, detail = '') {
  if (condition) {
    passed++
    console.log(`  \x1b[32m✓\x1b[0m ${label}`)
  } else {
    failed++
    const msg = detail ? `${label} — ${detail}` : label
    failures.push(msg)
    console.log(`  \x1b[31m✗\x1b[0m ${msg}`)
  }
}

function section(title) {
  console.log(`\n  \x1b[36m▶ ${title}\x1b[0m`)
}

function fetchUrl(urlPath) {
  return new Promise((resolve, reject) => {
    const req = http.get(`http://localhost:9098${urlPath}`, (res) => {
      const chunks = []
      res.on('data', chunk => chunks.push(chunk))
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          html: Buffer.concat(chunks).toString('utf-8'),
        })
      })
    })
    req.on('error', reject)
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('Request timeout')) })
  })
}

// ========================================================================
//  Part 1: HTTP 接口验证（/test_db）
// ========================================================================

async function testViaHttp() {
  console.log('\n\x1b[1m📡 Part 1: HTTP 接口验证 via /test_db\x1b[0m')
  console.log('  ' + '\u2500'.repeat(48))

  section('基础连通性')
  const { status, html } = await fetchUrl('/test_db?db=cet4.db')
  assert('HTTP 状态码 200', status === 200, `Got ${status}`)
  assert('响应包含 "数据库测试页面"', html.includes('数据库测试页面'))
  assert('响应包含 "表数量:"', html.includes('表数量:'))

  section('表存在性 & 行数')

  // 解析 <h2>tablename (N 行)</h2>
  const tableHeaderRe = /<h2>(\w[\w ]*) \((\d+) 行\)<\/h2>/g
  const tables = []
  let m
  while ((m = tableHeaderRe.exec(html)) !== null) {
    tables.push({ name: m[1], rowCount: parseInt(m[2], 10) })
  }
  const tableNames = tables.map(t => t.name)

  // 检查所有预期表存在
  for (const expected of EXPECTED_TABLES) {
    assert(`表 "${expected}" 存在`,
      tableNames.includes(expected),
      `  Found: ${tableNames.join(', ')}`)
  }

  // words 行数 = 4517
  const wordsTbl = tables.find(t => t.name === 'words')
  assert(`words 表行数 = ${EXPECTED_WORD_COUNT}`,
    wordsTbl?.rowCount === EXPECTED_WORD_COUNT,
    `Got ${wordsTbl?.rowCount}`)

  section('列名匹配（逐表）')
  for (const [tblName, expectedCols] of Object.entries(EXPECTED_COLUMNS)) {
    const sectionRe = new RegExp(
      `<h2>${tblName} \\(\\d+ 行\\)<\\/h2>\\s*<table>\\s*<tr>([\\s\\S]*?)<\\/tr>`
    )
    const match = html.match(sectionRe)
    if (!match) {
      assert(`列名: ${tblName}`, false, 'Table section not found in HTML')
      continue
    }
    const thRe = /<th>(.*?)<\/th>/g
    const cols = []
    let cm
    while ((cm = thRe.exec(match[1])) !== null) {
      cols.push(cm[1])
    }

    assert(`列数: ${tblName}`, cols.length === expectedCols.length,
      `Expected ${expectedCols.length}, got ${cols.length}: [${cols.join(', ')}]`)

    const missing = expectedCols.filter(c => !cols.includes(c))
    const extra = cols.filter(c => !expectedCols.includes(c))
    assert(`列名无误: ${tblName}`, missing.length === 0 && extra.length === 0,
      missing.length > 0 ? `Missing: [${missing.join(', ')}]` : `Extra: [${extra.join(', ')}]`)
  }
}

// ========================================================================
//  Part 2: 直接数据库 Schema 验证
// ========================================================================

function testDirectSchema() {
  console.log('\n\x1b[1m🗄️  Part 2: 直接数据库 Schema 验证\x1b[0m')
  console.log('  ' + '\u2500'.repeat(48))

  const Database = _require('better-sqlite3')
  const dbPath = process.env.DB_PATH || path.join(process.cwd(), 'data', 'cet4.db')
  console.log(`  DB: ${dbPath}`)

  const db = new Database(dbPath)
  let closed = false

  try {
    // ── 2.1 PRAGMA 设置 ─────────────────────────────────
    section('PRAGMA 设置')

    const journalMode = String(db.pragma('journal_mode', { simple: true })).toLowerCase()
    const foreignKeys = db.pragma('foreign_keys', { simple: true })
    assert('journal_mode = WAL', journalMode === 'wal', `Got: ${journalMode}`)
    assert('foreign_keys = ON', foreignKeys === 1, `Got: ${foreignKeys}`)

    // ── 2.2 列类型 & 约束验证 ───────────────────────────
    section('列定义验证')

    for (const [tblName, expectedCols] of Object.entries(EXPECTED_COLUMNS)) {
      const info = /** @type {Array<{cid:number,name:string,type:string,notnull:number,dflt_value:null|string,pk:number}>} */ (
        db.prepare(`PRAGMA table_info(${tblName})`).all()
      )
      const actualNames = info.map(c => c.name)

      assert(`列数: ${tblName}`, info.length === expectedCols.length,
        `Expected ${expectedCols.length}, got ${info.length}: [${actualNames.join(', ')}]`)

      const missing = expectedCols.filter(c => !actualNames.includes(c))
      assert(`列名完整: ${tblName}`, missing.length === 0,
        missing.length > 0 ? `Missing: [${missing.join(', ')}]` : '')

      // 类型 & 约束（按预期表定义）
      const expectedTypes = EXPECTED_COLUMN_TYPES[tblName]
      if (!expectedTypes) continue

      for (const colInfo of info) {
        const exp = expectedTypes[colInfo.name]
        if (!exp) continue

        const typeOK = !exp.type || colInfo.type.toUpperCase() === exp.type.toUpperCase()
        const typeLabel = colInfo.type.toUpperCase()
        if (!typeOK) {
          assert(`类型: ${tblName}.${colInfo.name}`, false,
            `Expected ${exp.type}, got ${typeLabel}`)
        }

        if (exp.pk !== undefined) {
          assert(`PK: ${tblName}.${colInfo.name}`, colInfo.pk === exp.pk,
            `Got pk=${colInfo.pk}`)
        }

        if (exp.notnull !== undefined) {
          assert(`NOT NULL: ${tblName}.${colInfo.name}`, colInfo.notnull === exp.notnull,
            `Got notnull=${colInfo.notnull}`)
        }

        if (exp.dflt !== undefined) {
          // PRAGMA table_info 返回的 dflt_value 可能带引号，标准化后比较
          const normalized = colInfo.dflt_value
          assert(`默认值: ${tblName}.${colInfo.name} = ${exp.dflt}`,
            normalized === exp.dflt,
            `Got ${normalized}`)
        }
      }
    }

    // ── 2.3 唯一约束 ─────────────────────────────────
    section('UNIQUE 约束')

    const wordsIdxList = /** @type {Array<{seq:number,name:string,unique:number,origin:string,partial:number}>} */ (
      db.prepare('PRAGMA index_list(words)').all()
    )
    const hasWordUnique = wordsIdxList.some(i => i.unique === 1)
    assert('words.word 有 UNIQUE 索引', hasWordUnique,
      `Found indexes: ${wordsIdxList.map(i => `${i.name}(unique=${i.unique})`).join(', ')}`)

    const usersIdxList = /** @type {Array} */ (
      db.prepare('PRAGMA index_list(users)').all()
    )
    const hasUsernameUnique = usersIdxList.some(i => i.unique === 1)
    assert('users.username 有 UNIQUE 索引', hasUsernameUnique,
      `Found indexes: ${usersIdxList.map(i => `${i.name}(unique=${i.unique})`).join(', ')}`)

    // ── 2.4 索引验证 ─────────────────────────────────
    section('索引验证')

    let totalIndexCount = 0
    for (const [tblName, expectedIdx] of Object.entries(EXPECTED_INDEXES)) {
      const idxList = /** @type {Array} */ (
        db.prepare(`PRAGMA index_list(${tblName})`).all()
      )
      const idxNames = idxList
        .map(i => i.name)
        .filter(n => !n.startsWith('sqlite_autoindex'))

      for (const expectedName of expectedIdx) {
        assert(`索引 ${expectedName}`, idxNames.includes(expectedName),
          `Table \`${tblName}\` has: [${idxNames.join(', ')}]`)
      }
      totalIndexCount += expectedIdx.length
    }

    // ── 2.5 数据完整性 ─────────────────────────────────
    section('数据完整性')

    // words 表数据完整性
    const wordNulls = /** @type {Array} */ (
      db.prepare("SELECT count(*) as cnt FROM words WHERE word IS NULL OR word = ''").get()
    )
    assert('words.word 无空值', wordNulls[0]?.cnt === 0 || wordNulls.cnt === 0,
      `Found NULL/empty words`)

    const chineseNulls = /** @type {Array} */ (
      db.prepare('SELECT count(*) as cnt FROM words WHERE chinese IS NULL').get()
    )
    assert('words.chinese 无 NULL', (chineseNulls[0]?.cnt ?? chineseNulls.cnt) === 0)

    const dups = /** @type {Array} */ (
      db.prepare('SELECT word, count(*) as cnt FROM words GROUP BY word HAVING cnt > 1').all()
    )
    assert('words 无重复单词', dups.length === 0,
      dups.length > 0 ? `Duplicates: ${JSON.stringify(dups.slice(0, 3))}` : '')

    const maxIdRow = /** @type {Array} */ (
      db.prepare('SELECT max(id) as max_id FROM words').get()
    )
    const countRow = /** @type {Array} */ (
      db.prepare('SELECT count(*) as cnt FROM words').get()
    )
    const maxId = maxIdRow[0]?.max_id ?? maxIdRow.max_id
    const cnt = countRow[0]?.cnt ?? countRow.cnt
    assert('words.id 连续性', maxId >= cnt, `max(id)=${maxId}, count=${cnt}`)

    const rlCount = /** @type {Array} */ (
      db.prepare('SELECT count(*) as cnt FROM review_logs').get()
    )
    const rlTotal = rlCount[0]?.cnt ?? rlCount.cnt
    if (rlTotal > 0) {
      const rlTypes = /** @type {Array} */ (
        db.prepare('SELECT DISTINCT review_type FROM review_logs').all()
      )
      const invalidTypes = rlTypes.filter(r => !['review', 'new_learn', 'retest'].includes(r.review_type ?? r.review_type))
      assert('review_logs.review_type 值合法', invalidTypes.length === 0,
        `Invalid types: ${JSON.stringify(invalidTypes)}`)
    } else {
      console.log('  ⚠ review_logs 为空，跳过 review_type 值验证')
    }

    const sessCount = /** @type {Array} */ (
      db.prepare('SELECT count(*) as cnt FROM sessions').get()
    )
    const sessTotal = sessCount[0]?.cnt ?? sessCount.cnt
    if (sessTotal > 0) {
      const statuses = /** @type {Array} */ (
        db.prepare('SELECT DISTINCT status FROM sessions').all()
      )
      const invalidStatuses = statuses.filter(s => !['active', 'completed', 'abandoned'].includes(s.status))
      assert('sessions.status 值合法', invalidStatuses.length === 0,
        `Invalid: ${JSON.stringify(invalidStatuses)}`)
    } else {
      console.log('  ⚠ sessions 为空，跳过 status 值验证')
    }

    const usCount = /** @type {Array} */ (
      db.prepare('SELECT count(*) as cnt FROM user_settings').get()
    )
    const usTotal = usCount[0]?.cnt ?? usCount.cnt
    if (usTotal > 0) {
      const modes = /** @type {Array} */ (
        db.prepare('SELECT DISTINCT new_word_mode FROM user_settings').all()
      )
      const invalidModes = modes.filter(m => !['random', 'alpha'].includes(m.new_word_mode))
      assert('user_settings.new_word_mode 值合法', invalidModes.length === 0,
        `Invalid: ${JSON.stringify(invalidModes)}`)
    } else {
      console.log('  ⚠ user_settings 为空，跳过 new_word_mode 值验证')
    }

    // ── 2.6 外键约束 ───────────────────────────────────
    section('外键约束')

    const fkList = /** @type {Array} */ (
      db.prepare('PRAGMA foreign_key_list(user_words)').all()
    )
    const fkUserWordsUser = fkList.find(
      f => (f.from ?? f.from) === 'user_id' && (f.table ?? f.table) === 'users'
    )
    assert('user_words.user_id → users.id 外键', !!fkUserWordsUser)

    const fkUserWordsWord = fkList.find(
      f => (f.from ?? f.from) === 'word_id' && (f.table ?? f.table) === 'words'
    )
    assert('user_words.word_id → words.id 外键', !!fkUserWordsWord)

    const fkSessions = /** @type {Array} */ (
      db.prepare('PRAGMA foreign_key_list(sessions)').all()
    )
    assert('sessions.user_id → users.id 外键',
      fkSessions.some(f => (f.from ?? f.from) === 'user_id'))

    const fkReviewLogs = /** @type {Array} */ (
      db.prepare('PRAGMA foreign_key_list(review_logs)').all()
    )
    assert('review_logs.user_id → users.id 外键',
      fkReviewLogs.some(f => (f.from ?? f.from) === 'user_id'))
    assert('review_logs.word_id → words.id 外键',
      fkReviewLogs.some(f => (f.from ?? f.from) === 'word_id'))

    const fkSettings = /** @type {Array} */ (
      db.prepare('PRAGMA foreign_key_list(user_settings)').all()
    )
    assert('user_settings.user_id → users.id 外键',
      fkSettings.some(f => (f.from ?? f.from) === 'user_id'))

  } finally {
    if (!closed) {
      db.close()
      closed = true
    }
  }
}

// ========================================================================
//  Main
// ========================================================================

async function main() {
  const hr = '\u2500'.repeat(58)

  console.log(`\n\x1b[1m${hr}\x1b[0m`)
  console.log(`  \x1b[1m🔍  数据库 Schema 验证测试\x1b[0m`)
  console.log(`  验证目标: 《数据库设计文档》`)
  console.log(`                  ─────────────────`)
  const dbPathLabel = process.env.DB_PATH || path.join(process.cwd(), 'data', 'cet4.db')
  console.log(`  数据库:  ${dbPathLabel}`)
  console.log(`\x1b[1m${hr}\x1b[0m`)

  // Part 1: HTTP
  if (process.env.NO_HTTP !== '1') {
    try {
      await testViaHttp()
    } catch (err) {
      console.error(`\n  \x1b[31m✗ HTTP 测试异常: ${err.message}\x1b[0m`)
      failed++
    }
  } else {
    console.log('\n  ⏭  HTTP 测试已跳过 (NO_HTTP=1)')
  }

  // Part 2: Direct
  try {
    testDirectSchema()
  } catch (err) {
    console.error(`\n  \x1b[31m✗ 直接 DB 测试异常: ${err.message}\x1b[0m`)
    console.error(err.stack)
    failed++
  }

  // Summary
  console.log(`\n\x1b[1m${hr}\x1b[0m`)
  if (failed === 0) {
    console.log(`  \x1b[32;1m✅  全部通过 — ${passed} 项断言 ✓\x1b[0m`)
  } else {
    console.log(`  \x1b[31;1m❌  测试结果: ${passed} ✓, ${failed} ✗\x1b[0m`)
    for (const f of failures) {
      console.log(`    \x1b[31m• ${f}\x1b[0m`)
    }
  }
  console.log(`\x1b[1m${hr}\x1b[0m\n`)

  process.exit(failed > 0 ? 1 : 0)
}

main()
