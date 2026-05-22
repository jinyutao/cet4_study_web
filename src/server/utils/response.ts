import { Response } from 'express'

export function ok<T>(res: Response, data: T, statusCode = 200): void {
  res.status(statusCode).json({
    success: true,
    data,
    ts: new Date().toISOString(),
  })
}

export function fail(res: Response, code: string, message: string, statusCode: number, details?: unknown): void {
  const body: Record<string, unknown> = {
    success: false,
    error: { code, message },
    ts: new Date().toISOString(),
  }
  if (details !== undefined) {
    ;(body.error as Record<string, unknown>).details = details
  }
  res.status(statusCode).json(body)
}

export function validationError(res: Response, message: string, details?: unknown): void {
  fail(res, 'VALIDATION_ERROR', message, 400, details)
}

export function notFound(res: Response, message = '资源不存在'): void {
  fail(res, 'NOT_FOUND', message, 404)
}

export function unauthorized(res: Response, message = '请先登录'): void {
  fail(res, 'UNAUTHORIZED', message, 401)
}

export function forbidden(res: Response, message = '无权限访问'): void {
  fail(res, 'FORBIDDEN', message, 403)
}

export function conflict(res: Response, code: string, message: string): void {
  fail(res, code, message, 409)
}

export function serverError(res: Response, message = '服务器内部错误'): void {
  fail(res, 'INTERNAL_ERROR', message, 500)
}
