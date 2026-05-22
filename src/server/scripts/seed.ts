/**
 * Seed script: Parse CET-4 vocabulary from markdown and insert into SQLite.
 *
 * Reads ref/CET4_词汇表_精简版.md (markdown table format) and inserts
 * all 4526 words into the `words` table.
 *
 * Usage: npx tsx src/server/scripts/seed.ts
 * Auto-run on first server start if words table is empty.
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { initDb, insertWordsBatch, getWordCount } from '../models/database.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const MARKDOWN_PATH = path.join(__dirname, '../../ref/CET4_词汇表_精简版.md')

interface WordEntry {
  word: string
  phonetic: string | null
  pos: string | null
  chinese: string
  englishDef: string | null
}

/**
 * Parse the markdown table format:
 * | # | 单词 | 音标 | 词性 | 中文释义 | English Definition |
 *
 * Line format examples:
 * | 1 | a |  | art | 一(个)；每一(个) | - |
 * | 3 | ability | [əˈbiliti] | n | 能力；能耐，本领 | the quality of having the means or skills to do something |
 */
function parseMarkdownTable(content: string): WordEntry[] {
  const lines = content.split('\n')
  const words: WordEntry[] = []
  let inTable = false

  for (const line of lines) {
    const trimmed = line.trim()

    if (!trimmed || trimmed.startsWith('| #') || trimmed.startsWith('|---') || trimmed.startsWith('---')) {
      continue
    }

    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      const cells = trimmed.slice(1, -1).split('|').map(c => c.trim())

      if (cells.length >= 5) {
        const word = cells[1]
        const phonetic = cells[2] || null
        const pos = cells[3] || null
        const chinese = cells[4]
        const englishDef = cells.length >= 6 ? cells[5] : null

        if (word && !word.includes('-') && !/^\d+$/.test(word)) {
          const cleanEnglishDef = englishDef && englishDef !== '-' && englishDef !== ''
            ? englishDef.replace(/&#039;/g, "'").replace(/&amp;/g, '&')
            : null

          const cleanPhonetic = phonetic && phonetic.startsWith('[') ? phonetic : null

          words.push({
            word,
            phonetic: cleanPhonetic,
            pos: pos || null,
            chinese,
            englishDef: cleanEnglishDef,
          })
        }
      }
    }
  }

  return words
}

function main(): void {
  console.log('初始化数据库...')
  initDb()

  const existingCount = getWordCount()
  if (existingCount > 0) {
    console.log(`数据库已有 ${existingCount} 个单词，跳过 seed。`)
    console.log('如需重新导入，请删除 data/cet4.db 后重新运行。')
    return
  }

  console.log(`读取词汇表: ${MARKDOWN_PATH}`)
  const content = fs.readFileSync(MARKDOWN_PATH, 'utf-8')

  console.log('解析词汇表...')
  const entries = parseMarkdownTable(content)
  console.log(`解析到 ${entries.length} 个单词`)

  if (entries.length === 0) {
    console.error('错误: 未解析到任何单词，请检查 markdown 格式')
    process.exit(1)
  }

  console.log('插入数据库...')
  const inserted = insertWordsBatch(entries)
  console.log(`成功插入 ${inserted} 个单词`)

  // Verify
  const finalCount = getWordCount()
  console.log(`数据库中现有 ${finalCount} 个单词`)

  if (finalCount > 0) {
    console.log('Seed 完成!')
  } else {
    console.error('错误: 插入后数据库仍为空')
    process.exit(1)
  }
}

main()
