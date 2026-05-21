import Database from 'better-sqlite3'
import bcrypt from 'bcryptjs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dbPath = path.join(__dirname, '../data/cet4.db')
const db = new Database(dbPath)

const username = process.argv[2]
const newPassword = process.argv[3]

if (!username || !newPassword) {
  console.error('用法: node cli/reset-password.js <用户名> <新密码>')
  process.exit(1)
}

const hash = bcrypt.hashSync(newPassword, 10)
const result = db.prepare('UPDATE users SET password_hash = ? WHERE username = ?').run(hash, username)

if (result.changes > 0) {
  console.log(`✅ 用户 "${username}" 密码已重置`)
} else {
  console.error(`❌ 用户 "${username}" 不存在`)
  process.exit(1)
}
