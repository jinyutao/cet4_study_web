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
  count: number = 4
): ChoiceItem[] {
  const distractors = pool
    .filter(w => w.wordId !== correctWord.wordId && w.chinese !== correctWord.chinese)
    .sort(() => Math.random() - 0.5)
    .slice(0, count - 1)
    .map(w => ({ text: w.chinese, correct: false }))

  while (distractors.length < count - 1) {
    distractors.push({ text: '（干扰项）', correct: false })
  }

  const choices: ChoiceItem[] = [
    { text: correctWord.chinese, correct: true },
    ...distractors,
  ]

  return shuffleArray(choices)
}
