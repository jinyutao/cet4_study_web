import express from 'express'
import { initDb } from '../../../dist/models/database.js'
import publicRouter from '../../../dist/routes/public.js'
import authRouter from '../../../dist/routes/auth.js'
import learnRouter from '../../../dist/routes/learn.js'
import progressRouter from '../../../dist/routes/progress.js'
import settingsRouter from '../../../dist/routes/settings.js'
import adminRouter from '../../../dist/routes/admin.js'

export function createTestApp(): express.Express {
  const app = express()

  initDb()

  app.use(express.json())
  app.use('/api/public', publicRouter)
  app.use('/api/auth', authRouter)
  app.use('/api/learn', learnRouter)
  app.use('/api/progress', progressRouter)
  app.use('/api/settings', settingsRouter)
  app.use('/api/admin', adminRouter)

  return app
}
