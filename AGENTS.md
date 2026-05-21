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
├── src/server/       Express 后端（index.ts 当前 mock）
├── src/client/       React 前端（Vite + Tailwind）
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
```

## ANTI-PATTERNS

- 开发全程禁止使用宿主机 Node.js：不安装 node_modules、不执行 npm/npx/tsx，所有操作通过 Docker 容器完成
- 不要用绝对路径，所有路径相对于项目根目录
- 不要在 `isLoggedIn=true` 硬编码之外修改 DEMO 阶段的 API mock
- 不要提交 node_modules 到 git
- 不要使用 `--force` 或 `--no-verify` 提交

## NOTES

- 当前 DEMO 阶段：`src/server/index.ts` 返回 mock 数据，`isLoggedIn=true` 显示登录后界面
- 真实后端代码已编写（database.ts, auth.ts, seed.ts）但未部署
- SM-2 算法和真实后端部署在 DEMO 确认后进行
- Docker 容器名 `docker-cet4-web-1`（docker-compose 自动命名，`exec` 命令使用此名）
