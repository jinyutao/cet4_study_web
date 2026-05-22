import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import { getDb, getUserById, countAdminUsers, deleteUser, setUserFrozen, setUserAdmin, updateUserPassword } from '../models/database.js'
import { requireAuth, requireAdmin } from '../middleware/auth.js'
import { ok, fail, validationError, notFound, forbidden, serverError } from '../utils/response.js'

interface UserRecord {
  id: number
  username: string
  isAdmin: number | boolean
  isFrozen: number | boolean
  createdAt: string
  lastActiveAt: string | null
  totalSessions: number
  totalReviews: number
  currentRound: number
  masteredCount: number
  avgProficiency: number | null
}

interface PaginationInfo {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

interface RemovedRecords {
  userWords: number
  sessions: number
  reviewLogs: number
  roundCompletions: number
}

const SALT_ROUNDS = 10

function generateRandomPassword(length = 12): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*'
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

const ALLOWED_SORT_BY = ['created_at', 'username', 'last_active'] as const
const ALLOWED_SORT_ORDER = ['asc', 'desc'] as const

const router = Router()

router.get('/users', requireAuth, requireAdmin, (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1)
    let pageSize = Math.max(1, parseInt(req.query.pageSize as string) || 20)
    pageSize = Math.min(pageSize, 100)
    const search = (req.query.search as string) || ''
    const filter = (req.query.filter as string) || 'all'
    const sortByRaw = (req.query.sortBy as string) || 'created_at'
    const sortOrderRaw = (req.query.sortOrder as string) || 'desc'

    const safeSortBy = ALLOWED_SORT_BY.includes(sortByRaw as typeof ALLOWED_SORT_BY[number]) ? sortByRaw : 'created_at'
    const safeSortOrder = ALLOWED_SORT_ORDER.includes(sortOrderRaw as typeof ALLOWED_SORT_ORDER[number]) ? sortOrderRaw : 'desc'

    const conditions: string[] = []
    const params: unknown[] = []

    if (search) {
      conditions.push('u.username LIKE ?')
      params.push(`%${search}%`)
    }

    if (filter === 'admin') {
      conditions.push('u.is_admin = 1')
    } else if (filter === 'frozen') {
      conditions.push('u.frozen = 1')
    } else if (filter === 'active') {
      conditions.push('u.frozen = 0')
    }

    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : ''

    const countRow = getDb().prepare(`SELECT COUNT(*) as cnt FROM users u ${whereClause}`).get(...params) as { cnt: number }
    const total = countRow.cnt
    const totalPages = Math.ceil(total / pageSize)
    const offset = (page - 1) * pageSize

    const users = getDb().prepare(`
      SELECT u.id, u.username, u.is_admin as isAdmin, u.frozen as isFrozen,
        u.created_at as createdAt,
        s.last_active as lastActiveAt,
        COALESCE(s.sessions_count, 0) as totalSessions,
        COALESCE(r.review_count, 0) as totalReviews,
        COALESCE(uw.current_round, 1) as currentRound,
        COALESCE(uw.mastered_count, 0) as masteredCount,
        uw.avg_prof as avgProficiency
      FROM users u
      LEFT JOIN (
        SELECT user_id, MAX(start_time) as last_active, COUNT(*) as sessions_count
        FROM sessions GROUP BY user_id
      ) s ON s.user_id = u.id
      LEFT JOIN (
        SELECT user_id, COUNT(*) as review_count
        FROM review_logs GROUP BY user_id
      ) r ON r.user_id = u.id
      LEFT JOIN (
        SELECT user_id, MAX(round) as current_round,
          SUM(CASE WHEN proficiency >= 90 THEN 1 ELSE 0 END) as mastered_count,
          AVG(proficiency) as avg_prof
        FROM user_words GROUP BY user_id
      ) uw ON uw.user_id = u.id
      ${whereClause}
      ORDER BY ${safeSortBy === 'last_active' ? 's.last_active' : 'u.' + safeSortBy} ${safeSortOrder}
      LIMIT ? OFFSET ?
    `).all(...params, pageSize, offset) as UserRecord[]

    const mappedUsers = users.map(u => ({ ...u, isAdmin: u.isAdmin === 1, isFrozen: u.isFrozen === 1 }))
    const pagination: PaginationInfo = { page, pageSize, total, totalPages }
    ok(res, { users: mappedUsers, pagination })
  } catch (e) {
    serverError(res, e instanceof Error ? e.message : '获取用户列表失败')
  }
})

router.put('/users/:id/reset-password', requireAuth, requireAdmin, (req: Request, res: Response) => {
  try {
    const targetId = parseInt(String(req.params.id), 10)
    const targetUser = getUserById(targetId)
    if (!targetUser) {
      notFound(res, '用户不存在')
      return
    }

    const newPassword = (req.body as { newPassword?: string }).newPassword || generateRandomPassword()
    const passwordHash = bcrypt.hashSync(newPassword, SALT_ROUNDS)
    updateUserPassword(targetId, passwordHash)

    ok(res, { userId: targetId, username: targetUser.username, newPassword })
  } catch (e) {
    serverError(res, e instanceof Error ? e.message : '重置密码失败')
  }
})

router.put('/users/:id/set-admin', requireAuth, requireAdmin, (req: Request, res: Response) => {
  try {
    const targetId = parseInt(String(req.params.id), 10)
    const targetUser = getUserById(targetId)
    if (!targetUser) {
      notFound(res, '用户不存在')
      return
    }

    if (req.user!.id === targetId) {
      validationError(res, '不能修改自己的管理员状态')
      return
    }

    const { isAdmin } = req.body as { isAdmin: boolean }
    if (typeof isAdmin !== 'boolean') {
      validationError(res, 'isAdmin 必须为布尔值')
      return
    }

    if (!isAdmin && targetUser.is_admin) {
      const adminCount = countAdminUsers()
      if (adminCount <= 1) {
        fail(res, 'VALIDATION_ERROR', '不能移除最后一个管理员', 400)
        return
      }
    }

    setUserAdmin(targetId, isAdmin ? 1 : 0)
    ok(res, { userId: targetId, username: targetUser.username, isAdmin })
  } catch (e) {
    serverError(res, e instanceof Error ? e.message : '设置管理员失败')
  }
})

router.put('/users/:id/freeze', requireAuth, requireAdmin, (req: Request, res: Response) => {
  try {
    const targetId = parseInt(String(req.params.id), 10)
    const targetUser = getUserById(targetId)
    if (!targetUser) {
      notFound(res, '用户不存在')
      return
    }

    const { isFrozen } = req.body as { isFrozen: boolean }
    if (typeof isFrozen !== 'boolean') {
      validationError(res, 'isFrozen 必须为布尔值')
      return
    }

    setUserFrozen(targetId, isFrozen ? 1 : 0)
    ok(res, { userId: targetId, username: targetUser.username, isFrozen })
  } catch (e) {
    serverError(res, e instanceof Error ? e.message : '设置冻结状态失败')
  }
})

router.delete('/users/:id', requireAuth, requireAdmin, (req: Request, res: Response) => {
  try {
    const targetId = parseInt(String(req.params.id), 10)
    const targetUser = getUserById(targetId)
    if (!targetUser) {
      notFound(res, '用户不存在')
      return
    }

    if (req.user!.id === targetId) {
      validationError(res, '不能删除自己的账号')
      return
    }

    if (targetUser.is_admin) {
      const adminCount = countAdminUsers()
      if (adminCount <= 1) {
        fail(res, 'VALIDATION_ERROR', '不能删除最后一个管理员', 400)
        return
      }
    }

    const db = getDb()
    const userWords = (db.prepare('SELECT COUNT(*) as cnt FROM user_words WHERE user_id = ?').get(targetId) as { cnt: number }).cnt
    const sessions = (db.prepare('SELECT COUNT(*) as cnt FROM sessions WHERE user_id = ?').get(targetId) as { cnt: number }).cnt
    const reviewLogs = (db.prepare('SELECT COUNT(*) as cnt FROM review_logs WHERE user_id = ?').get(targetId) as { cnt: number }).cnt
    const roundCompletions = (db.prepare('SELECT COUNT(*) as cnt FROM round_completions WHERE user_id = ?').get(targetId) as { cnt: number }).cnt

    deleteUser(targetId)

    const removedRecords: RemovedRecords = { userWords, sessions, reviewLogs, roundCompletions }
    ok(res, { deleted: true, userId: targetId, username: targetUser.username, removedRecords })
  } catch (e) {
    serverError(res, e instanceof Error ? e.message : '删除用户失败')
  }
})

export default router
