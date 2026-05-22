import express from 'express'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'
import cors from 'cors'

import { initDb } from './models/database.js'
import publicRouter from './routes/public.js'
import authRouter from './routes/auth.js'
import learnRouter from './routes/learn.js'
import progressRouter from './routes/progress.js'
import settingsRouter from './routes/settings.js'
import adminRouter from './routes/admin.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const _require = createRequire(import.meta.url)
const app = express()
const PORT = 9098

app.use(cors())
app.use(express.json())

// ── Initialize database ───────────────────────────
initDb()

// ── API routes ────────────────────────────────────
app.use('/api/public', publicRouter)
app.use('/api/auth', authRouter)
app.use('/api/learn', learnRouter)
app.use('/api/progress', progressRouter)
app.use('/api/settings', settingsRouter)
app.use('/api/admin', adminRouter)

// ── Database test page ──────────────────────────
app.get('/test_db', (req, res) => {
  const dbPath = req.query.db
    ? path.join(__dirname, '../data', req.query.db as string)
    : path.join(__dirname, '../data/cet4_test_afjz.db')

  if (!fs.existsSync(dbPath)) {
    return res.status(404).send(`<h1>数据库未找到</h1><p>路径: ${dbPath}</p><p>可用: ${fs.readdirSync(path.join(__dirname, '../data')).join(', ')}</p>`)
  }

  try {
    const Database = _require('better-sqlite3')
    const db = new Database(dbPath)

    const tables: { name: string }[] = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`).all() as { name: string }[]

    let html = `<!DOCTYPE html><html lang="zh"><head><meta charset="utf-8"><title>数据库测试</title>
<style>body{font-family:system-ui,sans-serif;max-width:1200px;margin:0 auto;padding:20px}
table{border-collapse:collapse;width:100%;margin:10px 0 30px}
th,td{border:1px solid #ccc;padding:6px 12px;text-align:left}
th{background:#f0f4ff;font-weight:600}
h2{margin-top:30px;border-bottom:2px solid #eee;padding-bottom:6px}
.summary{background:#f9f9f9;padding:12px 16px;border-radius:8px;margin:10px 0}
.db-path{color:#666;font-size:0.9em}</style></head><body>
<h1>📊 数据库测试页面</h1>
<p class="db-path">数据库: ${dbPath}</p>
<div class="summary"><strong>表数量:</strong> ${tables.length}</div>`

    for (const t of tables) {
      const name = t.name
      const columns: { name: string }[] = db.prepare(`PRAGMA table_info(${name})`).all() as { name: string }[]
      const count: { cnt: number } = db.prepare(`SELECT count(*) as cnt FROM "${name}"`).get() as { cnt: number }

      html += `<h2>${name} (${count.cnt} 行)</h2><table><tr>
${columns.map((c: { name: string }) => `<th>${c.name}</th>`).join('')}</tr>`

      const rows: Record<string, unknown>[] = db.prepare(`SELECT * FROM "${name}" LIMIT 5`).all() as Record<string, unknown>[]
      for (const row of rows) {
        html += `<tr>${columns.map((c: { name: string }) => `<td>${String(row[c.name] ?? '')}</td>`).join('')}</tr>`
      }
      html += `</table>`
    }

    db.close()
    html += `<p style="color:#999;margin-top:40px">?db=cet4.db 可切换数据库</p></body></html>`
    res.type('html').send(html)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    res.status(500).send(`<h1>数据库错误</h1><pre>${msg}</pre>`)
  }
})

// ── Serve static frontend ─────────────────────────
const devClient = path.join(__dirname, '../../dist/client')
const prodClient = path.join(__dirname, 'client')
const clientDist = fs.existsSync(devClient) ? devClient : prodClient
app.use(express.static(clientDist))
app.get('*', (_req, res) => {
  const indexPath = path.join(clientDist, 'index.html')
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath)
  } else {
    res.json({ message: 'CET-4 API Server is running', status: 'ok' })
  }
})

app.listen(PORT, '0.0.0.0', () => {
  console.log(`CET-4 背单词服务已启动: http://0.0.0.0:${PORT}`)
})
