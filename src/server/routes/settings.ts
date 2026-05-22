import { Router, Request, Response } from 'express'
import { getUserSettings, updateUserSettings } from '../models/database.js'
import { requireAuth } from '../middleware/auth.js'
import { ok, validationError, serverError } from '../utils/response.js'

interface UserSettingsResponse {
  newWordsPerSession: number
  dailyGoal: number
  spellingMode: boolean
  firstLetterHint: boolean
  choiceOptions: number
  previewBeforeLearn: boolean
  dailyReminder: boolean
  reminderTime: string
}

const BOOL_KEYS = ['spellingMode', 'firstLetterHint', 'previewBeforeLearn', 'dailyReminder'] as const

const router = Router()

router.get('/', requireAuth, (req: Request, res: Response) => {
  try {
    const settings = getUserSettings(req.user!.id) as Record<string, unknown>
    const mapped: UserSettingsResponse = {
      newWordsPerSession: settings.new_words_per_session as number,
      dailyGoal: settings.daily_goal as number,
      spellingMode: (settings.spelling_mode as number) === 1,
      firstLetterHint: (settings.first_letter_hint as number) === 1,
      choiceOptions: settings.choice_options as number,
      previewBeforeLearn: (settings.preview_before_learn as number) === 1,
      dailyReminder: (settings.daily_reminder as number) === 1,
      reminderTime: settings.reminder_time as string,
    }
    ok(res, mapped)
  } catch (e) {
    serverError(res, e instanceof Error ? e.message : '获取设置失败')
  }
})

router.put('/', requireAuth, (req: Request, res: Response) => {
  try {
    const body = req.body as Record<string, unknown>

    if (body.newWordsPerSession !== undefined) {
      if (typeof body.newWordsPerSession !== 'number' || !Number.isInteger(body.newWordsPerSession) || body.newWordsPerSession < 5 || body.newWordsPerSession > 50) {
        validationError(res, 'newWordsPerSession 必须是 5-50 之间的整数')
        return
      }
    }
    if (body.dailyGoal !== undefined) {
      if (typeof body.dailyGoal !== 'number' || !Number.isInteger(body.dailyGoal) || body.dailyGoal < 5 || body.dailyGoal > 120) {
        validationError(res, 'dailyGoal 必须是 5-120 之间的整数')
        return
      }
    }
    if (body.choiceOptions !== undefined) {
      if (![2, 4, 6].includes(body.choiceOptions as number)) {
        validationError(res, 'choiceOptions 必须为 2、4 或 6')
        return
      }
    }
    if (body.reminderTime !== undefined) {
      if (typeof body.reminderTime !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(body.reminderTime)) {
        validationError(res, 'reminderTime 格式必须为 HH:MM')
        return
      }
    }
    for (const key of BOOL_KEYS) {
      if (body[key] !== undefined && typeof body[key] !== 'boolean') {
        validationError(res, `${key} 必须为布尔值`)
        return
      }
    }

    const updates: Record<string, unknown> = {}
    if (body.newWordsPerSession !== undefined) updates.new_words_per_session = body.newWordsPerSession
    if (body.dailyGoal !== undefined) updates.daily_goal = body.dailyGoal
    if (body.spellingMode !== undefined) updates.spelling_mode = body.spellingMode ? 1 : 0
    if (body.firstLetterHint !== undefined) updates.first_letter_hint = body.firstLetterHint ? 1 : 0
    if (body.choiceOptions !== undefined) updates.choice_options = body.choiceOptions
    if (body.previewBeforeLearn !== undefined) updates.preview_before_learn = body.previewBeforeLearn ? 1 : 0
    if (body.dailyReminder !== undefined) updates.daily_reminder = body.dailyReminder ? 1 : 0
    if (body.reminderTime !== undefined) updates.reminder_time = body.reminderTime

    updateUserSettings(req.user!.id, updates)

    const settings = getUserSettings(req.user!.id) as Record<string, unknown>
    const mapped: UserSettingsResponse = {
      newWordsPerSession: settings.new_words_per_session as number,
      dailyGoal: settings.daily_goal as number,
      spellingMode: (settings.spelling_mode as number) === 1,
      firstLetterHint: (settings.first_letter_hint as number) === 1,
      choiceOptions: settings.choice_options as number,
      previewBeforeLearn: (settings.preview_before_learn as number) === 1,
      dailyReminder: (settings.daily_reminder as number) === 1,
      reminderTime: settings.reminder_time as string,
    }
    ok(res, mapped)
  } catch (e) {
    serverError(res, e instanceof Error ? e.message : '更新设置失败')
  }
})

export default router
