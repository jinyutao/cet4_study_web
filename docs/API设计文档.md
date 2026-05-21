# CET-4 背单词网站 — API 设计文档

> 基于 `docs/背单词网站_设计文档.md` 第 8 节的详细展开。
> 版本：1.0 — 2026-05-21
>
> **开发约束**：开发过程中不得使用宿主机 Node.js 或宿主机 node_modules。所有编译构建、依赖安装、脚本执行必须通过 Docker 容器完成。

---

## 目录

1. [通用规范](#1-通用规范)
2. [公开接口](#2-公开接口)
3. [认证](#3-认证)
4. [学习](#4-学习)
5. [进度](#5-进度)
6. [用户设置](#6-用户设置)
7. [超级管理员](#7-超级管理员)
8. [兜底命令](#8-兜底命令)
9. [API 调用时序图](#9-api-调用时序图)
10. [错误场景速查](#10-错误场景速查)

---

## 1. 通用规范

### 1.1 基础约定

| 项目 | 规范 |
|------|------|
| Base URL | `/api`（所有 API 端点统一前缀） |
| 日期格式 | ISO 8601：`YYYY-MM-DD`（日期） / `YYYY-MM-DDTHH:mm:ss.sssZ`（完整时间戳） |
| 认证方式 | `Authorization: Bearer <jwt_token>`（除公开接口外均需携带） |
| 请求体格式 | `application/json` |
| 响应体格式 | `application/json` |

### 1.2 统一响应信封

所有 API 响应使用同一信封结构：

```typescript
// 成功响应
interface ApiSuccess<T> {
  success: true;
  data: T;
  ts: string;  // ISO 时间戳
}

// 失败响应
interface ApiError {
  success: false;
  error: {
    code: string;       // 机器可读错误码
    message: string;    // 人类可读错误消息
    details?: unknown;  // 可选：详细错误信息（字段校验失败等）
  };
  ts: string;
}
```

### 1.3 HTTP 状态码

| 状态码 | 含义 | 使用场景 |
|--------|------|----------|
| `200` | 成功 | 正常响应 |
| `201` | 创建成功 | 注册、创建 Session |
| `400` | 请求参数错误 | 校验失败、缺少必填字段、格式错误 |
| `401` | 未认证 | 未提供 token、token 过期、token 无效 |
| `403` | 无权限 | 普通用户访问管理员接口、被冻结用户 |
| `404` | 资源不存在 | 用户、单词、Session 等不存在 |
| `409` | 资源冲突 | 用户名/邮箱已注册 |
| `429` | 请求过频 | 限流触发 |
| `500` | 服务器内部错误 | 数据库异常等不可预期错误 |

### 1.4 分页规范

需要分页的列表接口统一采用以下查询参数和响应格式：

```typescript
// 查询参数（GET）
interface PaginationQuery {
  page?: number;      // 页码，从 1 开始，默认 1
  pageSize?: number;  // 每页条数，默认 20，最大 100
}

// 响应中的分页信息
interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;       // 总记录数
  totalPages: number;  // 总页数
}
```

### 1.5 错误码一览

| 错误码 | HTTP 状态码 | 含义 |
|--------|-----------|------|
| `INVALID_TOKEN` | 401 | Token 无效或已过期 |
| `UNAUTHORIZED` | 401 | 未提供认证信息 |
| `FORBIDDEN` | 403 | 无权限访问 |
| `NOT_FOUND` | 404 | 请求的资源不存在 |
| `VALIDATION_ERROR` | 400 | 请求参数校验失败 |
| `DUPLICATE_USERNAME` | 409 | 用户名已存在 |
| `INVALID_CREDENTIALS` | 401 | 用户名或密码错误 |
| `USER_FROZEN` | 403 | 账号已被冻结 |
| `RATE_LIMITED` | 429 | 请求频率过高 |
| `INTERNAL_ERROR` | 500 | 服务器内部错误 |

---

## 2. 公开接口

### 2.1 GET /api/public/stats — 系统概况

访客 / 未登录用户可见，展示系统整体学习数据，鼓励注册。

**认证**：无

**Query 参数**：无

**Response `data` 类型**：

```typescript
interface PublicStats {
  totalUsers: number;             // 总注册用户数
  activeUsers: number;            // 近 7 天有学习记录的用户数
  totalWords: number;             // 词库总词汇量（固定 4517）
  totalReviews: number;           // 全平台总答题次数
  topLearners: {                  // 学习排行榜（前 10）
    username: string;
    masteredCount: number;        // 已掌握词数
    daysActive: number;           // 累计学习天数
  }[];
  recentActivity: {               // 近期动态（最近 20 条）
    username: string;
    action: string;               // "完成了第 X 轮学习" / "连续学习 X 天" 等
    timestamp: string;
  }[];
}
```

**示例响应**（200）：

```json
{
  "success": true,
  "data": {
    "totalUsers": 8,
    "activeUsers": 5,
    "totalWords": 4517,
    "totalReviews": 28450,
    "topLearners": [
      { "username": "zhangsan", "masteredCount": 3520, "daysActive": 47 },
      { "username": "lisi", "masteredCount": 2100, "daysActive": 23 }
    ],
    "recentActivity": [
      { "username": "zhangsan", "action": "完成了第 2 轮学习", "timestamp": "2026-05-21T10:30:00Z" }
    ]
  },
  "ts": "2026-05-21T12:00:00Z"
}
```

**数据库**：

| 字段 | 涉及的表 | SQL |
|------|---------|-----|
| `totalUsers` | `users` | `SELECT COUNT(*) FROM users` |
| `activeUsers` | `review_logs` | `SELECT COUNT(DISTINCT user_id) FROM review_logs WHERE created_at >= date('now', '-7 days')` |
| `totalWords` | `words` | `SELECT COUNT(*) FROM words`（固定值 4517，可硬编码） |
| `totalReviews` | `review_logs` | `SELECT COUNT(*) FROM review_logs` |
| `topLearners` | `users` + `user_words` | `SELECT u.username, COUNT(uw.word_id) AS masteredCount FROM users u JOIN user_words uw ON uw.user_id=u.id WHERE uw.proficiency>=90 AND uw.round=(SELECT MAX(round) FROM user_words WHERE user_id=u.id) GROUP BY u.id ORDER BY masteredCount DESC LIMIT 10` |
| `recentActivity` | `round_completions` | `SELECT u.username, ('完成了第 ' || rc.round || ' 轮学习') AS action, rc.completed_at AS timestamp FROM round_completions rc JOIN users u ON u.id=rc.user_id ORDER BY rc.completed_at DESC LIMIT 20` |

---

## 3. 认证

### 3.1 POST /api/auth/register — 用户注册

**认证**：无

**Request Body**：

```typescript
interface RegisterRequest {
  username: string;       // 用户名：3-20 位字母或数字，不能纯数字
  password: string;       // 密码：6-32 位任意字符（服务端 bcrypt 哈希存储）
}
```

**校验规则**：

| 字段 | 校验 | 错误码 |
|------|------|--------|
| `username` | 必填，3-20 位，仅支持字母和数字 | `VALIDATION_ERROR` |
| `username` | 不可与已有用户名重复 | `DUPLICATE_USERNAME` |
| `password` | 必填，6-32 位 | `VALIDATION_ERROR` |

**Response `data` 类型**：

```typescript
interface RegisterResponse {
  user: {
    id: number;
    username: string;
    isAdmin: boolean;
    createdAt: string;
  };
  token: string;  // JWT
}
```

**示例请求**：

```json
{
  "username": "wangwu",
  "password": "pass123456"
}
```

**示例响应**（201 — 成功）：

```json
{
  "success": true,
  "data": {
    "user": {
      "id": 9,
      "username": "wangwu",
      "isAdmin": false,
      "createdAt": "2026-05-21T12:00:00Z"
    },
    "token": "eyJhbGciOiJIUzI1NiIs..."
  },
  "ts": "2026-05-21T12:00:05Z"
}
```

**错误示例**（409 — 用户名重复）：

```json
{
  "success": false,
  "error": {
    "code": "DUPLICATE_USERNAME",
    "message": "用户名 'wangwu' 已被注册"
  },
  "ts": "2026-05-21T12:00:05Z"
}
```

> **首个用户自动成为管理员**：注册表中第一个成功注册的用户自动设置 `is_admin=1`（通过应用层检查 `users` 表行数实现）。

**数据库**：

| 操作 | 涉及的表 | SQL |
|------|---------|-----|
| 查重 username | `users` | `SELECT id FROM users WHERE username = ?` |
| 写入用户 | `users` | `INSERT INTO users (username, password_hash, is_admin) VALUES (?, ?, ?)` |
| 判断是否首个用户 | `users` | `SELECT COUNT(*) as cnt FROM users`（cnt=0 时 `is_admin=1`） |
| 创建设置默认值 | `user_settings` | `INSERT INTO user_settings (user_id) VALUES (?)` |

**数据流**：客户端明文密码 → 服务端 bcrypt 生成 hash → `password_hash` 存入 `users` 表 → 同时创建 `user_settings` 默认记录 → JWT 签发返回。

---

### 3.2 POST /api/auth/login — 登录

**认证**：无

**Request Body**：

```typescript
interface LoginRequest {
  username: string;
  password: string;
}
```

**校验规则**：

| 条件 | 错误码 |
|------|--------|
| 用户名不存在 | `INVALID_CREDENTIALS`（不透露是用户名还是密码错误） |
| 密码不匹配 | `INVALID_CREDENTIALS` |
| 用户被冻结（`frozen=1`） | `USER_FROZEN` |

**Response `data` 类型**：

```typescript
interface LoginResponse {
  user: {
    id: number;
    username: string;
    isAdmin: boolean;
    isFrozen: boolean;
    createdAt: string;
  };
  token: string;  // JWT，有效期 7 天
}
```

**示例请求**：

```json
{
  "username": "zhangsan",
  "password": "mypassword"
}
```

**示例响应**（200）：

```json
{
  "success": true,
  "data": {
    "user": {
    "id": 1,
    "username": "zhangsan",
    "isAdmin": true,
    "isFrozen": false,
    "createdAt": "2026-04-01T08:00:00Z"
  },
  "token": "eyJhbGciOiJIUzI1NiIs..."
},
"ts": "2026-05-21T12:05:00Z"
}
```

**错误示例**（403 — 用户被冻结）：

```json
{
  "success": false,
  "error": {
    "code": "USER_FROZEN",
    "message": "账号已被冻结，请联系管理员"
  },
  "ts": "2026-05-21T12:05:00Z"
```

**数据库**：

| 操作 | 涉及的表 | SQL |
|------|---------|-----|
| 查询用户 | `users` | `SELECT id, username, password_hash, is_admin, frozen, created_at FROM users WHERE username = ?` |
| 验证密码 | — | `bcrypt.compare(password, password_hash)` |

**数据流**：客户端提交明文 → 服务端查 `users` 表 → bcrypt 比对 → 比对成功则签发 JWT（payload 含 `userId`, `username`, `isAdmin`，有效期 7 天）。

---

### 3.3 GET /api/auth/me — 获取当前用户信息

**认证**：需要（`Authorization: Bearer <token>`）

**Response `data` 类型**：

```typescript
interface MeResponse {
  id: number;
  username: string;
  isAdmin: boolean;
  isFrozen: boolean;
  createdAt: string;
  settings: UserSettings;   // 见第 6 节
  stats: {                  // 简要学习统计
    totalWords: number;     // 本轮总词数
    masteredCount: number;  // 已掌握词数
    currentRound: number;
    daysActive: number;     // 累计学习天数
    streakDays: number;     // 连续学习天数
  };
}
```

**示例响应**（200）：

```json
{
  "success": true,
  "data": {
    "id": 1,
    "username": "zhangsan",
    "isAdmin": true,
    "isFrozen": false,
    "createdAt": "2026-04-01T08:00:00Z",
    "settings": {
      "newWordsPerSession": 15,
      "dailyGoal": 40,
      "spellingMode": true,
      "firstLetterHint": true,
      "choiceOptions": 4,
      "previewBeforeLearn": true,
      "dailyReminder": true,
      "reminderTime": "20:00"
    },
    "stats": {
      "totalWords": 4517,
      "masteredCount": 3520,
      "currentRound": 2,
      "daysActive": 47,
      "streakDays": 12
    }
  },
  "ts": "2026-05-21T12:10:00Z"
}
```

**错误示例**（401 — Token 过期）：

```json
{
  "success": false,
  "error": {
    "code": "INVALID_TOKEN",
    "message": "登录已过期，请重新登录"
  },
  "ts": "2026-05-21T12:10:00Z"
```

**数据库**：

| 字段 | 涉及的表 | SQL |
|------|---------|-----|
| 用户基础信息 | `users` | `SELECT id, username, is_admin, frozen, created_at FROM users WHERE id = ?` |
| `settings` | `user_settings` | `SELECT * FROM user_settings WHERE user_id = ?` |
| `masteredCount` | `user_words` | `SELECT COUNT(*) FROM user_words WHERE user_id=? AND round=(SELECT MAX(round) FROM user_words WHERE user_id=?) AND proficiency>=90` |
| `currentRound` | `user_words` | `SELECT MAX(round) FROM user_words WHERE user_id=?`（若无记录则为 1） |
| `streakDays` | `review_logs` | 见 §5.1 的连续天数计算 SQL |
| `daysActive` | `review_logs` | `SELECT COUNT(DISTINCT date(created_at)) FROM review_logs WHERE user_id=?` |

---

## 4. 学习

> 所有学习接口均需 `Authorization` header，服务端从 JWT 中解析 `userId`。

### 4.1 GET /api/learn/today — 今日任务概览

学习页 / Dashboard 加载时调用，展示今日要完成的任务量。

**认证**：需要

**Response `data` 类型**：

```typescript
interface TodayTask {
  dueReviewCount: number;         // 今日到期需复习的词数
  newWordsAvailable: number;      // 本轮未学词数
  newWordsPerSession: number;     // 用户设置的每轮新词数
  newWordMode: string;            // 当前新词模式: "random" | "alpha"
  lastSessionToday: boolean;      // 今天是否已有学习记录
  unfinishedSession: {            // 如果有未完成的 Session 则返回
    id: number;
    startedAt: string;
    reviewedCount: number;
    passedCount: number;
    failedCount: number;
  } | null;
  estimatedMinutes: number;       // 预估完成时间（分钟）
}
```

**计算逻辑**：

- `estimatedMinutes` = `(dueReviewCount × 12s + newWordsPerSession × 30s + 总测词数 × 12s + 缓冲) / 60`

**数据库**：

| 字段 | 涉及的表 | SQL |
|------|---------|-----|
| `dueReviewCount` | `user_words` | `SELECT COUNT(*) FROM user_words WHERE user_id=? AND round=? AND next_review <= date('now')` |
| `newWordsAvailable` | `words` + `user_words` | `SELECT COUNT(*) FROM words w WHERE w.id NOT IN (SELECT word_id FROM user_words WHERE user_id=? AND round=?)` |
| `newWordsPerSession` | `user_settings` | `SELECT new_words_per_session FROM user_settings WHERE user_id = ?` |
| `lastSessionToday` | `sessions` | `SELECT COUNT(*) FROM sessions WHERE user_id=? AND date(start_time)=date('now')` |
| `unfinishedSession` | `sessions` | `SELECT id, start_time, words_reviewed, words_passed, words_failed FROM sessions WHERE user_id=? AND status='active' LIMIT 1` |
| `currentRound` | `user_words` | `SELECT MAX(round) FROM user_words WHERE user_id=?`（无记录时返回 1） |

**示例响应**（200）：

```json
{
  "success": true,
  "data": {
    "dueReviewCount": 24,
    "newWordsAvailable": 1006,
    "newWordsPerSession": 15,
    "newWordMode": "random",
    "lastSessionToday": false,
    "unfinishedSession": null,
    "estimatedMinutes": 18
  },
  "ts": "2026-05-21T18:00:00Z"
}
```

---

### 4.2 POST /api/learn/start — 创建新 Session

开始一次学习会话。如果是本轮首次，用户可能在此之前已在 UI 上选择了新词模式（见设计文档 6.1 流程）。服务端检查有无未完成的旧 session，如果有则自动关闭。

**认证**：需要

**Request Body**：

```typescript
interface StartSessionRequest {
  newWordMode?: "random" | "alpha";  // 本轮首次必填，后续沿用
}
```

**校验规则**：

| 条件 | 行为 |
|------|------|
| 本轮未选择新词模式且未传参 | 返回错误 `VALIDATION_ERROR` |
| 有未完成的 active Session | 自动将旧 session 标记为 `abandoned`，创建新的 |

**服务端逻辑**：

1. 查询用户当前轮次 `currentRound`
2. 查询该轮是否已有 `new_word_mode` 设置（存储在 `user_settings` 表）
3. 如果是本轮首次，校验并存储 `newWordMode`
4. 关闭之前的 active session（如有）
5. 插入 `sessions` 表，`status='active'`
6. 统计 `reviewCount`（今日到期数 + 上次错词数）

**Response `data` 类型**：

```typescript
interface StartSessionResponse {
  sessionId: number;
  startedAt: string;
  round: number;
  reviewCount: number;       // 本轮复习队列中的词数（可能为 0）
  newWordsInRound: number;   // 本轮已学新词数
  newWordsTotal: number;     // 本轮总词数
}
```

**示例请求**：

```json
{
  "newWordMode": "random"
}
```

**示例响应**（201）：

```json
{
  "success": true,
  "data": {
    "sessionId": 128,
    "startedAt": "2026-05-21T18:05:00Z",
    "round": 2,
    "reviewCount": 24,
    "newWordsInRound": 210,
    "newWordsTotal": 4517
  },
  "ts": "2026-05-21T18:05:00Z"
```

**数据库**：

| 操作 | 涉及的表 | SQL |
|------|---------|-----|
| 关闭旧 session | `sessions` | `UPDATE sessions SET status='abandoned', end_time=datetime('now') WHERE user_id=? AND status='active'` |
| 写入新 session | `sessions` | `INSERT INTO sessions (user_id, round, status) VALUES (?, ?, 'active')` |
| 读当前轮次 | `user_words` | `SELECT MAX(round) FROM user_words WHERE user_id=?` |
| 读本轮已学词数 | `user_words` | `SELECT COUNT(*) FROM user_words WHERE user_id=? AND round=?` |
| 读本轮总词数 | `words` | `SELECT COUNT(*) FROM words` |

---

### 4.3 GET /api/learn/review-queue — 获取复习队列

按遗忘风险排序返回今日到期待复习的词（含上次错词）。

**认证**：需要

**Query 参数**：

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `sessionId` | number | 必填 | 当前 Session ID |
| `limit` | number | 50 | 一次性最多取的词数 |

**排序规则**：

1. 先排上次 session 中标记为"困难"的词（`isDifficult`）
2. 按遗忘风险降序（`天数超期 / interval_days` 越大越优先）
3. 按熟练度升序（越不熟越优先）

**Response `data` 类型**：

```typescript
interface ReviewQueueResponse {
  words: ReviewWordItem[];
  total: number;             // 复习队列总长度
}

interface ReviewWordItem {
  wordId: number;
  word: string;               // 英文单词
  phonetic: string | null;    // 音标
  pos: string | null;         // 词性
  chinese: string;            // 中文释义
  proficiency: number;        // 当前熟练度
  reviewType: "review" | "retest";  // 普通复习 vs 上次错词重测
  isDifficult: boolean;       // 上次是否被标记为困难
}
```

**设计说明**：

- 服务端返回的词**不包含正确答案**。正确答案在用户答题后由服务端校验。
- 前端每答完一题，将已答词从本地队列删除，并可在需要时再次调用本接口补充。
- `reviewType=retest` 的词优先展示（排在队列最前）。

**数据库**：

主查询：从 `user_words` 关联 `words` 表，筛选 `next_review <= today` 的到期词和本轮错词：

```sql
SELECT
  w.id AS wordId,
  w.word,
  w.phonetic,
  w.pos,
  w.chinese,
  uw.proficiency,
  CASE WHEN uw.repetitions = 0 AND uw.total_attempts > 0 THEN 'retest' ELSE 'review' END AS reviewType,
  CASE WHEN uw.consecutive_correct = 0 AND uw.total_attempts > 0 THEN 1 ELSE 0 END AS isDifficult
FROM user_words uw
JOIN words w ON w.id = uw.word_id
WHERE uw.user_id = ?
  AND uw.round = ?
  AND (uw.next_review <= date('now') OR (uw.repetitions = 0 AND uw.total_attempts > 0))
ORDER BY
  isDifficult DESC,
  (julianday('now') - julianday(uw.next_review)) / NULLIF(uw.interval_days, 1) DESC,
  uw.proficiency ASC
LIMIT ?
```

| 字段 | 数据来源 |
|------|---------|
| `WordItem` 各字段 | `words` 表 + `user_words` 表 JOIN 查询 |
| `reviewType='retest'` 判定 | `repetitions=0 AND total_attempts>0`（上次答错） |
| `isDifficult` 判定 | `consecutive_correct=0 AND total_attempts>0` |

**示例响应**（200）：

```json
{
  "success": true,
  "data": {
    "words": [
      {
        "wordId": 128,
        "word": "abandon",
        "phonetic": "[əˈbændən]",
        "pos": "v.",
        "chinese": "抛弃，放弃",
        "proficiency": 45,
        "reviewType": "review",
        "isDifficult": false
      },
      {
        "wordId": 512,
        "word": "brilliant",
        "phonetic": "[ˈbrɪliənt]",
        "pos": "a.",
        "chinese": "灿烂的，杰出的",
        "proficiency": 28,
        "reviewType": "retest",
        "isDifficult": true
      }
    ],
    "total": 24
  },
  "ts": "2026-05-21T18:05:01Z"
}
```

---

### 4.4 GET /api/learn/new-words — 获取本轮新词

从本轮未学词库中按用户选择模式抽取 N 个新词。

**认证**：需要

**Query 参数**：

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `sessionId` | number | 必填 | 当前 Session ID |
| `count` | number | `newWordsPerSession` | 抽取数量，不传则使用用户设置 |

**Response `data` 类型**：

```typescript
interface NewWordsResponse {
  words: NewWordItem[];
  remainingNew: number;           // 本轮剩余未学词数
  mode: "random" | "alpha";      // 实际使用的模式
  hasPreviewed: boolean;         // 当前 session 是否已预览过
}

interface NewWordItem {
  wordId: number;
  word: string;
  phonetic: string | null;
  pos: string | null;
  chinese: string;               // 预览阶段展示；测试阶段前端应遮挡
}
```

**模式说明**：

| 模式 | 抽取 SQL |
|------|----------|
| `random` | `SELECT w.id AS wordId, w.word, w.phonetic, w.pos, w.chinese FROM words w WHERE w.id NOT IN (SELECT uw.word_id FROM user_words uw WHERE uw.user_id=? AND uw.round=?) ORDER BY RANDOM() LIMIT ?` |
| `alpha` | `SELECT w.id AS wordId, w.word, w.phonetic, w.pos, w.chinese FROM words w WHERE w.id NOT IN (SELECT uw.word_id FROM user_words uw WHERE uw.user_id=? AND uw.round=?) ORDER BY CASE WHEN substr(w.word,1,1) < (SELECT coalesce(substr(w2.word,1,1),'A') FROM user_words uw2 JOIN words w2 ON w2.id=uw2.word_id WHERE uw2.user_id=? AND uw2.round=? ORDER BY w2.word DESC LIMIT 1) THEN 1 WHEN substr(w.word,1,1) = (SELECT coalesce(substr(w3.word,1,1),'A') FROM user_words uw3 JOIN words w3 ON w3.id=uw3.word_id WHERE uw3.user_id=? AND uw3.round=? ORDER BY w3.word DESC LIMIT 1) THEN 2 ELSE 3 END, substr(w.word,1,1), RANDOM() LIMIT ?` |

**数据库**：

| 字段 | 涉及的表 | SQL |
|------|---------|-----|
| 读取新词 | `words` + `user_words` | 见上方随机/字母序查询 |
| `remainingNew` | `words` + `user_words` | `SELECT COUNT(*) FROM words w WHERE w.id NOT IN (SELECT uw.word_id FROM user_words uw WHERE uw.user_id=? AND uw.round=?)` |
| `mode` | `user_settings` | `SELECT new_word_mode FROM user_settings WHERE user_id = ?` |
| `hasPreviewed` | `sessions` | 检查该 session 是否已有 `words_reviewed > 0`（有则已预览过） |

**学习流程说明**：

1. 前端首次调用时 `hasPreviewed=false`，先展示预览页（看一遍所有新词的音标和释义）
2. 用户确认"开始测试"后，前端再次调用同一接口（或维持本地数据）进入逐个测试
3. 测试时前端从本地队列取词，服务端不重复返回已测词

**示例响应**（200）：

```json
{
  "success": true,
  "data": {
    "words": [
      { "wordId": 301, "word": "calendar", "phonetic": "[ˈkælɪndər]", "pos": "n.", "chinese": "日历" },
      { "wordId": 302, "word": "campus", "phonetic": "[ˈkæmpəs]", "pos": "n.", "chinese": "校园" }
    ],
    "remainingNew": 1004,
    "mode": "random",
    "hasPreviewed": false
  },
  "ts": "2026-05-21T18:06:00Z"
}
```

---

### 4.5 POST /api/learn/answer — 提交答题结果

每次用户作答后调用，服务端执行 SM-2 计算并返回结果。

**认证**：需要

**Request Body**：

```typescript
interface AnswerRequest {
  sessionId: number;
  wordId: number;
  correct: boolean;           // 前端判断：用户答案是否正确
  responseTimeMs: number;     // 从展示题目到用户确认答案的毫秒数
  answerType: "choice" | "spelling";   // 答题类型
  selectedOption?: string;    // 选择题：用户选择的选项文本（可选，供分析用）
}
```

**服务端处理流程**：

1. 校验 `sessionId` 属于当前用户且状态为 `active`
2. 校验 `wordId` —— 检查该词是否已为此用户创建 `user_words` 记录，没有则新建
3. 执行 SM-2 计算：
   - 根据 `correct` 和 `responseTimeMs` 计算质量评分 `q`（见设计文档 4.3 节）
   - 更新 `user_words` 表中的 `ef`, `interval_days`, `repetitions`, `proficiency`, `consecutive_correct`, `total_correct`, `total_attempts`
   - 插入 `review_logs` 记录
4. 计算 `sessionProgress`（当前 session 该阶段的进度）

**数据库**：

涉及 3 张表的读写操作，在同一事务内完成（`better-sqlite3` 的 `transaction`）：

```sql
-- 1. 查询或创建 user_words 记录
INSERT INTO user_words (user_id, word_id, round)
SELECT ?, ?, (SELECT MAX(round) FROM user_words WHERE user_id=?)
WHERE NOT EXISTS (SELECT 1 FROM user_words WHERE user_id=? AND word_id=?)

-- 2. 更新 user_words（SM-2 计算结果）
UPDATE user_words SET
  ef = ?,
  interval_days = ?,
  repetitions = ?,
  proficiency = ?,
  total_correct = total_correct + ?,
  total_attempts = total_attempts + 1,
  consecutive_correct = CASE WHEN ? THEN consecutive_correct + 1 ELSE 0 END,
  avg_response_time = CASE WHEN total_attempts = 0 THEN ? ELSE (avg_response_time * (total_attempts - 1) + ?) / total_attempts END,
  next_review = date('now', '+' || ? || ' days'),
  last_reviewed_at = datetime('now')
WHERE user_id = ? AND word_id = ?

-- 3. 插入 review_logs
INSERT INTO review_logs (user_id, word_id, session_id, correct, response_time_ms, quality, review_type)
VALUES (?, ?, ?, ?, ?, ?, ?)

-- 4. 更新 sessions 统计
UPDATE sessions SET
  words_reviewed = words_reviewed + 1,
  words_passed = words_passed + ?,
  words_failed = words_failed + ?
WHERE id = ?
```

| 操作 | 涉及的表 | 说明 |
|------|---------|------|
| 创建记录 | `user_words` | 首次学习该词时 INSERT |
| SM-2 更新 | `user_words` | 每次答题后 UPDATE 7 个字段 |
| 写入日志 | `review_logs` | 每次答题 INSERT 一条 |
| 更新会话 | `sessions` | 累计 `words_reviewed/passed/failed` |

**SM-2 质量评分（同设计文档 4.3 节）**：

```typescript
function calculateQuality(correct: boolean, responseTimeMs: number): number {
  if (!correct) return 0;
  if (responseTimeMs < 2000)  return 5;
  if (responseTimeMs < 5000)  return 4;
  if (responseTimeMs < 10000) return 3;
  if (responseTimeMs < 20000) return 2;
  return 1;
}
```

> 注：选择题和拼写题当前使用相同阈值，未来可扩展 `answerType` 参数区分。

**Response `data` 类型**：

```typescript
interface AnswerResponse {
  wordId: number;
  isCorrect: boolean;          // 服务端确认的正确性（始终与请求一致）
  quality: number;             // SM-2 质量评分 0-5
  ef: number;                  // 更新后的易度因子
  intervalDays: number;        // 更新后的间隔（天）
  proficiency: number;         // 更新后的熟练度 0-100
  nextReview: string;          // 下次复习日期
  isNewLearned: boolean;       // 如果是本轮首次接触该词，为 true
  sessionProgress: {           // 本轮 session 进度
    reviewed: number;
    total: number;             // 当前阶段总词数（复习/新词/总测，视阶段而定）
    passed: number;
    failed: number;
  };
}
```

**示例请求**：

```json
{
  "sessionId": 128,
  "wordId": 128,
  "correct": true,
  "responseTimeMs": 2340,
  "answerType": "choice"
}
```

**示例响应**（200）：

```json
{
  "success": true,
  "data": {
    "wordId": 128,
    "isCorrect": true,
    "quality": 4,
    "ef": 2.6,
    "intervalDays": 6,
    "proficiency": 72,
    "nextReview": "2026-05-27",
    "isNewLearned": false,
    "sessionProgress": {
      "reviewed": 4,
      "total": 24,
      "passed": 3,
      "failed": 1
    }
  },
  "ts": "2026-05-21T18:05:10Z"
}
```

> **答错的处理**：前端收到 `isCorrect=false` 时，应将此词放入 retest 队列，在当前阶段结束后重新测试该词。同一 session 内反复测试错词直到答对（q≥3）。
>
> **选择题干扰项生成**：由前端从同批次/同熟练度词中随机选出 3 个干扰项，服务端不参与。选项位置应随机排列。

---

### 4.6 POST /api/learn/complete — 完成本 Session

用户完成全部阶段（复习 → 新词 → 总测通关）后调用。

**认证**：需要

**Request Body**：

```typescript
interface CompleteSessionRequest {
  sessionId: number;
  abandoned?: boolean;       // 用户中途退出为 true（默认 false）
}
```

**服务端处理逻辑**：

1. 更新 `sessions` 表：`end_time=now`, `duration_seconds`, `status="completed"|"abandoned"`
2. 如果 `abandoned=false`（正常完成）：
   - 更新本轮本 Session 涉及的 `user_words` 的 `last_reviewed_at`
   - 检查轮次完成条件：`proficiency >= 90` 的词数 >= `total * 90%`
3. 如果达到轮次完成条件：
   - 自动创建 `round_completions` 记录
   - 将 `user_words` 的 `round` 字段递增（保留 `ef`, `total_correct`, `total_attempts`，重置 `interval_days=0`, `repetitions=0`, `proficiency=0`）

**数据库**：

```sql
-- 1. 关闭 session
UPDATE sessions SET
  end_time = datetime('now'),
  duration_seconds = CAST((julianday('now') - julianday(start_time)) * 86400 AS INTEGER),
  status = ?
WHERE id = ? AND user_id = ?

-- 2. 检查轮次完成条件
SELECT COUNT(*) AS mastered,
       (SELECT COUNT(*) FROM words) AS total
FROM user_words
WHERE user_id = ? AND round = ? AND proficiency >= 90

-- 3a. 写入 round_completions
INSERT INTO round_completions (user_id, round, words_mastered, total_words, avg_proficiency)
VALUES (?, ?, ?, ?, ?)

-- 3b. 轮次递增（重置学习进度，保留 EF 和历史统计）
UPDATE user_words SET
  round = round + 1,
  interval_days = 0,
  repetitions = 0,
  proficiency = 0,
  next_review = datetime('now')
WHERE user_id = ? AND round = ?

-- 4. 查询 streakDays
-- 见 §5.1 连续天数计算 SQL
```

**事务说明**：以上 SQL 在同一事务中执行。如果轮次完成条件不满足，仅执行第 1 步。如果达到条件，执行第 1 → 第 2 → 第 3a → 第 3b 步。`abandoned=true` 时仅执行第 1 步。全部操作使用 `better-sqlite3` 的 `transaction()` 确保原子性。`streakDays` 在事务完成后单独查询。

**Response `data` 类型**：

```typescript
interface CompleteSessionResponse {
  sessionId: number;
  durationSeconds: number;
  totalReviewed: number;
  totalPassed: number;
  totalFailed: number;
  correctRate: number;               // 本次正确率（百分比，保留一位小数）
  proficiencyChange: number;         // 本次 session 熟练度平均增长值
  roundCompleted: boolean;           // 本轮是否已完成
  roundInfo?: {                      // 如果本轮完成
    completedRound: number;
    wordsMastered: number;
    totalWords: number;
    avgProficiency: number;
  };
  streakDays: number;                // 当前连续学习天数
}
```

**示例响应**（200 — 正常完成但本轮未完成）：

```json
{
  "success": true,
  "data": {
    "sessionId": 128,
    "durationSeconds": 1250,
    "totalReviewed": 39,
    "totalPassed": 35,
    "totalFailed": 4,
    "correctRate": 89.7,
    "proficiencyChange": 3.2,
    "roundCompleted": false,
    "streakDays": 12
  },
  "ts": "2026-05-21T18:25:00Z"
}
```

**示例响应**（200 — 本轮完成，进入下一轮）：

```json
{
  "success": true,
  "data": {
    "sessionId": 128,
    "durationSeconds": 1250,
    "totalReviewed": 39,
    "totalPassed": 38,
    "totalFailed": 1,
    "correctRate": 97.4,
    "proficiencyChange": 5.1,
    "roundCompleted": true,
    "roundInfo": {
      "completedRound": 2,
      "wordsMastered": 4080,
      "totalWords": 4517,
      "avgProficiency": 91.5
    },
    "streakDays": 12
  },
  "ts": "2026-05-21T18:25:00Z"
}
```

---

## 5. 进度

### 5.1 GET /api/progress/overview — 总体进度概览

Dashboard 加载时调用，展示总体进度、掌握分布等。

**认证**：需要

**Response `data` 类型**：

```typescript
interface ProgressOverview {
  currentRound: number;
  roundProgress: number;          // 本轮完成百分比
  totalWords: number;             // 本轮总词数
  wordsLearned: number;           // 本轮已学（至少见过一次）
  wordsMastered: number;          // 本轮已掌握 (Lv5, prof>=90)
  targetProficiency: number;      // 目标掌握率（默认 90%）
  progressPercent: number;        // 已掌握词数 / 总词数 × 100
  daysInRound: number;            // 本轮已进行天数
  totalSessions: number;          // 本轮总 Session 数
  totalReviews: number;           // 本轮总答题次数
  avgCorrectRate: number;         // 本轮平均正确率
  streakDays: number;             // 连续学习天数
  longestStreak: number;          // 历史最长连续天数
}
```

**数据库**：

| 字段 | 涉及的表 | SQL |
|------|---------|-----|
| `currentRound` | `user_words` | `SELECT COALESCE(MAX(round), 1) FROM user_words WHERE user_id=?` |
| `totalWords` | `words` | `SELECT COUNT(*) FROM words` |
| `wordsLearned` | `user_words` | `SELECT COUNT(*) FROM user_words WHERE user_id=? AND round=? AND total_attempts>0` |
| `wordsMastered` / `progressPercent` | `user_words` | `SELECT COUNT(*) FROM user_words WHERE user_id=? AND round=? AND proficiency>=90` |
| `daysInRound` | `user_words` | `SELECT COALESCE(julianday('now') - julianday(MIN(created_at)), 0) FROM user_words WHERE user_id=? AND round=?`（通过 `review_logs.created_at` 近似） |
| `totalSessions` | `sessions` | `SELECT COUNT(*) FROM sessions WHERE user_id=? AND round=? AND status='completed'` |
| `totalReviews` | `review_logs` / `user_words` | `SELECT SUM(total_attempts) FROM user_words WHERE user_id=? AND round=?` |
| `avgCorrectRate` | `review_logs` | `SELECT ROUND(AVG(CASE WHEN correct=1 THEN 100.0 ELSE 0 END), 1) FROM review_logs WHERE user_id=? AND session_id IN (SELECT id FROM sessions WHERE round=?)` |
| `streakDays` | `review_logs` | 连续学习天数计算： |

```sql
-- 连续学习天数：从今天往前推，直到某天没有 review_logs 记录
WITH daily AS (
  SELECT DISTINCT date(created_at) AS d
  FROM review_logs WHERE user_id = ?
)
SELECT COUNT(*) AS streak FROM daily
WHERE d >= (
  SELECT MAX(d) FROM daily d2
  WHERE d2.d < date('now')
    AND NOT EXISTS (SELECT 1 FROM daily d3 WHERE d3.d = date(d2.d, '+1 day'))
)
  AND d <= date('now');
```

| `longestStreak` | `review_logs` | 同上逻辑，但取历史最大值 |

**示例响应**（200）：

```json
{
  "success": true,
  "data": {
    "currentRound": 2,
    "roundProgress": 77.8,
    "totalWords": 4517,
    "wordsLearned": 4210,
    "wordsMastered": 3520,
    "targetProficiency": 90,
    "progressPercent": 77.8,
    "daysInRound": 37,
    "totalSessions": 52,
    "totalReviews": 8450,
    "avgCorrectRate": 82.3,
    "streakDays": 12,
    "longestStreak": 21
  },
  "ts": "2026-05-21T18:00:00Z"
}
```

---

### 5.2 GET /api/progress/distribution — 熟练度分布

**认证**：需要

**Response `data` 类型**：

```typescript
interface ProficiencyDistribution {
  distribution: {
    level: string;       // "Lv0" | "Lv1" | "Lv2" | "Lv3" | "Lv4" | "Lv5"
    label: string;       // "未学习" | "初识" | "学习中" | "基本掌握" | "较熟练" | "已掌握"
    range: string;       // "0" | "1-25" | "26-50" | "51-75" | "76-89" | "90-100"
    count: number;       // 该等级词数
    percent: number;     // 占比百分比（保留一位小数）
  }[];
  roundMaxProficiency: number;   // 本轮最高熟练度（=100 时 UI 特别显示）
  roundMinProficiency: number;   // 本轮最低熟练度
  avgProficiency: number;        // 本轮平均熟练度
}
```

**数据库**：

| 涉及的表 | 说明 |
|---------|------|
| `user_words` | 全部数据来自单表查询，按 `proficiency` 范围聚合 |

```sql
SELECT
  SUM(CASE WHEN proficiency = 0 THEN 1 ELSE 0 END) AS lv0,
  SUM(CASE WHEN proficiency BETWEEN 1 AND 25 THEN 1 ELSE 0 END) AS lv1,
  SUM(CASE WHEN proficiency BETWEEN 26 AND 50 THEN 1 ELSE 0 END) AS lv2,
  SUM(CASE WHEN proficiency BETWEEN 51 AND 75 THEN 1 ELSE 0 END) AS lv3,
  SUM(CASE WHEN proficiency BETWEEN 76 AND 89 THEN 1 ELSE 0 END) AS lv4,
  SUM(CASE WHEN proficiency >= 90 THEN 1 ELSE 0 END) AS lv5,
  MAX(proficiency) AS max_prof,
  MIN(proficiency) AS min_prof,
  ROUND(AVG(proficiency), 1) AS avg_prof
FROM user_words
WHERE user_id = ? AND round = ?;
```

后端代码将此单行结果转换为 `distribution[]` 数组（百分比 = `count / SUM(count) * 100`）。

**示例响应**（200）：

```json
{
  "success": true,
  "data": {
    "distribution": [
      { "level": "Lv0", "label": "未学习", "range": "0", "count": 316, "percent": 7.0 },
      { "level": "Lv1", "label": "初识", "range": "1-25", "count": 56, "percent": 1.2 },
      { "level": "Lv2", "label": "学习中", "range": "26-50", "count": 180, "percent": 4.0 },
      { "level": "Lv3", "label": "基本掌握", "range": "51-75", "count": 256, "percent": 5.7 },
      { "level": "Lv4", "label": "较熟练", "range": "76-89", "count": 520, "percent": 11.5 },
      { "level": "Lv5", "label": "已掌握", "range": "90-100", "count": 3198, "percent": 70.6 }
    ],
    "roundMaxProficiency": 100,
    "roundMinProficiency": 0,
    "avgProficiency": 71.4
  },
  "ts": "2026-05-21T18:00:00Z"
}
```

---

### 5.3 GET /api/progress/heatmap — 学习热力图

**认证**：需要

**Query 参数**：

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `days` | number | 365 | 向前查询的天数，最大 365 |

**Response `data` 类型**：

```typescript
interface HeatmapResponse {
  heatmap: HeatmapDay[];
  startDate: string;
  endDate: string;
}

interface HeatmapDay {
  date: string;           // "YYYY-MM-DD"
  count: number;          // 当日答题数（0 = 无学习）
  duration: number;       // 当日学习总秒数（通过 sessions 表汇总）
}
```

**数据库**：

| 涉及的表 | 说明 |
|---------|------|
| `review_logs` | 按日期聚合统计答题数和学习时长；`sessions` 表提供 `duration_seconds` 数据 |

```sql
-- 答题数
SELECT date(created_at) AS date,
       COUNT(*) AS count
FROM review_logs
WHERE user_id = ?
  AND created_at >= date('now', '-? days')
GROUP BY date(created_at)
ORDER BY date;

-- 学习时长（通过 sessions 表汇总）
SELECT date(start_time) AS date,
       SUM(COALESCE(duration_seconds, 0)) AS duration
FROM sessions
WHERE user_id = ?
  AND start_time >= date('now', '-? days')
  AND status = 'completed'
GROUP BY date(start_time)
ORDER BY date;
```

后端将两个结果集按 `date` 字段合并：`count` 来自 `review_logs`，`duration` 来自 `sessions`。无记录的日期自动填充 `{ count: 0, duration: 0 }`。

**热力图色阶规范（前端实现）**：

| count 值 | 色阶 |
|----------|------|
| 0 | 灰色（`bg-gray-100`） |
| 1-20 | 浅绿（`bg-green-200`） |
| 21-50 | 中绿（`bg-green-400`） |
| 51+ | 深绿（`bg-green-600`） |

**示例响应**（200）：

```json
{
  "success": true,
  "data": {
    "heatmap": [
      { "date": "2026-04-21", "count": 35, "duration": 1250 },
      { "date": "2026-04-22", "count": 0, "duration": 0 },
      { "date": "2026-04-23", "count": 42, "duration": 1500 }
    ],
    "startDate": "2025-05-21",
    "endDate": "2026-05-21"
  },
  "ts": "2026-05-21T18:00:00Z"
}
```

---

### 5.4 GET /api/progress/rounds — 轮次进度

**认证**：需要

**Response `data` 类型**：

```typescript
interface RoundsResponse {
  rounds: RoundInfo[];
  currentRound: number;
}

interface RoundInfo {
  round: number;               // 轮次编号
  status: "completed" | "active" | "locked";
  totalWords: number;
  masteredCount: number;
  progressPercent: number;
  completedAt: string | null;  // 完成日期（如有）
  sessionsCount: number;       // 该轮总 Session 数
  avgCorrectRate: number;
  avgProficiency: number;
  startDate: string;           // 该轮首次学习日期
}
```

**数据库**：

主查询：从 `round_completions` 获取已完成轮次，结合 `user_words` 计算当前轮进度：

```sql
-- 已完成的轮次
SELECT rc.round, 'completed' AS status,
       rc.total_words AS totalWords, rc.words_mastered AS masteredCount,
       100 AS progressPercent,
       rc.completed_at AS completedAt,
       (SELECT COUNT(*) FROM sessions WHERE user_id=? AND round=rc.round AND status='completed') AS sessionsCount,
       (SELECT ROUND(AVG(CASE WHEN correct=1 THEN 100.0 ELSE 0 END), 1) FROM review_logs WHERE user_id=? AND session_id IN (SELECT id FROM sessions WHERE round=rc.round)) AS avgCorrectRate,
       rc.avg_proficiency AS avgProficiency,
       (SELECT MIN(date(start_time)) FROM sessions WHERE user_id=? AND round=rc.round) AS startDate
FROM round_completions rc
WHERE rc.user_id = ?
ORDER BY rc.round

-- 当前轮（从 user_words 获取进度）
SELECT ? AS round, 'active' AS status,
       (SELECT COUNT(*) FROM words) AS totalWords,
       (SELECT COUNT(*) FROM user_words WHERE user_id=? AND round=? AND proficiency>=90) AS masteredCount,
       ROUND(CAST((SELECT COUNT(*) FROM user_words WHERE user_id=? AND round=? AND proficiency>=90) AS REAL) / (SELECT COUNT(*) FROM words) * 100, 1) AS progressPercent,
       NULL AS completedAt,
       (SELECT COUNT(*) FROM sessions WHERE user_id=? AND round=? AND status='completed') AS sessionsCount,
       (SELECT ROUND(AVG(CASE WHEN correct=1 THEN 100.0 ELSE 0 END), 1) FROM review_logs WHERE user_id=? AND session_id IN (SELECT id FROM sessions WHERE round=?)) AS avgCorrectRate,
       (SELECT ROUND(AVG(proficiency), 1) FROM user_words WHERE user_id=? AND round=?) AS avgProficiency,
       (SELECT MIN(date(start_time)) FROM sessions WHERE user_id=? AND round=?) AS startDate
```

| 字段 | 涉及的表 |
|------|---------|
| `round` / `status` / `completedAt` | `round_completions` |
| `totalWords` | `words` |
| `masteredCount` / `progressPercent` / `avgProficiency` | `user_words` |
| `sessionsCount` / `avgCorrectRate` / `startDate` | `sessions` + `review_logs` |

**示例响应**（200）：

```json
{
  "success": true,
  "data": {
    "rounds": [
      {
        "round": 1,
        "status": "completed",
        "totalWords": 4517,
        "masteredCount": 4200,
        "progressPercent": 100,
        "completedAt": "2026-04-15",
        "sessionsCount": 85,
        "avgCorrectRate": 78.5,
        "avgProficiency": 74.2,
        "startDate": "2026-03-01"
      },
      {
        "round": 2,
        "status": "active",
        "totalWords": 4517,
        "masteredCount": 3520,
        "progressPercent": 77.8,
        "completedAt": null,
        "sessionsCount": 52,
        "avgCorrectRate": 82.3,
        "avgProficiency": 71.4,
        "startDate": "2026-04-16"
      }
    ],
    "currentRound": 2
  },
  "ts": "2026-05-21T18:00:00Z"
}
```

---

## 6. 用户设置

### 6.1 GET /api/settings — 获取设置

**认证**：需要

**Response `data` 类型**：

```typescript
interface UserSettings {
  newWordsPerSession: number;      // 每 session 新词数，默认 15，范围 [5, 50]
  dailyGoal: number;               // 每日学习目标词数，默认 40，范围 [5, 120]
  spellingMode: boolean;           // true=启用拼写题，false=仅选择题
  firstLetterHint: boolean;        // 拼写题是否展示首字母提示
  choiceOptions: 2 | 4 | 6;        // 选择题选项数
  previewBeforeLearn: boolean;     // true=学新词前先预览
  dailyReminder: boolean;          // true=每日学习提醒
  reminderTime: string;            // 提醒时间，HH:MM 格式，默认 "20:00"
}
```

**存储方式**：`user_settings` 表，每个字段独立一列。用户注册时自动以默认值创建一行。

```sql
CREATE TABLE IF NOT EXISTS user_settings (
  user_id               INTEGER PRIMARY KEY REFERENCES users(id),
  new_words_per_session INTEGER DEFAULT 15,
  daily_goal            INTEGER DEFAULT 40,
  spelling_mode         INTEGER DEFAULT 0,
  first_letter_hint     INTEGER DEFAULT 1,
  choice_options        INTEGER DEFAULT 4,
  preview_before_learn  INTEGER DEFAULT 1,
  daily_reminder        INTEGER DEFAULT 1,
  reminder_time         TEXT DEFAULT '20:00',
  new_word_mode         TEXT DEFAULT 'random'  -- 学习流程用，不通过设置 API 暴露
);
```

**数据库**：

| 操作 | 涉及的表 | SQL |
|------|---------|-----|
| 读取设置 | `user_settings` | `SELECT * FROM user_settings WHERE user_id = ?` |

后端将行中各列按 camelCase 映射为 `UserSettings` JSON 响应：

| 数据库列 | API 字段 | 类型转换 |
|---------|---------|---------|
| `new_words_per_session` | `newWordsPerSession` | number |
| `daily_goal` | `dailyGoal` | number |
| `spelling_mode` | `spellingMode` | INTEGER(0/1) → boolean |
| `first_letter_hint` | `firstLetterHint` | INTEGER(0/1) → boolean |
| `choice_options` | `choiceOptions` | number |
| `preview_before_learn` | `previewBeforeLearn` | INTEGER(0/1) → boolean |
| `daily_reminder` | `dailyReminder` | INTEGER(0/1) → boolean |
| `reminder_time` | `reminderTime` | string（原值） |

**示例响应**（200）：

```json
{
  "success": true,
  "data": {
    "newWordsPerSession": 15,
    "dailyGoal": 40,
    "spellingMode": true,
    "firstLetterHint": true,
    "choiceOptions": 4,
    "previewBeforeLearn": true,
    "dailyReminder": true,
    "reminderTime": "20:00"
  },
  "ts": "2026-05-21T18:00:00Z"
}
```

---

### 6.2 PUT /api/settings — 更新设置

**认证**：需要

**Request Body**：

```typescript
interface UpdateSettingsRequest {
  newWordsPerSession?: number;      // [5, 50]
  dailyGoal?: number;               // [5, 120]
  spellingMode?: boolean;
  firstLetterHint?: boolean;
  choiceOptions?: 2 | 4 | 6;
  previewBeforeLearn?: boolean;
  dailyReminder?: boolean;
  reminderTime?: string;            // HH:MM
}
```

**校验规则**：

| 字段 | 校验 |
|------|------|
| `newWordsPerSession` | 整数，5 ≤ value ≤ 50 |
| `dailyGoal` | 整数，5 ≤ value ≤ 120 |
| `choiceOptions` | 必须是 2、4、6 之一 |
| `reminderTime` | 必须匹配 `/^\d{2}:\d{2}$/` |
| `spellingMode`/`firstLetterHint`/`previewBeforeLearn`/`dailyReminder` | boolean |

**服务端逻辑**：部分更新 —— 只更新请求中传值的字段，未传字段保持原值。将请求中的 camelCase 字段名映射为 snake_case 列名后，拼装 `UPDATE` 语句。

**数据库**：

| 操作 | 涉及的表 | SQL |
|------|---------|-----|
| 读取当前设置 | `user_settings` | `SELECT * FROM user_settings WHERE user_id = ?` |
| 写入更新后设置 | `user_settings` | 动态拼装 `UPDATE user_settings SET col1=?, col2=? WHERE user_id = ?` |

**数据流**：读取 `user_settings` 当前行 → 覆盖请求中提供的字段 → 列名映射 camelCase→snake_case → 拼装 `UPDATE ... SET ... WHERE user_id = ?` 写回。

**Response**：返回更新后的完整 `UserSettings` 对象（同 GET 响应格式）。

**示例请求**：

```json
{
  "newWordsPerSession": 20,
  "dailyGoal": 50
}
```

**示例响应**（200）：

```json
{
  "success": true,
  "data": {
    "newWordsPerSession": 20,
    "dailyGoal": 50,
    "spellingMode": true,
    "firstLetterHint": true,
    "choiceOptions": 4,
    "previewBeforeLearn": true,
    "dailyReminder": true,
    "reminderTime": "20:00"
  },
  "ts": "2026-05-21T18:30:00Z"
}
```

---

## 7. 超级管理员

> 所有管理员接口均需 `Authorization` header，服务端校验当前用户的 `is_admin=1`。
> 非管理员返回 `403 FORBIDDEN`（错误码 `FORBIDDEN`）。

### 7.1 GET /api/admin/users — 用户列表

**认证**：需要 + `is_admin=1`

**Query 参数**：

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `page` | number | 1 | 页码 |
| `pageSize` | number | 20 | 每页条数，最大 100 |
| `search` | string | — | 按用户名模糊搜索（`LIKE %search%`） |
| `filter` | string | `all` | `all`(全部) / `admin`(仅管理员) / `frozen`(仅冻结) / `active`(仅活跃) |
| `sortBy` | string | `created_at` | 排序字段：`username` / `created_at` / `last_active` |
| `sortOrder` | string | `desc` | `asc` / `desc` |

**Response `data` 类型**：

```typescript
interface AdminUserListResponse {
  users: AdminUserItem[];
  pagination: PaginationMeta;
}

interface AdminUserItem {
  id: number;
  username: string;
  isAdmin: boolean;
  isFrozen: boolean;
  createdAt: string;
  lastActiveAt: string | null;     // 最近一次学习时间
  totalSessions: number;           // 总学习次数
  totalReviews: number;            // 总答题数
  currentRound: number;
  masteredCount: number;           // 当前轮已掌握词数
  avgProficiency: number;          // 当前轮平均熟练度
}
```

**示例请求**：

```
GET /api/admin/users?page=1&pageSize=10&search=zhang&sortBy=created_at&sortOrder=desc
```

**示例响应**（200）：

```json
{
  "success": true,
  "data": {
    "users": [
      {
        "id": 1,
        "username": "zhangsan",
        "isAdmin": true,
        "isFrozen": false,
        "createdAt": "2026-04-01T08:00:00Z",
        "lastActiveAt": "2026-05-21T18:25:00Z",
        "totalSessions": 52,
        "totalReviews": 8450,
        "currentRound": 2,
        "masteredCount": 3520,
        "avgProficiency": 71.4
      }
    ],
    "pagination": {
      "page": 1,
      "pageSize": 10,
      "total": 1,
      "totalPages": 1
    }
  },
  "ts": "2026-05-21T18:30:00Z"
```

**数据库**：

主查询：`users` 表 + 左关联统计子查询

```sql
SELECT
  u.id, u.username, u.is_admin AS isAdmin, u.frozen AS isFrozen,
  u.created_at AS createdAt,
  (SELECT MAX(s.start_time) FROM sessions s WHERE s.user_id = u.id) AS lastActiveAt,
  (SELECT COUNT(*) FROM sessions s WHERE s.user_id = u.id) AS totalSessions,
  (SELECT COALESCE(SUM(uw.total_attempts), 0) FROM user_words uw WHERE uw.user_id = u.id) AS totalReviews,
  (SELECT COALESCE(MAX(uw.round), 1) FROM user_words uw WHERE uw.user_id = u.id) AS currentRound,
  (SELECT COUNT(*) FROM user_words uw WHERE uw.user_id = u.id AND uw.round = (SELECT COALESCE(MAX(uw2.round), 1) FROM user_words uw2 WHERE uw2.user_id = u.id) AND uw.proficiency >= 90) AS masteredCount,
  (SELECT ROUND(AVG(uw.proficiency), 1) FROM user_words uw WHERE uw.user_id = u.id AND uw.round = (SELECT COALESCE(MAX(uw2.round), 1) FROM user_words uw2 WHERE uw2.user_id = u.id)) AS avgProficiency
FROM users u
WHERE 1=1
  AND (CASE WHEN ? IS NOT NULL THEN u.username LIKE '%' || ? || '%' ELSE 1 END)
  AND (CASE WHEN ? = 'admin' THEN u.is_admin = 1 WHEN ? = 'frozen' THEN u.frozen = 1 WHEN ? = 'active' THEN u.frozen = 0 ELSE 1 END)
ORDER BY u.created_at DESC
LIMIT ? OFFSET ?
```

| 参数 | 说明 |
|------|------|
| `search` | `WHERE u.username LIKE '%search%'` |
| `filter` | `all`: 无条件 / `admin`: `is_admin=1` / `frozen`: `frozen=1` / `active`: `frozen=0` |
| `sortBy` | `created_at` `username` `last_active` 对应 `ORDER BY` 字段 |
| `pagination` | `LIMIT pageSize OFFSET (page-1) * pageSize`；总数通过 `SELECT COUNT(*) FROM users WHERE ...` 获取 |

---

### 7.2 PUT /api/admin/users/:id/reset-password — 重置用户密码

**认证**：需要 + `is_admin=1`

**Request Body**：

```typescript
interface ResetPasswordRequest {
  newPassword?: string;    // 不传则服务端生成随机密码（12 位字母+数字）
}
```

**Response `data` 类型**：

```typescript
interface ResetPasswordResponse {
  userId: number;
  username: string;
  newPassword: string;     // 返回明文，前端/管理员需立即告知用户
}
```

**安全提示**：`newPassword` 以明文返回，系统建议管理员：
1. 立即告知用户新密码
2. 告知用户登录后立即修改密码（前端设置页应提供改密功能，待未来扩展）

**数据库**：

| 操作 | 涉及的表 | SQL |
|------|---------|-----|
| 查询用户 | `users` | `SELECT id, username FROM users WHERE id = ?` |
| 更新密码 | `users` | `UPDATE users SET password_hash = ? WHERE id = ?` |

**数据流**：接收新密码明文（或自动生成） → bcrypt 生成 hash → `UPDATE users SET password_hash = ?` → 返回明文密码给管理员。

**示例请求**：

```json
{
  "newPassword": "TempPass123"
}
```

**示例响应**（200）：

```json
{
  "success": true,
  "data": {
    "userId": 3,
    "username": "lisi",
    "newPassword": "TempPass123"
  },
  "ts": "2026-05-21T18:35:00Z"
}
```

---

### 7.3 PUT /api/admin/users/:id/set-admin — 设置/取消管理员

**认证**：需要 + `is_admin=1`

**Request Body**：

```typescript
interface SetAdminRequest {
  isAdmin: boolean;    // true=设为管理员, false=取消管理员
}
```

**校验规则**：

| 条件 | 行为 |
|------|------|
| 目标用户不存在 | 返回 `NOT_FOUND` |
| 操作目标是自身（`userId == adminId`） | 不允许取消自己管理员权限，返回 `VALIDATION_ERROR` |
| 系统中只有一个管理员且要取消 | 不允许，返回 `VALIDATION_ERROR` |

**Response `data` 类型**：

```typescript
interface SetAdminResponse {
  userId: number;
  username: string;
  isAdmin: boolean;
}
```

**数据库**：

| 操作 | 涉及的表 | SQL |
|------|---------|-----|
| 查询用户 | `users` | `SELECT id, username, is_admin FROM users WHERE id = ?` |
| 检查管理员数量 | `users` | `SELECT COUNT(*) FROM users WHERE is_admin = 1` |
| 更新管理员状态 | `users` | `UPDATE users SET is_admin = ? WHERE id = ?` |

**示例请求**：

```json
{
  "isAdmin": true
}
```

**示例响应**（200）：

```json
{
  "success": true,
  "data": {
    "userId": 3,
    "username": "lisi",
    "isAdmin": true
  },
  "ts": "2026-05-21T18:36:00Z"
}
```

---

### 7.4 PUT /api/admin/users/:id/freeze — 冻结/解冻用户

**认证**：需要 + `is_admin=1`

**Request Body**：

```typescript
interface FreezeUserRequest {
  isFrozen: boolean;    // true=冻结, false=解冻
}
```

**冻结效果**：

- 冻结用户无法登录（登录接口返回 `USER_FROZEN`）
- 冻结用户无法访问任何需要认证的接口（中间件在 JWT 校验后检查 `frozen`）
- 超级管理员仍可看到冻结用户（在用户列表中）
- 解冻后恢复正常

**数据库**：

| 操作 | 涉及的表 | SQL |
|------|---------|-----|
| 查询用户 | `users` | `SELECT id, username FROM users WHERE id = ?` |
| 冻结/解冻 | `users` | `UPDATE users SET frozen = ? WHERE id = ?` |

**Response `data` 类型**：

```typescript
interface FreezeUserResponse {
  userId: number;
  username: string;
  isFrozen: boolean;
}
```

---

### 7.5 DELETE /api/admin/users/:id — 删除用户

**认证**：需要 + `is_admin=1`

**不可恢复**。删除用户同时级联删除以下数据：

- `users` 表记录
- `user_words` 表（学习进度）
- `sessions` 表
- `review_logs` 表
- `round_completions` 表

**校验规则**：

| 条件 | 行为 |
|------|------|
| 目标用户不存在 | 返回 `NOT_FOUND` |
| 目标用户是唯一的管理员 | 不允许删除，返回 `VALIDATION_ERROR` |
| 操作目标是自身 | 不允许删除自己，返回 `VALIDATION_ERROR` |

**数据库**：

级联删除操作在单个事务内完成：

```sql
-- 1. 先查询用户名和检验约束
SELECT id, username, is_admin FROM users WHERE id = ?

-- 2. 统计待删除记录数（用于响应）
SELECT COUNT(*) AS userWords FROM user_words WHERE user_id = ?
SELECT COUNT(*) AS sessions FROM sessions WHERE user_id = ?
SELECT COUNT(*) AS reviewLogs FROM review_logs WHERE user_id = ?
SELECT COUNT(*) AS roundCompletions FROM round_completions WHERE user_id = ?

-- 3. 级联删除（外键依赖需手动处理，因 SQLite 外键默认关闭）
DELETE FROM review_logs WHERE user_id = ?
DELETE FROM sessions WHERE user_id = ?
DELETE FROM round_completions WHERE user_id = ?
DELETE FROM user_words WHERE user_id = ?
DELETE FROM users WHERE id = ?
```

| 操作 | 涉及的表 |
|------|---------|
| 校验 | `users` |
| 删除依赖数据 | `review_logs`, `sessions`, `round_completions`, `user_words` |
| 删除用户 | `users` |

**Response `data` 类型**：

```typescript
interface DeleteUserResponse {
  deleted: boolean;
  userId: number;
  username: string;
  removedRecords: {
    userWords: number;
    sessions: number;
    reviewLogs: number;
    roundCompletions: number;
  };
}
```

**示例响应**（200）：

```json
{
  "success": true,
  "data": {
    "deleted": true,
    "userId": 5,
    "username": "zhaoliu",
    "removedRecords": {
      "userWords": 4517,
      "sessions": 23,
      "reviewLogs": 3200,
      "roundCompletions": 1
    }
  },
  "ts": "2026-05-21T18:40:00Z"
}
```

---

## 8. 兜底命令

### 8.1 CLI 命令（不依赖 Web）

| 命令 | 说明 |
|------|------|
| `bash start.sh reset-password <用户名> [新密码]` | 容器外直接修改 SQLite 中用户密码哈希 |

此命令绕过 Web 认证体系，直接操作数据库。适用于：

- 忘记管理员密码
- 用户被锁定无法登录
- 初始部署时初始化管理员

**实现原理**：`cli/reset-password.js` 脚本使用 `better-sqlite3` 直接连接 `data/cet4.db`，通过 `bcrypt` 生成新密码哈希后 `UPDATE users SET password_hash=? WHERE username=?`。

> 设计原则：确保即使 Web 系统完全不可用，管理员仍可通过 shell 进入服务器恢复系统，无需了解数据库结构。

---

## 9. API 调用时序图

以下展示一个完整学习 Session 的前后端 API 调用顺序：

```
前端                                             后端
 │                                                 │
 │  1. GET /api/learn/today                        │
 │  ──────────────────────────────────────────────>│
 │  <────────────────── 今日任务 ──────────────────│
 │                                                 │
 │  2. POST /api/learn/start                       │
 │  ──────────────────────────────────────────────>│
 │  <───────── sessionId: 128  ───────────────────│
 │                                                 │
 │  ╔══════════════════════════════════╗            │
 │  ║   阶段 1: 复习 (可能多轮调用)    ║            │
 │  ╚══════════════════════════════════╝            │
 │                                                 │
 │  3. GET /api/learn/review-queue?sessionId=128   │
 │  ──────────────────────────────────────────────>│
 │  <─────── 复习词列表 (24 词) ──────────────────│
 │                                                 │
 │  ┌─── 对每个词循环 ─────────────────────┐       │
 │  │  4. POST /api/learn/answer            │       │
 │  │  ──────────────────────────────────>  │       │
 │  │  <── SM-2 结果 + 进度更新 ──────────  │       │
 │  └───────────────────────────────────────┘       │
 │                                                 │
 │  ╔══════════════════════════════════╗            │
 │  ║   阶段 2: 学习新词               ║            │
 │  ╚══════════════════════════════════╝            │
 │                                                 │
 │  5. GET /api/learn/new-words?sessionId=128      │
 │  ──────────────────────────────────────────────>│
 │  <─────── 新词列表 (15 词) ────────────────────│
 │                                                 │
 │  ┌─── 对每个词循环 ─────────────────────┐       │
 │  │  6. POST /api/learn/answer            │       │
 │  │  ──────────────────────────────────>  │       │
 │  │  <── SM-2 结果 + 进度更新 ──────────  │       │
 │  └───────────────────────────────────────┘       │
 │                                                 │
 │  ╔══════════════════════════════════╗            │
 │  ║   阶段 3: 总测                   ║            │
 │  ╚══════════════════════════════════╝            │
 │                                                 │
 │  ─── 前端使用本地缓存中的本轮全部已学词进行总测 ──│
 │  ┌─── 对每个词循环 ─────────────────────┐       │
 │  │  7. POST /api/learn/answer            │       │
 │  │  ──────────────────────────────────>  │       │
 │  │  <── SM-2 结果 + 进度更新 ──────────  │       │
 │  └───────────────────────────────────────┘       │
 │                                                 │
 │  8. POST /api/learn/complete                    │
 │  ──────────────────────────────────────────────>│
 │  <── 结算数据 (含是否完成本轮) ────────────────│
 │                                                 │
```

---

## 10. 错误场景速查

| 场景 | 端点 | 错误码 | HTTP 状态 |
|------|------|--------|-----------|
| Token 过期 | 所有需认证接口 | `INVALID_TOKEN` | 401 |
| 未提供 Token | 所有需认证接口 | `UNAUTHORIZED` | 401 |
| 普通用户访问管理接口 | `PUT /api/admin/*` | `FORBIDDEN` | 403 |
| 被冻结用户访问 | 所有需认证接口 | `USER_FROZEN` | 403 |
| 用户名已存在 | `POST /api/auth/register` | `DUPLICATE_USERNAME` | 409 |
| 登录信息错误 | `POST /api/auth/login` | `INVALID_CREDENTIALS` | 401 |
| 单词不存在 | `POST /api/learn/answer` | `NOT_FOUND` | 404 |
| Session 不属于当前用户 | `POST /api/learn/answer` | `FORBIDDEN` | 403 |
| 本轮首次未传 newWordMode | `POST /api/learn/start` | `VALIDATION_ERROR` | 400 |
| 删除唯一管理员 | `DELETE /api/admin/users/:id` | `VALIDATION_ERROR` | 400 |
| 删除自身 | `DELETE /api/admin/users/:id` | `VALIDATION_ERROR` | 400 |
| 取消自身管理员 | `PUT /api/admin/users/:id/set-admin` | `VALIDATION_ERROR` | 400 |
| 新词数超范围 | `PUT /api/settings` | `VALIDATION_ERROR` | 400 |
| dailyGoal 超范围 | `PUT /api/settings` | `VALIDATION_ERROR` | 400 |
| choiceOptions 无效 | `PUT /api/settings` | `VALIDATION_ERROR` | 400 |
| reminderTime 格式错误 | `PUT /api/settings` | `VALIDATION_ERROR` | 400 |

---

## 附录

### A. JWT Payload 结构

```typescript
interface JwtPayload {
  userId: number;
  username: string;
  isAdmin: boolean;
  iat: number;      // 签发时间（Unix 秒）
  exp: number;      // 过期时间（Unix 秒，当前为 iat + 7×24×3600）
}
```

### B. 数据库字段映射速查

| API 字段 | 数据库表.字段 | 说明 |
|----------|-------------|------|
| `sessionId` | `sessions.id` | |
| `wordId` | `words.id` | |
| `userId` | `users.id` | 从 JWT 中解析 |
| `proficiency` | `user_words.proficiency` | 0-100 |
| `ef` | `user_words.ef` | 1.3-3.0 |
| `intervalDays` | `user_words.interval_days` | |
| `repetitions` | `user_words.repetitions` | |
| `nextReview` | `user_words.next_review` | ISO 日期 |
| `isAdmin` | `users.is_admin` | 0/1 |
| `isFrozen` | `users.frozen` | 0/1（数据库默认 0） |
| `settings` | `user_settings` | 独立表，每列一个设置项（见 §6.1） |

### C. 版本历史

| 版本 | 日期 | 变更说明 |
|------|------|----------|
| 1.0 | 2026-05-21 | 初始版本，基于设计文档第 8 节扩展 |
