import type { WordItem, ChoiceItem } from '../types/models'

export function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function generateChoices(
  correctWord: WordItem,
  pool: WordItem[],
  count: number = 4,
  externalDistractors?: string[]
): ChoiceItem[] {
  const neighborIds = new Set(pool.map(w => w.wordId))

  // 1) 从 wordQueue 中取干扰项
  let candidates = pool
    .filter(w => w.wordId !== correctWord.wordId && w.chinese !== correctWord.chinese)
    .map(w => w.chinese)

  // 2) 从外部字典池中补足
  if (externalDistractors && candidates.length < count - 1) {
    const seen = new Set(candidates)
    seen.add(correctWord.chinese)
    const extras = externalDistractors.filter(c => !seen.has(c) && !neighborIds.has(c as any))
    candidates = [...candidates, ...extras]
  }

  const distractors = candidates
    .sort(() => Math.random() - 0.5)
    .slice(0, count - 1)
    .map(text => ({ text, correct: false }))

  // 3) 兜底（不应触发）
  while (distractors.length < count - 1) {
    distractors.push({ text: '（干扰项）', correct: false })
  }

  const choices: ChoiceItem[] = [
    { text: correctWord.chinese, correct: true },
    ...distractors,
  ]

  return shuffleArray(choices)
}
