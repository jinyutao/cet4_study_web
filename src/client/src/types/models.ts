// --- 用户 ---
export interface User {
  id: number
  username: string
  isAdmin: boolean
  isFrozen: boolean
  createdAt: string
}

// --- 词汇 ---
export interface Word {
  id: number
  word: string
  phonetic: string | null
  pos: string | null
  chinese: string
  englishDef: string | null
}

// --- 用户设置 ---
export interface UserSettings {
  newWordsPerSession: number
  dailyGoal: number
  spellingMode: boolean
  firstLetterHint: boolean
  choiceOptions: 2 | 4 | 6
  previewBeforeLearn: boolean
  dailyReminder: boolean
  reminderTime: string
}

// --- 答题项（前端扩展，非 API 返回）---
export interface ChoiceItem {
  text: string
  correct: boolean
}

export interface WordItem {
  wordId: number
  word: string
  phonetic: string | null
  pos: string | null
  chinese: string
  proficiency: number
  reviewType: 'review' | 'retest'
  isDifficult: boolean
}

// --- 熟练度等级 ---
export interface ProficiencyLevel {
  level: string
  label: string
  range: string
  count: number
  percent: number
}

// --- 热力图 ---
export interface HeatmapDay {
  date: string
  count: number
  duration: number
}

// --- 轮次信息 ---
export interface RoundInfo {
  round: number
  status: 'completed' | 'active' | 'locked'
  wordMode?: string | null
  totalWords: number
  masteredCount: number
  progressPercent: number
  completedAt: string | null
  sessionsCount: number
  avgCorrectRate: number
  avgProficiency: number
  startDate: string
  wordMode?: string | null
  estimatedSessions: number
}

// --- 管理员用户项 ---
export interface AdminUserItem {
  id: number
  username: string
  isAdmin: boolean
  isFrozen: boolean
  createdAt: string
  lastActiveAt: string | null
  totalSessions: number
  totalReviews: number
  currentRound: number
  masteredCount: number
  avgProficiency: number
}

// --- 统一分页元数据 ---
export interface PaginationMeta {
  page: number
  pageSize: number
  total: number
  totalPages: number
}
