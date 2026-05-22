export interface UserWordState {
  total_correct: number
  total_attempts: number
  avg_response_time: number | null
  consecutive_correct: number
  interval_days: number
}

export interface ReviewLogEntry {
  correct: number
  response_time_ms: number | null
  created_at: string
}

function normalizeSpeed(avgResponseTime: number | null): number {
  if (avgResponseTime === null) return 0
  if (avgResponseTime < 2000) return 1.0
  if (avgResponseTime < 5000) return 0.75
  if (avgResponseTime < 10000) return 0.5
  if (avgResponseTime < 20000) return 0.25
  return 0
}

function computeStability(reviewHistory: ReviewLogEntry[]): number {
  if (reviewHistory.length < 4) return 0

  const sorted = [...reviewHistory].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  )

  const n = sorted.length
  const intervals: number[] = []
  for (let i = n - 3; i < n; i++) {
    intervals.push(
      new Date(sorted[i].created_at).getTime() - new Date(sorted[i - 1].created_at).getTime()
    )
  }

  let growthCount = 0
  for (let i = 1; i < intervals.length; i++) {
    if (intervals[i] >= intervals[i - 1]) growthCount++
  }

  return growthCount / (intervals.length - 1)
}

function computeFirstAttemptRate(reviewHistory: ReviewLogEntry[]): number {
  if (reviewHistory.length === 0) return 0

  const sorted = [...reviewHistory].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  )

  return sorted[0].correct === 1 ? 1.0 : 0
}

export function calculateProficiency(
  wordState: UserWordState,
  reviewHistory: ReviewLogEntry[]
): number {
  if (wordState.total_attempts === 0) return 0

  const accuracy = wordState.total_correct / wordState.total_attempts
  const speed = normalizeSpeed(wordState.avg_response_time)
  const consistency = Math.min(wordState.consecutive_correct / 5, 1.0)
  const stability = computeStability(reviewHistory)
  const firstAttemptRate = computeFirstAttemptRate(reviewHistory)

  const score =
    accuracy * 35 +
    speed * 25 +
    consistency * 15 +
    stability * 15 +
    firstAttemptRate * 10

  return Math.round(score)
}

export function calculateForgettingRisk(
  lastReviewDate: string | null,
  intervalDays: number
): number {
  if (lastReviewDate === null) return 1.0
  if (intervalDays <= 0) return 1.0

  const now = Date.now()
  const last = new Date(lastReviewDate).getTime()
  const daysSince = (now - last) / (1000 * 60 * 60 * 24)

  return Math.min(daysSince / intervalDays, 1.0)
}

export function getReviewPriority(
  proficiency: number,
  forgettingRisk: number,
  wasDifficult: boolean
): number {
  return (
    (1 - proficiency / 100) * 0.4 +
    forgettingRisk * 0.4 +
    (wasDifficult ? 0.2 : 0)
  )
}
