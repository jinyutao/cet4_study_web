export interface CardState {
  ef: number
  interval: number
  repetitions: number
}

export function calculateQuality(correct: boolean, responseTimeMs: number): number {
  if (!correct) return 0
  if (responseTimeMs < 2000) return 5
  if (responseTimeMs < 5000) return 4
  if (responseTimeMs < 10000) return 3
  if (responseTimeMs < 20000) return 2
  return 1
}

export function sm2Step(state: CardState, quality: number): CardState {
  if (quality < 3) {
    return {
      ef: state.ef,
      interval: 1,
      repetitions: 0,
    }
  }

  const newEf = Math.max(1.3, Math.min(3.0,
    state.ef + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
  ))

  let newInterval: number
  if (state.repetitions === 0) {
    newInterval = 1
  } else if (state.repetitions === 1) {
    newInterval = 6
  } else {
    newInterval = Math.round(state.interval * newEf)
  }

  return {
    ef: newEf,
    interval: newInterval,
    repetitions: state.repetitions + 1,
  }
}
