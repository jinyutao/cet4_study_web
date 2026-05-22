import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import { getDb, getUserByUsername, createUser, countAdminUsers, getUserById, getUserSettings, getWordCount } from '../models/database.js'
import { signToken, requireAuth } from '../middleware/auth.js'
import { ok, fail, validationError, serverError } from '../utils/response.js'

const router = Router()
const SALT_ROUNDS = 10

router.post('/register', (req: Request, res: Response) => {
  try {
    const { username, password } = req.body

    if (!username || !password) {
      validationError(res, '用户名和密码不能为空')
      return
    }

    if (typeof username !== 'string' || username.length < 2 || username.length > 32) {
      validationError(res, '用户名长度应在 2-32 个字符之间')
      return
    }

    if (typeof password !== 'string' || password.length < 6) {
      validationError(res, '密码长度不能少于 6 个字符')
      return
    }

    const existing = getUserByUsername(username)
    if (existing) {
      fail(res, 'DUPLICATE_USERNAME', '用户名已被注册', 409)
      return
    }

    const adminCount = countAdminUsers()
    const isAdmin = adminCount === 0 ? 1 : 0
    const passwordHash = bcrypt.hashSync(password, SALT_ROUNDS)
    const userId = createUser(username, passwordHash, isAdmin)
    const token = signToken({ id: userId, username, is_admin: isAdmin })

    ok(res, {
      user: { id: userId, username, isAdmin: isAdmin === 1, createdAt: new Date().toISOString() },
      token,
    }, 201)
  } catch (e) {
    serverError(res, e instanceof Error ? e.message : '注册失败')
  }
})

router.post('/login', (req: Request, res: Response) => {
  try {
    const { username, password } = req.body

    if (!username || !password) {
      validationError(res, '用户名和密码不能为空')
      return
    }

    const user = getUserByUsername(username)
    if (!user) {
      fail(res, 'INVALID_CREDENTIALS', '用户名或密码错误', 401)
      return
    }

    if (user.frozen) {
      fail(res, 'USER_FROZEN', '账号已被冻结，请联系管理员', 403)
      return
    }

    const valid = bcrypt.compareSync(password, user.password_hash)
    if (!valid) {
      fail(res, 'INVALID_CREDENTIALS', '用户名或密码错误', 401)
      return
    }

    const token = signToken({ id: user.id, username: user.username, is_admin: user.is_admin })

    ok(res, {
      user: {
        id: user.id,
        username: user.username,
        isAdmin: user.is_admin === 1,
        isFrozen: user.frozen === 1,
        createdAt: user.created_at,
      },
      token,
    })
  } catch (e) {
    serverError(res, e instanceof Error ? e.message : '登录失败')
  }
})

router.get('/me', requireAuth, (req: Request, res: Response) => {
  try {
    const user = getUserById(req.user!.id)
    if (!user) {
      fail(res, 'NOT_FOUND', '用户不存在', 404)
      return
    }

    const settings = getUserSettings(req.user!.id) as Record<string, unknown>
    const db = getDb()

    const totalWords = getWordCount()
    const masteredCount = (db.prepare(
      'SELECT COUNT(*) as cnt FROM user_words WHERE user_id = ? AND proficiency >= 90'
    ).get(user.id) as { cnt: number }).cnt
    const currentRound = (db.prepare(
      'SELECT COALESCE(MAX(round), 0) as rnd FROM user_words WHERE user_id = ?'
    ).get(user.id) as { rnd: number }).rnd
    const daysActive = (db.prepare(
      'SELECT COUNT(DISTINCT date(created_at)) as cnt FROM review_logs WHERE user_id = ?'
    ).get(user.id) as { cnt: number }).cnt

    const reviewDates = db.prepare(`
      SELECT DISTINCT date(created_at) as d
      FROM review_logs WHERE user_id = ?
      ORDER BY d DESC
    `).all(user.id) as { d: string }[]

    let streakDays = 0
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    for (let i = 0; i < reviewDates.length; i++) {
      const expected = new Date(today)
      expected.setDate(expected.getDate() - i)
      const expectedStr = expected.toISOString().slice(0, 10)
      if (reviewDates[i].d === expectedStr) {
        streakDays++
      } else {
        break
      }
    }

    ok(res, {
      id: user.id,
      username: user.username,
      isAdmin: user.is_admin === 1,
      isFrozen: user.frozen === 1,
      createdAt: user.created_at,
      settings: {
        newWordsPerSession: settings.new_words_per_session,
        dailyGoal: settings.daily_goal,
        spellingMode: (settings.spelling_mode as number) === 1,
        firstLetterHint: (settings.first_letter_hint as number) === 1,
        choiceOptions: settings.choice_options,
        previewBeforeLearn: (settings.preview_before_learn as number) === 1,
        dailyReminder: (settings.daily_reminder as number) === 1,
        reminderTime: settings.reminder_time,
      },
      stats: {
        totalWords,
        masteredCount,
        currentRound,
        daysActive,
        streakDays,
      },
    })
  } catch (e) {
    serverError(res, e instanceof Error ? e.message : '获取用户信息失败')
  }
})

export default router
