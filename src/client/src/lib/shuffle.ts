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
  // 1) 优先从全量字典池中取干扰项
  const seen = new Set<string>([correctWord.chinese])
  let candidates: string[] = []
  if (externalDistractors) {
    candidates = externalDistractors.filter(c => !seen.has(c))
    candidates.forEach(c => seen.add(c))
  }

  // 2) 不足时从当前 wordQueue 补
  if (candidates.length < count - 1) {
    const extras = pool
      .filter(w => w.wordId !== correctWord.wordId && !seen.has(w.chinese))
      .map(w => w.chinese)
    candidates = [...candidates, ...extras]
    extras.forEach(c => seen.add(c))
  }

  const distractors = candidates
    .sort(() => Math.random() - 0.5)
    .slice(0, count - 1)
    .map(text => ({ text, correct: false }))

  // 3) 兜底
  while (distractors.length < count - 1) {
    distractors.push({ text: '（干扰项）', correct: false })
  }

  const choices: ChoiceItem[] = [
    { text: correctWord.chinese, correct: true },
    ...distractors,
  ]

  return shuffleArray(choices)
}
