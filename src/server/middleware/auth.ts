import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import fs from 'fs'

export interface AuthPayload {
  id: number
  username: string
  is_admin: number
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload
    }
  }
}

function getJwtSecret(): string {
  const file = process.env.JWT_SECRET_FILE
  if (file && fs.existsSync(file)) {
    return fs.readFileSync(file, 'utf-8').trim()
  }
  if (process.env.JWT_SECRET) {
    return process.env.JWT_SECRET
  }
  return 'cet4-dev-secret-key-change-in-production'
}

export function signToken(payload: AuthPayload): string {
  const secret = getJwtSecret()
  return jwt.sign(payload, secret, { expiresIn: '7d' })
}

export function verifyToken(token: string): AuthPayload {
  const secret = getJwtSecret()
  return jwt.verify(token, secret) as AuthPayload
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ error: '未登录' })
    return
  }
  try {
    req.user = verifyToken(header.slice(7))
    next()
  } catch {
    res.status(401).json({ error: '登录已过期，请重新登录' })
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user || !req.user.is_admin) {
    res.status(403).json({ error: '需要管理员权限' })
    return
  }
  next()
}

export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization
  if (header && header.startsWith('Bearer ')) {
    try {
      req.user = verifyToken(header.slice(7))
    } catch {}
  }
  next()
}
