// --- 通用 ---
export interface ApiError {
  code: string
  message: string
  details?: unknown
}

// --- 公开接口 ---
export interface PublicStats {
  totalUsers: number
  activeUsers: number
  totalWords: number
  totalReviews: number
  topLearners: { username: string; masteredCount: number; daysActive: number }[]
  recentActivity: { username: string; action: string; timestamp: string }[]
}

// --- 认证 ---
export interface RegisterRequest {
  username: string
  password: string
}

export interface LoginRequest {
  username: string
  password: string
}

export interface AuthResponse {
  user: { id: number; username: string; isAdmin: boolean; isFrozen?: boolean; createdAt: string }
  token: string
}

export interface MeResponse {
  id: number
  username: string
  isAdmin: boolean
  isFrozen: boolean
  createdAt: string
  settings: import('./models').UserSettings
  stats: {
    totalWords: number
    masteredCount: number
    currentRound: number
    daysActive: number
    streakDays: number
  }
}

// --- 学习 ---
export interface TodayTask {
  dueReviewCount: number
  newWordsAvailable: number
  newWordsPerSession: number
  newWordMode: string
  lastSessionToday: boolean
  unfinishedSession: {
    id: number
    startedAt: string
    reviewedCount: number
    passedCount: number
    failedCount: number
  } | null
  estimatedMinutes: number
}

export interface StartSessionResponse {
  sessionId: number
  startedAt: string
  round: number
  reviewCount: number
  newWordsInRound: number
  newWordsTotal: number
}

export interface ReviewQueueResponse {
  words: import('./models').WordItem[]
  total: number
}

export interface NewWordsResponse {
  words: (Pick<import('./models').WordItem, 'wordId' | 'word' | 'phonetic' | 'pos' | 'chinese'>)[]
  remainingNew: number
  mode: 'random' | 'alpha'
  hasPreviewed: boolean
}

export interface AnswerResponse {
  wordId: number
  isCorrect: boolean
  quality: number
  ef: number
  intervalDays: number
  proficiency: number
  nextReview: string
  isNewLearned: boolean
  sessionProgress: {
    reviewed: number
    total: number
    passed: number
    failed: number
  }
}

export interface CompleteSessionResponse {
  sessionId: number
  durationSeconds: number
  totalReviewed: number
  totalPassed: number
  totalFailed: number
  correctRate: number
  proficiencyChange: number
  roundCompleted: boolean
  roundInfo?: {
    completedRound: number
    wordsMastered: number
    totalWords: number
    avgProficiency: number
  }
  streakDays: number
}

// --- 进度 ---
export interface ProgressOverview {
  currentRound: number
  roundProgress: number
  totalWords: number
  wordsLearned: number
  wordsMastered: number
  targetProficiency: number
  progressPercent: number
  daysInRound: number
  totalSessions: number
  totalReviews: number
  avgCorrectRate: number
  streakDays: number
  longestStreak: number
}

export interface ProficiencyDistribution {
  distribution: import('./models').ProficiencyLevel[]
  roundMaxProficiency: number
  roundMinProficiency: number
  avgProficiency: number
}

export interface HeatmapResponse {
  heatmap: import('./models').HeatmapDay[]
  startDate: string
  endDate: string
}

export interface RoundsResponse {
  rounds: import('./models').RoundInfo[]
  currentRound: number
}

// --- 管理员 ---
export interface AdminUserListResponse {
  users: import('./models').AdminUserItem[]
  pagination: import('./models').PaginationMeta
}

export interface AdminActionResponse {
  userId: number
  username: string
  newPassword?: string
  isAdmin?: boolean
  isFrozen?: boolean
  deleted?: boolean
  removedRecords?: {
    userWords: number
    sessions: number
    reviewLogs: number
    roundCompletions: number
  }
}
