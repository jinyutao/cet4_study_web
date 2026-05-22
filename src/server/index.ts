import express from 'express'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import cors from 'cors'

import { initDb } from './models/database.js'
import publicRouter from './routes/public.js'
import authRouter from './routes/auth.js'
import learnRouter from './routes/learn.js'
import progressRouter from './routes/progress.js'
import settingsRouter from './routes/settings.js'
import adminRouter from './routes/admin.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
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
