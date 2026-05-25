# CET-4 背单词网站 — AGENTS.md

## OVERVIEW

CET-4 词汇学习网站（4517 词）。TypeScript + Express + React 19 + Vite 6 + Tailwind CSS 3 + better-sqlite3。Docker (node:20-alpine) 局域网部署，端口 9098。

## CONSTRAINTS

- 服务器 Ubuntu 22.04 / 24.04，WEB 引擎由 Docker 启动
- 数据文件不在 Docker 内（volume 挂载 `../data:/app/data`）
- 每次学习控制在 30~40 分钟，默认参数按此校准
- 答题混合模式（选择题 + 拼写题），拼写大小写敏感
- 超级管理员可重置密码、冻结/删除用户；兜底命令 `bash start.sh reset-password`
- 访客模式：未登录时展示全局统计
- 新词选择两种模式：全随机 / 按首字母乱序
- 端口号 9098，所有路径使用相对目录
- 镜像从华为云拉取：`swr.cn-north-4.myhuaweicloud.com/ddn-k8s/docker.io/library/node:20-alpine`
- `node:20-alpine` 需要 `nodejs-dev` 包（提供 `libnode.so.109`）
- 宿主机不安装 node_modules，不执行任何 Node.js 命令。所有编译、构建、依赖安装、脚本运行必须通过 Docker 容器完成
- 前端通过 volume 挂载 `../dist/client:/app/dist/client` 热更新，修改后 `bash start.sh build` → 刷新浏览器
- 容器内可执行前后端构建，完全摆脱宿主机 Node.js 依赖

## STRUCTURE

```
├── src/server/       Express 后端（routes/ 路由, models/ 数据层, middleware/ 鉴权）
├── src/client/       React 前端（Vite + Tailwind）
├── tests/            API 集成测试（vitest + supertest）
│   ├── server/routes/   6 个路由模块共 110 项测试
│   └── db/              Schema 验证测试
├── docker/           Dockerfile + compose
├── cli/              运行时管理脚本（reset-password.js, seed-test.js）
├── data/             SQLite 数据库（Docker 外 volume）
├── config/           JWT 密钥
├── dist/client/      前端构建产物（volume 挂载）
├── docs/             设计文档
├── ref/              词汇表原始资料
└── start.sh          一键管理脚本
```

## WHERE TO LOOK

| Task | Location |
|------|----------|
| 前端页面 | `src/client/src/pages/` |
| 后端路由 | `src/server/routes/` |
| 数据层 | `src/server/models/database.ts` |
| 日志系统 | `docs/日志设计文档.md` |
| Docker 配置 | `docker/Dockerfile`, `docker/docker-compose.yml` |
| 管理脚本 | `start.sh` |
| CLI 脚本 | `cli/reset-password.js`, `cli/seed-test.js`, `cli/seed-bcw.js` |
| API 测试 | `tests/server/routes/` |
| Schema 测试 | `tests/db/schema_test.js` |
| 测试配置 | `vitest.config.ts` |

## COMMANDS

```bash
bash start.sh                     # 构建并启动
bash start.sh --test              # 测试模式（50 词）
bash start.sh build               # 容器内构建前端
bash start.sh reset-password <用户名> [新密码]
bash start.sh --help              # 查看帮助
docker exec docker-cet4-web-1 npm run build:client    # 容器内构建前端（与 start.sh build 等价）
docker exec docker-cet4-web-1 node /app/dist/scripts/seed.js        # 4517 词种子
docker exec -e DB_PATH=/app/data/cet4_test.db docker-cet4-web-1 node /app/dist/scripts/seed_test.js  # 50 词种子
docker exec docker-cet4-web-1 npx vitest run                    # 运行全部 API 测试（110 项）
docker exec docker-cet4-web-1 npx vitest run tests/server/routes/auth.test.ts  # 单文件测试
# Schema 验证（需先复制到容器：docker cp tests/db/schema_test.js docker-cet4-web-1:/app/tests/db/）
docker exec docker-cet4-web-1 node tests/db/schema_test.js
```

## ANTI-PATTERNS

- 开发全程禁止使用宿主机 Node.js：不安装 node_modules、不执行 npm/npx/tsx，所有操作通过 Docker 容器完成
- 不要用绝对路径，所有路径相对于项目根目录
- 不要提交 node_modules 到 git
- 不要使用 `--force` 或 `--no-verify` 提交
- git commit message 必须使用中文
- 所有 `git push` 必须经人工确认后才能执行，禁止自动推送

## NOTES

- 服务端已完全使用生产级代码：SM-2 算法、bcrypt 密码哈希、JWT 认证、冻结用户检查、完整管理员权限
- Docker 容器名 `docker-cet4-web-1`（docker-compose 自动命名，`exec` 命令使用此名）
- API 测试共 **110 项**，覆盖 6 个路由模块 21 个端点，通过 vitest + supertest 运行在 Docker 容器内
